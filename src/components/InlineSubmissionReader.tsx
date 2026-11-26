import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Table as TableIcon,
  Presentation,
  Maximize2,
  Minimize2,
  Download,
  Undo2,
  Trash2,
  Eye,
} from 'lucide-react';
import type { CalculationStepAnnotation, RedInkStamp } from '../services/assignmentService';

export interface ReaderAttachmentItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  dataUrl: string;
}

export type StampedPin = CalculationStepAnnotation & { x?: number; y?: number; lineIndex?: number };

interface InlineSubmissionReaderProps {
  attachments: ReaderAttachmentItem[];
  annotationsByKey: Record<string, StampedPin[]>;
  activeStamp?: RedInkStamp;
  onSelectStamp?: (stamp: RedInkStamp) => void;
  onUpdateAnnotations?: (attachmentId: string, nextPins: StampedPin[]) => void;
  readOnly?: boolean;
}

type ParsedDocContent =
  | { kind: 'image' }
  | { kind: 'pdf'; blobUrl: string; extractedLines: string[] }
  | { kind: 'lines'; label: string; lines: string[] }
  | { kind: 'slides'; slides: { title: string; lines: string[] }[] }
  | { kind: 'table'; sheetName: string; rows: string[][] };

const STAMP_CHOICES: RedInkStamp[] = ['✓', 'M1', 'M2', 'A1', 'A2', '✗'];

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return new Uint8Array(0);
  const meta = dataUrl.slice(0, commaIdx);
  const body = dataUrl.slice(commaIdx + 1);
  if (meta.includes(';base64')) {
    const bin = atob(body);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new TextEncoder().encode(decodeURIComponent(body));
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  for (const fmt of ['deflate-raw', 'deflate'] as const) {
    try {
      const ds = new DecompressionStream(fmt);
      const writer = ds.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const buf = await new Response(ds.readable).arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      // try next format
    }
  }
  return null;
}

function decodeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

async function unpackZipEntries(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  const map: Record<string, Uint8Array> = {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder('utf-8');
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;

    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    let compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;

    // Handle data descriptor (bit 3) when compSize is 0 in local header
    if ((flags & 0x08) !== 0 && compSize === 0) {
      let scan = dataStart;
      while (scan + 16 <= bytes.length) {
        if (view.getUint32(scan, true) === 0x08074b50) {
          compSize = view.getUint32(scan + 8, true);
          break;
        }
        scan++;
      }
    }

    const dataEnd = dataStart + compSize;
    if (dataEnd > bytes.length || compSize === 0) {
      if (compSize === 0 && dataStart <= bytes.length) {
        offset = dataStart;
        continue;
      }
      break;
    }

    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLen));
    const slice = bytes.slice(dataStart, dataEnd);

    if (method === 0) {
      map[name] = slice;
    } else if (method === 8) {
      const inflated = await inflateRaw(slice);
      if (inflated) map[name] = inflated;
    }

    offset = dataEnd;
    if ((flags & 0x08) !== 0 && offset + 16 <= bytes.length && view.getUint32(offset, true) === 0x08074b50) {
      offset += 16;
    }
  }
  return map;
}

function parseDocxXml(xml: string): string[] {
  const lines: string[] = [];
  const paragraphs = xml.split(/<w:p\b[^>]*>/g).slice(1);
  let listCounter = 0;

  for (const p of paragraphs) {
    const hasNumPr = /<w:numPr\b/i.test(p);
    const cleaned = p
      .replace(/<w:tab\b[^>]*\/?>/g, '    ')
      .replace(/<w:br\b[^>]*\/?>/g, '\n');
    const texts = Array.from(cleaned.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)).map((m) =>
      decodeXml(m[1])
    );
    let line = texts.join('').replace(/\u00a0/g, ' ').trim();
    if (!line) continue;

    if (hasNumPr) {
      listCounter += 1;
      if (!/^(?:Question\s+|Q\.?\s*)?\d{1,3}\s*[.)\-:]/i.test(line)) {
        line = `${listCounter}. ${line}`;
      }
    } else {
      listCounter = 0;
    }
    lines.push(line);
  }
  return lines;
}


function parsePptxSlides(entries: Record<string, Uint8Array>): { title: string; lines: string[] }[] {
  const decoder = new TextDecoder('utf-8');
  const slideNames = Object.keys(entries)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/i)?.[1] || 0);
      const nb = Number(b.match(/slide(\d+)/i)?.[1] || 0);
      return na - nb;
    });

  return slideNames.map((name, idx) => {
    const xml = decoder.decode(entries[name]!);
    const paras = xml.split(/<a:p\b[^>]*>/g).slice(1);
    const lines: string[] = [];
    for (const p of paras) {
      const texts = Array.from(p.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)).map((m) =>
        decodeXml(m[1])
      );
      const line = texts.join('').trim();
      if (line) lines.push(line);
    }
    return {
      title: `Slide ${idx + 1}`,
      lines: lines.length > 0 ? lines : ['(Empty slide)'],
    };
  });
}

function parseXlsxSheet(entries: Record<string, Uint8Array>): string[][] {
  const decoder = new TextDecoder('utf-8');
  const sharedStrings: string[] = [];
  const ssBytes = entries['xl/sharedStrings.xml'];
  if (ssBytes) {
    const ssXml = decoder.decode(ssBytes);
    const sis = ssXml.split(/<si\b[^>]*>/g).slice(1);
    for (const si of sis) {
      const ts = Array.from(si.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((m) => decodeXml(m[1]));
      sharedStrings.push(ts.join(''));
    }
  }

  const sheetKey = Object.keys(entries)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort()[0];
  if (!sheetKey) return [];

  const sheetXml = decoder.decode(entries[sheetKey]!);
  const rowBlocks = sheetXml.split(/<row\b[^>]*>/g).slice(1);
  const rows: string[][] = [];

  for (const rBlock of rowBlocks.slice(0, 120)) {
    const cells = Array.from(rBlock.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g));
    const rowVals: string[] = [];
    for (const c of cells) {
      const attrs = c[1] || '';
      const inner = c[2] || '';
      const isShared = /\bt="s"/.test(attrs);
      const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      const tMatch = inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
      if (isShared && vMatch) {
        const idx = Number(vMatch[1]);
        rowVals.push(sharedStrings[idx] ?? '');
      } else if (tMatch) {
        rowVals.push(decodeXml(tMatch[1]));
      } else if (vMatch) {
        rowVals.push(vMatch[1]);
      } else {
        rowVals.push('');
      }
    }
    if (rowVals.some((v) => v.trim() !== '')) {
      rows.push(rowVals);
    }
  }
  return rows;
}

function extractPdfTextLines(bytes: Uint8Array): string[] {
  const latin1 = new TextDecoder('latin1').decode(bytes);
  const lines: string[] = [];
  const btEtRegex = /BT\b([\s\S]*?)\bET\b/g;
  let m: RegExpExecArray | null;
  while ((m = btEtRegex.exec(latin1)) !== null) {
    const block = m[1];
    const parts = Array.from(block.matchAll(/\((?:\\.|[^\\()])*\)/g)).map((p) =>
      p[0]
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\')
    );
    const joined = parts.join('').trim();
    if (joined) lines.push(joined);
  }
  return lines;
}

export const InlineSubmissionReader: React.FC<InlineSubmissionReaderProps> = ({
  attachments,
  annotationsByKey,
  activeStamp = '✓',
  onSelectStamp,
  onUpdateAnnotations,
  readOnly = false,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [parsedContent, setParsedContent] = useState<ParsedDocContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pdfViewMode, setPdfViewMode] = useState<'embed' | 'text'>('embed');

  const safeIdx = Math.min(selectedIdx, Math.max(0, attachments.length - 1));
  const current = attachments[safeIdx];

  useEffect(() => {
    let revokedUrl: string | null = null;
    let cancelled = false;

    async function parseAttachment() {
      if (!current) {
        setParsedContent(null);
        return;
      }

      const lowerName = current.name.toLowerCase();
      const mime = (current.mimeType || '').toLowerCase();

      if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif|svg)$/.test(lowerName)) {
        setParsedContent({ kind: 'image' });
        return;
      }

      setIsLoading(true);
      try {
        const bytes = dataUrlToBytes(current.dataUrl);

        if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) {
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          revokedUrl = blobUrl;
          const lines = extractPdfTextLines(bytes);
          if (!cancelled) {
            setParsedContent({ kind: 'pdf', blobUrl, extractedLines: lines });
          }
          return;
        }

        if (lowerName.endsWith('.docx') || mime.includes('wordprocessingml')) {
          const entries = await unpackZipEntries(bytes);
          const docXml = entries['word/document.xml'];
          if (docXml) {
            const lines = parseDocxXml(new TextDecoder('utf-8').decode(docXml));
            if (!cancelled) {
              setParsedContent({
                kind: 'lines',
                label: 'Word Document (.docx)',
                lines: lines.length > 0 ? lines : ['(No readable text paragraphs found in document)'],
              });
            }
            return;
          }
        }

        if (lowerName.endsWith('.pptx') || mime.includes('presentationml')) {
          const entries = await unpackZipEntries(bytes);
          const slides = parsePptxSlides(entries);
          if (slides.length > 0 && !cancelled) {
            setParsedContent({ kind: 'slides', slides });
            return;
          }
        }

        if (lowerName.endsWith('.xlsx') || mime.includes('spreadsheetml')) {
          const entries = await unpackZipEntries(bytes);
          const rows = parseXlsxSheet(entries);
          if (rows.length > 0 && !cancelled) {
            setParsedContent({ kind: 'table', sheetName: 'Worksheet 1', rows });
            return;
          }
        }

        if (lowerName.endsWith('.csv') || mime === 'text/csv') {
          const text = new TextDecoder('utf-8').decode(bytes);
          const rows = text
            .split(/\r?\n/)
            .filter((r) => r.trim())
            .slice(0, 120)
            .map((r) => r.split(',').map((c) => c.trim().replace(/^"|"$/g, '')));
          if (!cancelled) {
            setParsedContent({ kind: 'table', sheetName: 'CSV Data', rows });
          }
          return;
        }


        // OpenDocument (.odt, .odp, .ods)
        if (/\.(odt|odp|ods)$/.test(lowerName)) {
          const entries = await unpackZipEntries(bytes);
          const contentXml = entries['content.xml'];
          if (contentXml) {
            const rawXml = new TextDecoder('utf-8').decode(contentXml);
            const paras = rawXml
              .split(/<text:p\b[^>]*>/g)
              .slice(1)
              .map((p) => decodeXml(p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()))
              .filter(Boolean);
            if (!cancelled) {
              setParsedContent({
                kind: 'lines',
                label: 'OpenDocument File',
                lines: paras.length > 0 ? paras : ['(Empty document)'],
              });
            }
            return;
          }
        }

        // Fallback for .txt, .rtf, .md, .doc, or any text-based file
        const rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        const cleanedText = lowerName.endsWith('.rtf')
          ? rawText
              .replace(/\\[a-z]+\d* ?/gi, ' ')
              .replace(/[{}]/g, '')
              .replace(/\s+/g, ' ')
              .trim()
          : rawText;
        const lines = cleanedText
          .split(/\r?\n/)
          .map((l) => l.replace(/[^\x20-\x7E\u00A0-\u024F]/g, ' ').trim())
          .filter((l) => l.length > 1)
          .slice(0, 300);

        if (!cancelled) {
          setParsedContent({
            kind: 'lines',
            label: 'Document Reader',
            lines:
              lines.length > 0
                ? lines
                : ['Preview not available for this binary format. Use Download above to open externally.'],
          });
        }
      } catch {
        if (!cancelled) {
          setParsedContent({
            kind: 'lines',
            label: 'Document Reader',
            lines: ['Could not parse file inline. Use Download above to open externally.'],
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    parseAttachment();
    return () => {
      cancelled = true;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [current]);

  const currentPins = useMemo(
    () => (current ? annotationsByKey[current.id] || [] : []),
    [annotationsByKey, current]
  );

  if (!current) return null;

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !onUpdateAnnotations || !activeStamp) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    onUpdateAnnotations(current.id, [...currentPins, { stamp: activeStamp, x, y }]);
  };

  const handleLineStamp = (lineIndex: number) => {
    if (readOnly || !onUpdateAnnotations || !activeStamp) return;
    const existingIdx = currentPins.findIndex((p) => p.lineIndex === lineIndex);
    if (existingIdx >= 0) {
      // Toggle off if same stamp, otherwise update stamp
      const existing = currentPins[existingIdx];
      if (existing.stamp === activeStamp) {
        onUpdateAnnotations(
          current.id,
          currentPins.filter((_, idx) => idx !== existingIdx)
        );
      } else {
        const next = [...currentPins];
        next[existingIdx] = { ...existing, stamp: activeStamp };
        onUpdateAnnotations(current.id, next);
      }
    } else {
      onUpdateAnnotations(current.id, [...currentPins, { stamp: activeStamp, lineIndex }]);
    }
  };

  return (
    <div
      className={
        isExpanded
          ? 'fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs p-2 sm:p-4 flex flex-col'
          : 'rounded-xl border border-indigo-200 bg-indigo-50/40 overflow-hidden'
      }
    >
      <div
        className={
          isExpanded
            ? 'bg-white rounded-2xl shadow-2xl flex flex-col flex-1 overflow-hidden border border-slate-300'
            : 'flex flex-col'
        }
      >
        {/* Top File Tabs & Toolbar */}
        <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            {attachments.map((att, idx) => {
              const isImg = att.mimeType.startsWith('image/');
              const active = idx === safeIdx;
              return (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer shrink-0 ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isImg ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                  <span className="max-w-[140px] truncate">{att.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={current.dataUrl}
              download={current.name}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md"
              title="Download original file"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </a>
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-md cursor-pointer"
              title={isExpanded ? 'Exit full screen' : 'Expand reader'}
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              <span>{isExpanded ? 'Minimize' : 'Full Screen'}</span>
            </button>
          </div>
        </div>

        {/* Red-Ink Marking Toolbar (Teacher Mode) */}
        {!readOnly && onSelectStamp && onUpdateAnnotations && (
          <div className="px-3 py-1.5 bg-rose-50/80 border-b border-rose-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold text-rose-900 mr-1">Red-Ink Stamp:</span>
              {STAMP_CHOICES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onSelectStamp(st)}
                  className={`px-2 py-0.5 rounded text-[11px] font-black border cursor-pointer ${
                    activeStamp === st
                      ? 'bg-red-600 text-white border-red-800 ring-2 ring-red-300'
                      : 'bg-white text-red-600 border-red-200 hover:bg-red-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {currentPins.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateAnnotations(current.id, currentPins.slice(0, -1))}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-white text-slate-700 border border-slate-300 rounded cursor-pointer"
                >
                  <Undo2 className="w-2.5 h-2.5" />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateAnnotations(current.id, [])}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-white text-rose-700 border border-rose-200 rounded cursor-pointer"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span>Clear ({currentPins.length})</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Inline Reader Body */}
        <div
          className={`p-3 bg-white overflow-y-auto ${
            isExpanded ? 'flex-1' : 'max-h-[420px]'
          }`}
        >
          {isLoading ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-500">
              Opening {current.name} inline...
            </div>
          ) : parsedContent?.kind === 'image' ? (
            <div className="space-y-1.5">
              {!readOnly && (
                <p className="text-[10px] font-semibold text-slate-500">
                  Tap anywhere on the photo to place your active red-ink stamp ({activeStamp}).
                </p>
              )}
              <div
                onClick={handleImageClick}
                className={`relative inline-block max-w-full border border-slate-300 rounded-lg overflow-hidden bg-slate-50 ${
                  readOnly ? '' : 'cursor-crosshair'
                }`}
              >
                <img
                  src={current.dataUrl}
                  alt={current.name}
                  className="max-h-[520px] w-auto object-contain block"
                />
                {currentPins.map((pin, pIdx) => (
                  <span
                    key={pIdx}
                    style={{ left: `${pin.x ?? 80}%`, top: `${pin.y ?? 20}%` }}
                    className="-translate-x-1/2 -translate-y-1/2 absolute px-1.5 py-0.5 rounded text-xs font-black text-red-600 bg-red-50/95 border border-red-500 shadow-xs pointer-events-none"
                  >
                    {pin.stamp}
                  </span>
                ))}
              </div>
            </div>
          ) : parsedContent?.kind === 'pdf' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                  <Eye className="w-3 h-3 text-indigo-600" />
                  <span>PDF Inline Viewer</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPdfViewMode('embed')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded border cursor-pointer ${
                      pdfViewMode === 'embed'
                        ? 'bg-indigo-600 text-white border-indigo-700'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >

                    PDF Page View
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfViewMode('text')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded border cursor-pointer ${
                      pdfViewMode === 'text'
                        ? 'bg-indigo-600 text-white border-indigo-700'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Text &amp; Red-Ink Stamp View
                  </button>
                </div>
              </div>

              {pdfViewMode === 'embed' ? (
                <iframe
                  src={parsedContent.blobUrl}
                  title={current.name}
                  className="w-full h-[360px] rounded-lg border border-slate-300 bg-slate-100"
                />
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50/50">
                  {parsedContent.extractedLines.length === 0 ? (
                    <p className="p-3 text-xs text-slate-600">
                      This PDF appears to be a scanned image PDF. Switch to <strong>PDF Page View</strong> above or use Download.
                    </p>
                  ) : (
                    parsedContent.extractedLines.map((line, idx) => {
                      const linePin = currentPins.find((p) => p.lineIndex === idx);
                      return (
                        <div
                          key={idx}
                          onClick={() => handleLineStamp(idx)}
                          className={`px-3 py-1.5 text-xs flex items-start justify-between gap-2 ${
                            readOnly ? '' : 'hover:bg-amber-50/70 cursor-pointer'
                          }`}
                        >
                          <span className="text-slate-900 whitespace-pre-wrap leading-relaxed">
                            {line}
                          </span>
                          {linePin?.stamp && (
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-black text-red-600 bg-red-50 border border-red-400 shrink-0">
                              {linePin.stamp}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ) : parsedContent?.kind === 'slides' ? (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <Presentation className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  Presentation ({parsedContent.slides.length} Slides)
                  {!readOnly ? ' · Tap any slide to stamp red ink' : ''}
                </span>
              </p>
              {parsedContent.slides.map((slide, sIdx) => {
                const slidePin = currentPins.find((p) => p.lineIndex === sIdx);
                return (
                  <div
                    key={sIdx}
                    onClick={() => handleLineStamp(sIdx)}
                    className={`p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1 ${
                      readOnly ? '' : 'hover:border-indigo-400 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                        {slide.title}
                      </span>
                      {slidePin?.stamp && (
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-black text-red-600 bg-red-50 border border-red-400">
                          {slidePin.stamp}
                        </span>
                      )}
                    </div>
                    {slide.lines.map((l, lIdx) => (
                      <p key={lIdx} className="text-xs text-slate-800 leading-relaxed">
                        {l}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : parsedContent?.kind === 'table' ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {parsedContent.sheetName}
                  {!readOnly ? ' · Tap any row to stamp red ink' : ''}
                </span>
              </p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="min-w-full text-xs divide-y divide-slate-200">
                  <tbody className="divide-y divide-slate-100">
                    {parsedContent.rows.map((row, rIdx) => {
                      const rowPin = currentPins.find((p) => p.lineIndex === rIdx);
                      return (
                        <tr
                          key={rIdx}
                          onClick={() => handleLineStamp(rIdx)}
                          className={
                            rIdx === 0
                              ? 'bg-slate-100 font-bold text-slate-900'
                              : readOnly
                              ? 'bg-white'
                              : 'bg-white hover:bg-amber-50 cursor-pointer'
                          }
                        >
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-2.5 py-1.5 border-r border-slate-100 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                          {rowPin?.stamp && (
                            <td className="px-2 py-1 text-right">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black text-red-600 bg-red-50 border border-red-400">
                                {rowPin.stamp}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : parsedContent?.kind === 'lines' ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span>{parsedContent.label}</span>
                {!readOnly && <span>Tap any line/question to stamp red ink ({activeStamp})</span>}
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50/40">
                {parsedContent.lines.map((line, lIdx) => {
                  const linePin = currentPins.find((p) => p.lineIndex === lIdx);
                  return (
                    <div
                      key={lIdx}
                      onClick={() => handleLineStamp(lIdx)}
                      className={`px-3 py-2 text-xs flex items-start justify-between gap-2 ${
                        readOnly ? '' : 'hover:bg-amber-50/80 cursor-pointer'
                      }`}
                    >
                      <span className="text-slate-900 whitespace-pre-wrap leading-relaxed font-sans">
                        {line}
                      </span>
                      {linePin?.stamp && (
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-black text-red-600 bg-red-50 border border-red-400 shrink-0">
                          {linePin.stamp}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
