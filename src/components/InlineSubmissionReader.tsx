import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
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
  ExternalLink,
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
  activeStamp?: RedInkStamp | string;
  onSelectStamp?: (stamp: RedInkStamp | string) => void;
  onUpdateAnnotations?: (attachmentId: string, nextPins: StampedPin[]) => void;
  scoreLabel?: string;
  readOnly?: boolean;
}

type ParsedDocContent =
  | { kind: 'image' }
  | { kind: 'pdf-pages'; pages: string[]; totalPages: number; blobUrl: string; fallbackMessage?: string }
  | { kind: 'lines'; label: string; lines: string[] }
  | { kind: 'slides'; slides: { title: string; lines: string[] }[] }
  | { kind: 'table'; sheetName: string; rows: string[][] };

const STAMP_CHOICES: RedInkStamp[] = [
  '✓', '✓✓', '✗',
  'M1', 'M2', 'M3', 'M0',
  'A1', 'A2', 'A3', 'A0',
  'B1', 'B2', 'B3', 'B0',
  'C1', 'S1', 'P1', 'L1',
  'CAO', 'FT', 'BOD', '^',
];

const PDFJS_CDN_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
let pdfJsLoadPromise: Promise<any> | null = null;

function loadPdfJsFromCdn(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  const w = window as any;
  if (w.pdfjsLib) {
    w.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.min.js`;
    return Promise.resolve(w.pdfjsLib);
  }
  if (!pdfJsLoadPromise) {
    pdfJsLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${PDFJS_CDN_BASE}/pdf.min.js`;
      script.async = true;
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.min.js`;
          resolve(lib);
        } else {
          pdfJsLoadPromise = null;
          reject(new Error('PDF.js failed to initialize'));
        }
      };
      script.onerror = () => {
        pdfJsLoadPromise = null;
        reject(new Error('Network error loading PDF renderer'));
      };
      document.head.appendChild(script);
    });
  }
  return pdfJsLoadPromise;
}

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

async function inflateBytes(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  for (const fmt of ['deflate', 'deflate-raw'] as const) {
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
      const inflated = await inflateBytes(slice);
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
    const xml = decoder.decode(entries[name]);
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

  const sheetXml = decoder.decode(entries[sheetKey]);
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

async function renderPdfPagesVisual(
  bytes: Uint8Array,
  maxPages = 25
): Promise<{ pages: string[]; totalPages: number }> {
  const pdfjsLib = await loadPdfJsFromCdn();
  const loadingTask = pdfjsLib.getDocument({ data: bytes, disableWorker: true });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const count = Math.min(totalPages, maxPages);
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= count; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = 1050;
    const scale = Math.min(2.0, Math.max(1.2, targetWidth / Math.max(1, baseViewport.width)));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(canvas.toDataURL('image/jpeg', 0.86));
  }

  return { pages, totalPages };
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load page image'));
    img.src = src;
  });
}


function toPercentageScoreLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^\d+(\.\d+)?%$/.test(trimmed)) return trimmed;
  const frac = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    const num = parseFloat(frac[1]);
    const den = parseFloat(frac[2]);
    if (den > 0) {
      return `${Math.round((num / den) * 100)}%`;
    }
  }
  return trimmed;
}

function isTotalScoreStamp(stamp: string): boolean {
  return /^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(stamp.trim()) || /^\d+(\.\d+)?%$/.test(stamp.trim());
}

function drawRedInkMarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  stamp: string,
  cx: number,
  cy: number,
  canvasWidth: number
) {
  const isScore = isTotalScoreStamp(stamp);
  const isSymbol = stamp === '✓' || stamp === '✓✓' || stamp === '✗';
  const fontSize = Math.max(32, Math.round(canvasWidth * (isScore ? 0.058 : isSymbol ? 0.036 : 0.025)));
  ctx.save();
  ctx.font = `900 ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (isScore) {
    const metrics = ctx.measureText(stamp);
    const rx = Math.max(fontSize * 1.32, metrics.width * 0.78);
    const ry = fontSize * 0.98;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, -0.06, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fill();
    ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.12));
    ctx.strokeStyle = '#dc2626';
    ctx.stroke();
  } else {
    ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.16));
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeText(stamp, cx, cy);
  }
  ctx.fillStyle = '#dc2626';
  ctx.fillText(stamp, cx, cy);
  ctx.restore();
}

async function buildMarkedPdfBlobUrl(
  pageUrls: string[],
  pins: StampedPin[]
): Promise<string> {
  const loadedPages = await Promise.all(pageUrls.map(loadHtmlImage));
  if (loadedPages.length === 0) throw new Error('No pages to export');

  const pageHeights = loadedPages.map((img) => img.naturalHeight || img.height || 1400);
  const totalHeight = pageHeights.reduce((acc, h) => acc + h, 0);

  let pdf: jsPDF | null = null;
  let cumulativeY = 0;

  for (let i = 0; i < loadedPages.length; i++) {
    const img = loadedPages[i];
    const w = img.naturalWidth || img.width || 1050;
    const h = pageHeights[i];

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.drawImage(img, 0, 0, w, h);

    // Draw every pin whose global Y falls on this page slice
    for (const pin of pins) {
      const leftPct = typeof pin.x === 'number' ? pin.x : 88;
      const topPct =
        typeof pin.y === 'number'
          ? pin.y
          : typeof pin.lineIndex === 'number'
          ? Math.min(96, 6 + pin.lineIndex * 5)
          : 15;
      const globalY = (topPct / 100) * totalHeight;
      if (globalY >= cumulativeY && globalY <= cumulativeY + h) {
        const localX = (leftPct / 100) * w;
        const localY = globalY - cumulativeY;
        drawRedInkMarkOnCanvas(ctx, pin.stamp, localX, localY, w);
      }
    }

    const stampedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const orientation = w > h ? 'l' : 'p';
    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: 'px', format: [w, h], compress: true });
    } else {
      pdf.addPage([w, h], orientation);
    }
    pdf.addImage(stampedDataUrl, 'JPEG', 0, 0, w, h);
    cumulativeY += h;
  }

  if (!pdf) throw new Error('PDF generation failed');
  const blob = pdf.output('blob');
  return URL.createObjectURL(blob);
}

async function buildMarkedImageDataUrl(
  imageDataUrl: string,
  pins: StampedPin[]
): Promise<string> {
  const img = await loadHtmlImage(imageDataUrl);
  const w = img.naturalWidth || img.width || 1000;
  const h = img.naturalHeight || img.height || 1000;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageDataUrl;

  ctx.drawImage(img, 0, 0, w, h);
  for (const pin of pins) {
    const leftPct = typeof pin.x === 'number' ? pin.x : 88;
    const topPct = typeof pin.y === 'number' ? pin.y : 15;
    drawRedInkMarkOnCanvas(ctx, pin.stamp, (leftPct / 100) * w, (topPct / 100) * h, w);
  }
  return canvas.toDataURL('image/jpeg', 0.9);
}

export const InlineSubmissionReader: React.FC<InlineSubmissionReaderProps> = ({
  attachments,
  annotationsByKey,
  activeStamp = '✓',
  onSelectStamp,
  onUpdateAnnotations,
  scoreLabel = '',
  readOnly = false,
}) => {
  const [customScoreStamp, setCustomScoreStamp] = useState<string>(() => toPercentageScoreLabel(scoreLabel || ''));
  useEffect(() => {
    if (scoreLabel && scoreLabel.trim()) {
      setCustomScoreStamp(toPercentageScoreLabel(scoreLabel));
    }
  }, [scoreLabel]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [parsedContent, setParsedContent] = useState<ParsedDocContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExportingMarked, setIsExportingMarked] = useState(false);

  const safeIdx = Math.min(selectedIdx, Math.max(0, attachments.length - 1));
  const current = attachments[safeIdx];

  useEffect(() => {
    let cancelled = false;
    let createdBlobUrl: string | null = null;

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
          createdBlobUrl = URL.createObjectURL(blob);
          try {
            const rendered = await renderPdfPagesVisual(bytes, 25);
            if (!cancelled) {
              setParsedContent({
                kind: 'pdf-pages',
                pages: rendered.pages,
                totalPages: rendered.totalPages,
                blobUrl: createdBlobUrl,
              });
            }
          } catch {
            if (!cancelled) {
              setParsedContent({
                kind: 'pdf-pages',
                pages: [],
                totalPages: 0,
                blobUrl: createdBlobUrl,
                fallbackMessage:
                  'Could not load the visual page renderer (check internet connection), or tap "Open Full PDF" above to view the original pages.',
              });
            }
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
            lines: ['Could not render this file inline. Use Download above to open externally.'],
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    parseAttachment();
    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [current]);

  const currentPins = useMemo(
    () => (current ? annotationsByKey[current.id] || [] : []),
    [annotationsByKey, current]
  );

  if (!current) return null;

  const handleDownloadOrOpenMarked = async (mode: 'download' | 'open') => {
    setIsExportingMarked(true);
    try {
      if (parsedContent?.kind === 'pdf-pages' && parsedContent.pages.length > 0) {
        if (currentPins.length === 0) {
          if (mode === 'open') {
            window.open(parsedContent.blobUrl, '_blank', 'noopener,noreferrer');
          } else {
            const a = document.createElement('a');
            a.href = current.dataUrl;
            a.download = current.name;
            a.click();
          }
          return;
        }
        const markedPdfUrl = await buildMarkedPdfBlobUrl(parsedContent.pages, currentPins);
        if (mode === 'open') {
          window.open(markedPdfUrl, '_blank', 'noopener,noreferrer');
        } else {
          const a = document.createElement('a');
          a.href = markedPdfUrl;
          a.download = `Marked_${current.name.replace(/\.pdf$/i, '')}.pdf`;
          a.click();
        }
        return;
      }

      if (parsedContent?.kind === 'image') {
        const outUrl =
          currentPins.length > 0
            ? await buildMarkedImageDataUrl(current.dataUrl, currentPins)
            : current.dataUrl;
        if (mode === 'open') {
          window.open(outUrl, '_blank', 'noopener,noreferrer');
        } else {
          const a = document.createElement('a');
          a.href = outUrl;
          a.download = currentPins.length > 0 ? `Marked_${current.name}` : current.name;
          a.click();
        }
        return;
      }

      // Fallback for other document formats
      const a = document.createElement('a');
      a.href = current.dataUrl;
      a.download = current.name;
      a.click();
    } finally {
      setIsExportingMarked(false);
    }
  };

  const handleExactTapStamp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !onUpdateAnnotations || !activeStamp) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(2, Math.min(98, Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(2))));
    const y = Math.max(0.5, Math.min(99.5, Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(2))));
    onUpdateAnnotations(current.id, [...currentPins, { stamp: activeStamp, x, y }]);
  };

  const handleRemovePin = (e: React.MouseEvent, pinIdx: number) => {
    e.stopPropagation();
    if (readOnly || !onUpdateAnnotations) return;
    onUpdateAnnotations(
      current.id,
      currentPins.filter((_, idx) => idx !== pinIdx)
    );
  };

  const renderOverlayPins = () =>
    currentPins.map((pin, pIdx) => {
      const leftPct = typeof pin.x === 'number' ? pin.x : 88;
      const topPct =
        typeof pin.y === 'number'
          ? pin.y
          : typeof pin.lineIndex === 'number'
          ? Math.min(96, 6 + pin.lineIndex * 5)
          : 15;
      const isScore = isTotalScoreStamp(pin.stamp);
      const isSymbol = pin.stamp === '✓' || pin.stamp === '✓✓' || pin.stamp === '✗';
      return (
        <span
          key={pIdx}
          onClick={(e) => handleRemovePin(e, pIdx)}
          title={readOnly ? pin.stamp : 'Tap mark to remove'}
          style={{ left: `${leftPct}%`, top: `${topPct}%` }}
          className={`-translate-x-1/2 -translate-y-1/2 absolute z-10 inline-flex items-center justify-center font-black text-red-600 select-none leading-none ${
            isScore
              ? 'px-5 py-2 rounded-full border-[3px] border-red-600 bg-white/95 text-3xl tracking-tight shadow-sm -rotate-3'
              : `[text-shadow:0_0_3px_#fff,0_0_2px_#fff] ${isSymbol ? 'text-xl' : 'text-sm tracking-tight'}`
          } ${readOnly ? 'pointer-events-none' : 'cursor-pointer hover:scale-125 transition-transform'}`}
        >
          {pin.stamp}
        </span>
      );
    });

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
            <button
              type="button"
              disabled={isExportingMarked}
              onClick={() => handleDownloadOrOpenMarked('download')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md cursor-pointer disabled:opacity-50"
              title="Download marked script with red-ink stamps"
            >
              <Download className="w-3 h-3" />
              <span>{isExportingMarked ? 'Preparing...' : currentPins.length > 0 ? 'Download Marked' : 'Download'}</span>
            </button>
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

        {!readOnly && onSelectStamp && onUpdateAnnotations && (
          <div className="px-3 py-1.5 bg-rose-50/80 border-b border-rose-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold text-rose-900 mr-1">Red-Ink Mark:</span>
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
  <div className="inline-flex items-center gap-1.5 ml-1 pl-2 border-l border-rose-300">
    <span className="text-[10px] font-bold text-rose-950">Total Score:</span>
    <input
      type="text"
      value={customScoreStamp}
      onChange={(e) => {
        const val = e.target.value;
        setCustomScoreStamp(val);
        if (val.trim()) onSelectStamp(val.trim());
      }}
      placeholder="e.g. 34%"
      className="w-20 px-1.5 py-0.5 text-[11px] font-black text-red-700 bg-white border border-red-400 rounded text-center focus:outline-none focus:border-red-600"
    />
    <button
      type="button"
      disabled={!customScoreStamp.trim()}
      onClick={() => {
        const val = customScoreStamp.trim();
        if (val) onSelectStamp(val);
      }}
      className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border-2 cursor-pointer disabled:opacity-40 ${
        customScoreStamp.trim() && activeStamp === customScoreStamp.trim()
          ? 'bg-red-600 text-white border-red-800 ring-2 ring-red-300'
          : 'bg-white text-red-600 border-red-600 hover:bg-red-50'
      }`}
    >
      Stamp Score
    </button>
    <button
      type="button"
      disabled={!customScoreStamp.trim()}
      onClick={() => {
        const val = customScoreStamp.trim();
        if (!val) return;
        const withoutOldScore = currentPins.filter((p) => !isTotalScoreStamp(p.stamp));
        onUpdateAnnotations(current.id, [...withoutOldScore, { stamp: val, x: 84, y: 6 }]);
      }}
      className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:opacity-40"
    >
      Place Top-Right
    </button>
  </div>
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

        <div
          className={`p-3 bg-white overflow-y-auto ${
            isExpanded ? 'flex-1' : 'max-h-[480px]'
          }`}
        >
          {isLoading ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-500">
              Rendering {current.name} pages as-is...
            </div>
          ) : parsedContent?.kind === 'image' ? (
            <div className="space-y-1.5">
              {!readOnly && (
                <p className="text-[10px] font-semibold text-slate-500">
                  Tap the exact spot on the photo to place ({activeStamp}). Tap a placed mark to remove it.
                </p>
              )}
              <div
                onClick={handleExactTapStamp}
                className={`relative inline-block max-w-full border border-slate-300 rounded-lg overflow-hidden bg-slate-50 ${
                  readOnly ? '' : 'cursor-crosshair'
                }`}
              >
                <img
                  src={current.dataUrl}
                  alt={current.name}
                  className="max-h-[560px] w-auto object-contain block"
                />
                {renderOverlayPins()}
              </div>
            </div>

          ) : parsedContent?.kind === 'pdf-pages' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 border border-indigo-200 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] font-bold text-indigo-900">
                  {parsedContent.pages.length > 0
                    ? `PDF (${parsedContent.pages.length}${
                        parsedContent.totalPages > parsedContent.pages.length
                          ? ` of ${parsedContent.totalPages}`
                          : ''
                      } Pages) · ${
                        !readOnly
                          ? `Tap exact spot to place (${activeStamp}) · Tap mark to remove`
                          : 'Marked Script'
                      }`
                    : 'PDF Document'}
                </span>
                <button
                  type="button"
                  disabled={isExportingMarked}
                  onClick={() => handleDownloadOrOpenMarked('open')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{isExportingMarked ? 'Preparing...' : currentPins.length > 0 ? 'Open Marked PDF' : 'Open Full PDF'}</span>
                </button>
              </div>

              {parsedContent.pages.length > 0 ? (
                <div
                  onClick={handleExactTapStamp}
                  className={`relative border border-slate-300 rounded-lg bg-slate-200/70 p-2 space-y-3 ${
                    readOnly ? '' : 'cursor-crosshair'
                  }`}
                >
                  {parsedContent.pages.map((pageUrl, pageIdx) => (
                    <div
                      key={pageIdx}
                      className="relative bg-white rounded shadow-sm border border-slate-300 overflow-hidden"
                    >
                      <div className="px-2 py-0.5 bg-slate-100 border-b border-slate-200 text-[9px] font-bold text-slate-500">
                        Page {pageIdx + 1} of {parsedContent.totalPages}
                      </div>
                      <img
                        src={pageUrl}
                        alt={`${current.name} - Page ${pageIdx + 1}`}
                        className="w-full h-auto block select-none"
                      />
                    </div>
                  ))}
                  {renderOverlayPins()}
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-700">
                  {parsedContent.fallbackMessage}
                </div>
              )}
            </div>
          ) : parsedContent?.kind === 'slides' ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <Presentation className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  Presentation ({parsedContent.slides.length} Slides)
                  {!readOnly ? ` · Tap the exact spot on any slide to stamp (${activeStamp})` : ''}
                </span>
              </p>
              <div
                onClick={handleExactTapStamp}
                className={`relative space-y-3 p-2 rounded-lg border border-slate-300 bg-slate-50/50 ${
                  readOnly ? '' : 'cursor-crosshair'
                }`}
              >
                {parsedContent.slides.map((slide, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-3 rounded-lg border border-slate-200 bg-white space-y-1 shadow-2xs"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                      {slide.title}
                    </span>
                    {slide.lines.map((l, lIdx) => (
                      <p key={lIdx} className="text-xs text-slate-800 leading-relaxed">
                        {l}
                      </p>
                    ))}
                  </div>
                ))}
                {renderOverlayPins()}
              </div>
            </div>
          ) : parsedContent?.kind === 'table' ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {parsedContent.sheetName}
                  {!readOnly ? ` · Tap the exact cell/spot to stamp (${activeStamp})` : ''}
                </span>
              </p>
              <div
                onClick={handleExactTapStamp}
                className={`relative overflow-x-auto border border-slate-300 rounded-lg bg-white ${
                  readOnly ? '' : 'cursor-crosshair'
                }`}
              >
                <table className="min-w-full text-xs divide-y divide-slate-200">
                  <tbody className="divide-y divide-slate-100">
                    {parsedContent.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={rIdx === 0 ? 'bg-slate-100 font-bold text-slate-900' : 'bg-white'}
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-2.5 py-1.5 border-r border-slate-100 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {renderOverlayPins()}
              </div>
            </div>
          ) : parsedContent?.kind === 'lines' ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span>{parsedContent.label}</span>
                {!readOnly && <span>Tap exact spot on paper to place ({activeStamp}) · Tap mark to remove</span>}
              </div>
              <div
                onClick={handleExactTapStamp}
                className={`relative border border-slate-300 rounded-lg bg-white p-4 shadow-2xs space-y-2.5 ${
                  readOnly ? '' : 'cursor-crosshair'
                }`}
              >
                {parsedContent.lines.map((line, lIdx) => (
                  <p
                    key={lIdx}
                    className="text-xs text-slate-900 whitespace-pre-wrap leading-relaxed font-sans"
                  >
                    {line}
                  </p>
                ))}
                {renderOverlayPins()}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
