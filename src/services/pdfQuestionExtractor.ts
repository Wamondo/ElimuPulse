import type { AssignmentQuestion } from './assignmentService';

export interface ExtractedPdfResult {
  questions: AssignmentQuestion[];
  suggestedTitle?: string;
  rawTextPreview: string;
  extractedCount: number;
  usedOcr?: boolean;
}

export interface PdfExtractionProgress {
  stage: 'text' | 'ocr';
  message: string;
}

function decodePdfLiteralString(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function extractTextFromContentStream(streamBytes: Uint8Array): string {
  const latin1 = new TextDecoder('latin1').decode(streamBytes);
  const lines: string[] = [];

  const btEtRegex = /BT\b([\s\S]*?)\bET\b/g;
  let btMatch: RegExpExecArray | null;

  while ((btMatch = btEtRegex.exec(latin1)) !== null) {
    const block = btMatch[1];
    let currentLine = '';
    const tokens =
      block.match(/\((?:\\.|[^\\()])*\)|\[(?:\\.|[^\\[\]])*\]|[A-Za-z*']+|[-+]?\d*\.?\d+/g) || [];

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.startsWith('(') && tok.endsWith(')')) {
        const nextTok = tokens[i + 1];
        if (nextTok === 'Tj' || nextTok === "'" || nextTok === '"') {
          if (tok === "'" || nextTok === "'") currentLine += '\n';
          currentLine += decodePdfLiteralString(tok.slice(1, -1));
        }
      } else if (tok.startsWith('[') && tok.endsWith(']')) {
        const nextTok = tokens[i + 1];
        if (nextTok === 'TJ') {
          const innerStrs = tok.match(/\((?:\\.|[^\\()])*\)/g) || [];
          for (const s of innerStrs) {
            currentLine += decodePdfLiteralString(s.slice(1, -1));
          }
        }
      } else if (tok === 'T*' || tok === 'Td' || tok === 'TD') {
        if (currentLine && !currentLine.endsWith('\n')) {
          currentLine += '\n';
        }
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
  }

  return lines.join('\n');
}

async function decompressFlate(
  bytes: Uint8Array,
  formats: ReadonlyArray<'deflate' | 'deflate-raw'> = ['deflate', 'deflate-raw']
): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  for (const fmt of formats) {
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

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

async function extractTextFromDocxBuffer(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder('utf-8');

  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;

    const method = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > bytes.length) break;

    const entryName = decoder.decode(bytes.slice(nameStart, nameStart + nameLen));
    if (entryName === 'word/document.xml') {
      const slice = bytes.slice(dataStart, dataEnd);
      let xmlBytes: Uint8Array | null = null;
      if (method === 0) {
        xmlBytes = slice;
      } else if (method === 8) {
        xmlBytes = await decompressFlate(slice, ['deflate-raw', 'deflate']);
      }

      if (xmlBytes) {
        const xml = decoder.decode(xmlBytes);
        const paragraphs = xml.split(/<w:p\b[^>]*>/g).slice(1);
        const lines: string[] = [];
        for (const p of paragraphs) {
          const withBreaks = p
            .replace(/<w:tab\b[^>]*\/?>/g, ' ')
            .replace(/<w:br\b[^>]*\/?>/g, '\n');
          const texts = Array.from(withBreaks.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)).map((m) =>
            decodeXmlEntities(m[1])
          );
          const line = texts.join('').trim();
          if (line) lines.push(line);
        }
        return lines.join('\n');
      }
      break;
    }

    offset = dataEnd;
  }

  return '';
}

function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isPngBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

async function extractEmbeddedImageBlobsFromPdf(buffer: ArrayBuffer): Promise<Blob[]> {
  const bytes = new Uint8Array(buffer);
  const latin1 = new TextDecoder('latin1').decode(bytes);
  const blobs: Blob[] = [];
  const streamHeaderRegex = /stream\r?\n/g;
  let match: RegExpExecArray | null;

  while ((match = streamHeaderRegex.exec(latin1)) !== null) {
    const startIdx = match.index + match[0].length;
    const endIdx = latin1.indexOf('endstream', startIdx);
    if (endIdx === -1) break;

    let trimEnd = endIdx;
    if (latin1[trimEnd - 1] === '\n') trimEnd--;
    if (latin1[trimEnd - 1] === '\r') trimEnd--;

    const dictBefore = latin1.slice(Math.max(0, match.index - 450), match.index);
    const streamSlice = bytes.slice(startIdx, trimEnd);

    if (/\/DCTDecode\b/.test(dictBefore) && isJpegBytes(streamSlice)) {
      blobs.push(new Blob([streamSlice], { type: 'image/jpeg' }));
    } else if (isPngBytes(streamSlice)) {
      blobs.push(new Blob([streamSlice], { type: 'image/png' }));
    } else if (/\/FlateDecode\b/.test(dictBefore)) {
      const inflated = await decompressFlate(streamSlice);
      if (inflated) {
        if (isJpegBytes(inflated)) {
          blobs.push(new Blob([inflated], { type: 'image/jpeg' }));
        } else if (isPngBytes(inflated)) {
          blobs.push(new Blob([inflated], { type: 'image/png' }));
        }
      }
    }

    streamHeaderRegex.lastIndex = endIdx + 9;
    if (blobs.length >= 12) break;
  }

  return blobs;
}

async function runOcrOnImageSources(
  sources: Array<Blob | File>,
  onProgress?: (info: PdfExtractionProgress) => void
): Promise<string> {
  if (typeof window === 'undefined' || sources.length === 0) return '';

  onProgress?.({ stage: 'ocr', message: 'Loading OCR engine...' });
  let worker: Awaited<ReturnType<Awaited<typeof import('tesseract.js')>['createWorker']>> | null = null;
  try {
    const modName = 'tesseract.js';
    const Tesseract = (await import(/* @vite-ignore */ modName)) as typeof import('tesseract.js');
    worker = await Tesseract.createWorker('eng');
  } catch {
    onProgress?.({
      stage: 'ocr',
      message: 'OCR package not available; skipping image OCR.',
    });
    return '';
  }

  const pageTexts: string[] = [];
  try {
    for (let i = 0; i < sources.length; i++) {
      onProgress?.({
        stage: 'ocr',
        message:
          sources.length === 1
            ? 'Running OCR on picture...'
            : `Running OCR on page/image ${i + 1} of ${sources.length}...`,
      });
      const { data } = await worker.recognize(sources[i]);
      if (data?.text?.trim()) {
        pageTexts.push(data.text.trim());
      }
    }
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }

  return pageTexts.join('\n\n');
}

async function extractRawTextFromPdfArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const latin1 = new TextDecoder('latin1').decode(bytes);
  const collected: string[] = [];

  const streamHeaderRegex = /stream\r?\n/g;
  let match: RegExpExecArray | null;

  while ((match = streamHeaderRegex.exec(latin1)) !== null) {
    const startIdx = match.index + match[0].length;
    const endIdx = latin1.indexOf('endstream', startIdx);
    if (endIdx === -1) break;

    let trimEnd = endIdx;
    if (latin1[trimEnd - 1] === '\n') trimEnd--;
    if (latin1[trimEnd - 1] === '\r') trimEnd--;

    const dictBefore = latin1.slice(Math.max(0, match.index - 400), match.index);
    const streamSlice = bytes.slice(startIdx, trimEnd);
    const isFlate = /\/FlateDecode\b/.test(dictBefore);

    let decodedBytes: Uint8Array | null = streamSlice;
    if (isFlate) {
      const inflated = await decompressFlate(streamSlice);
      if (inflated && inflated.length > 0) {
        decodedBytes = inflated;
      }
    }

    if (decodedBytes && decodedBytes.length > 0) {
      const text = extractTextFromContentStream(decodedBytes);
      if (text && /[A-Za-z]{2,}/.test(text)) {
        collected.push(text);
      }
    }

    streamHeaderRegex.lastIndex = endIdx + 9;
  }

  return collected.join('\n\n');
}

function isPdfGarbageLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return true;

  if (
    /\b(endobj|endstream|FlateDecode|FontDescriptor|CIDFont|ToUnicode|Type0|Type1|TrueType|Encoding|WinAnsiEncoding|MacRomanEncoding|BaseFont|StemV|ItalicAngle|FontBBox|CapHeight|Ascent|Descent|XHeight|Leading|WMode|DW|Adobe|Acrobat|Foxit|Ghostscript|Arial|Calibri|Cambria|TimesNewRoman|LucidaCalligraphy)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }

  const words = trimmed.split(/\s+/);
  const longestWord = words.reduce((m, w) => Math.max(m, w.length), 0);
  if (longestWord > 26 && !/https?:\/\//i.test(trimmed)) {
    return true;
  }

  const letterCount = (trimmed.match(/[A-Za-z]/g) || []).length;
  const symbolCount = (trimmed.match(/[^A-Za-z0-9\s.,?!()\-+=/×÷=<>%:'";]/g) || []).length;
  if (letterCount < 2) return true;
  if (symbolCount > Math.max(2, trimmed.length * 0.22)) return true;

  return false;
}


function isExamInstructionLine(line: string): boolean {
  return /^(?:this\s+paper\s+consists|ensure\s+you\s+check|answer\s+all\s+(?:the\s+)?questions|instructions?\s*:|time\s+allowed|read\s+the\s+following\s+instructions|do\s+not\s+write\s+on\s+this\s+question\s+paper|candidates?\s+should\s+answer)/i.test(
    line.trim()
  );
}

function detectDocumentTitle(normalizedText: string, fileName: string): string | undefined {
  const lines = normalizedText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const qStartRegex = /^(?:Question\s+|Q\.?\s*)?(\d{1,3})\s*[.)\-:]\s+(.+)$/i;

  for (const line of lines.slice(0, 8)) {
    if (qStartRegex.test(line)) break;
    if (isExamInstructionLine(line)) continue;
    if (/^page\s+\d+/i.test(line)) continue;
    if (line.length >= 4 && line.length <= 95 && /[A-Za-z]{3,}/.test(line)) {
      return line.replace(/\s{2,}/g, ' ').trim();
    }
  }

  const cleanFileTitle = fileName
    .replace(/\.(pdf|docx?|txt|md|jpe?g|png|webp|gif|bmp)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (
    cleanFileTitle &&
    !/^(doc|document|scan|scanned|file|untitled|download|whatsapp\s+document|img|image|photo)(\s*\d+)?$/i.test(
      cleanFileTitle
    )
  ) {
    return cleanFileTitle;
  }

  return undefined;
}

function normalizeExtractedText(raw: string): string {
  let text = raw.replace(/\r\n?/g, '\n');
  text = text.replace(/([^\n])\s+([A-D])\s*[.)]\s+/g, '$1\n$2. ');

  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => !isPdfGarbageLine(line))
    .filter((line) => !isExamInstructionLine(line))
    .join('\n');
}

function extractMarksFromText(input: string, fallback: number): { cleaned: string; marks: number } {
  let marks = fallback;
  const cleaned = input
    .replace(/[\[(]\s*(\d{1,2})\s*(?:marks?|mks?|pts?|points?)\s*[\])]/gi, (_, n) => {
      const parsed = parseInt(n, 10);
      if (parsed > 0 && parsed <= 50) marks = parsed;
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { cleaned, marks };
}

function parseQuestionsFromNormalizedText(normalized: string): AssignmentQuestion[] {
  const lines = normalized.split('\n');
  const qStartRegex = /^(?:Question\s+|Q\.?\s*)?(\d{1,3})\s*[.)\-:]\s+(.+)$/i;
  const optRegex = /^[\[(]?([A-D])[\])).:]\s*(.+)$/i;
  const ansHintRegex = /^(?:Answer|Ans|Correct(?:\s+Option)?)\s*[:=-]\s*([A-D])\b/i;

  interface RawBlock {
    num: number;
    lines: string[];
  }

  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;

  for (const line of lines) {
    if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(line)) continue;

    const qMatch = line.match(qStartRegex);
    if (qMatch) {
      const num = parseInt(qMatch[1], 10);
      const rest = qMatch[2].trim();
      if (isPdfGarbageLine(rest) || isExamInstructionLine(rest)) continue;

      const isPlausibleNext =
        !current ||
        num === current.num + 1 ||
        num === 1 ||
        /^(?:Question|Q\.?)\s*\d+/i.test(line);

      if (isPlausibleNext && num >= 1 && num <= 200) {
        if (current) blocks.push(current);
        current = { num, lines: [rest] };
        continue;
      }
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current) blocks.push(current);
  blocks.sort((a, b) => a.num - b.num);

  return blocks
    .map((block, index) => {
      const optionsMap: Record<'A' | 'B' | 'C' | 'D', string> = {
        A: '',
        B: '',
        C: '',
        D: '',
      };
      const promptParts: string[] = [];
      let detectedCorrect: 'A' | 'B' | 'C' | 'D' = 'A';
      let lastOptionKey: 'A' | 'B' | 'C' | 'D' | null = null;
      let validOptionCount = 0;

      for (const rawLine of block.lines) {
        if (isPdfGarbageLine(rawLine) || isExamInstructionLine(rawLine)) continue;

        const ansMatch = rawLine.match(ansHintRegex);
        if (ansMatch) {
          detectedCorrect = ansMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
          continue;
        }

        const optMatch = rawLine.match(optRegex);
        if (optMatch) {
          const key = optMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
          const optVal = optMatch[2].trim();
          if (!isPdfGarbageLine(optVal)) {
            optionsMap[key] = optVal;
            lastOptionKey = key;
            validOptionCount++;
          }
        } else if (lastOptionKey && rawLine.length < 140 && !rawLine.endsWith('?')) {
          optionsMap[lastOptionKey] = `${optionsMap[lastOptionKey]} ${rawLine}`.trim();
        } else {
          lastOptionKey = null;
          promptParts.push(rawLine);
        }
      }

      const combinedPrompt = promptParts.join(' ').trim();
      if (!combinedPrompt || combinedPrompt.length < 3) return null;

      const isMcq = validOptionCount >= 2 && Boolean(optionsMap.A && optionsMap.B);
      const { cleaned: finalPrompt, marks } = extractMarksFromText(
        combinedPrompt,
        isMcq ? 2 : 5
      );

      return {
        id: `q-${Date.now()}-${block.num || index + 1}-${Math.random().toString(36).slice(2, 5)}`,
        prompt: finalPrompt,
        type: isMcq ? 'mcq' : 'text',
        marks,
        ...(isMcq
          ? {
              options: optionsMap,
              correctOption: detectedCorrect,
            }
          : {}),
      } satisfies AssignmentQuestion;
    })
    .filter((q): q is AssignmentQuestion => Boolean(q));
}

export async function extractQuestionsFromPdfFile(
  file: File,
  onProgress?: (info: PdfExtractionProgress) => void
): Promise<ExtractedPdfResult> {
  const lowerName = file.name.toLowerCase();
  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(lowerName);
  const isDocx =
    lowerName.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isPlainText = lowerName.endsWith('.txt') || lowerName.endsWith('.md') || file.type.startsWith('text/');

  let normalized = '';
  let usedOcr = false;

  if (isImage) {
    const ocrText = await runOcrOnImageSources([file], onProgress);
    usedOcr = Boolean(ocrText.trim());
    normalized = normalizeExtractedText(ocrText);
  } else if (isDocx) {
    onProgress?.({ stage: 'text', message: 'Reading Word document...' });
    const buffer = await file.arrayBuffer();
    const docText = await extractTextFromDocxBuffer(buffer);
    normalized = normalizeExtractedText(docText);
  } else if (isPlainText) {
    onProgress?.({ stage: 'text', message: 'Reading text document...' });
    const rawText = await file.text();
    normalized = normalizeExtractedText(rawText);
  } else {
    const buffer = await file.arrayBuffer();
    onProgress?.({ stage: 'text', message: 'Reading PDF text layer...' });
    const rawExtracted = await extractRawTextFromPdfArrayBuffer(buffer);
    normalized = normalizeExtractedText(rawExtracted);
    let questionsCheck = parseQuestionsFromNormalizedText(normalized);

    if (questionsCheck.length === 0) {
      const imageBlobs = await extractEmbeddedImageBlobsFromPdf(buffer);
      const ocrText = await runOcrOnImageSources(imageBlobs, onProgress);
      if (ocrText.trim()) {
        usedOcr = true;
        normalized = normalizeExtractedText(ocrText);
        questionsCheck = parseQuestionsFromNormalizedText(normalized);
      }
    }
  }


  const questions = parseQuestionsFromNormalizedText(normalized);
  const suggestedTitle = detectDocumentTitle(normalized, file.name);

  return {
    questions,
    suggestedTitle,
    rawTextPreview: normalized.slice(0, 1200),
    extractedCount: questions.length,
    usedOcr,
  };
}
