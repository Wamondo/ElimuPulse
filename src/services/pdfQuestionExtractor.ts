import type { AssignmentQuestion } from './assignmentService';

export interface ExtractedPdfResult {
  questions: AssignmentQuestion[];
  suggestedTitle?: string;
  rawTextPreview: string;
  extractedCount: number;
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

async function decompressFlate(bytes: Uint8Array): Promise<Uint8Array | null> {
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

  // Known PDF internals / font names / metadata
  if (
    /\b(endobj|endstream|FlateDecode|FontDescriptor|CIDFont|ToUnicode|Type0|Type1|TrueType|Encoding|WinAnsiEncoding|MacRomanEncoding|BaseFont|StemV|ItalicAngle|FontBBox|CapHeight|Ascent|Descent|XHeight|Leading|WMode|DW|Adobe|Acrobat|Foxit|Ghostscript|Arial|Calibri|Cambria|TimesNewRoman|LucidaCalligraphy)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // Long run with no spaces (typically corrupted/encoded font string)
  const words = trimmed.split(/\s+/);
  const longestWord = words.reduce((m, w) => Math.max(m, w.length), 0);
  if (longestWord > 26 && !/https?:\/\//i.test(trimmed)) {
    return true;
  }

  // Ratio of readable letters/digits/basic punctuation vs weird symbols
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
  const qStartRegex = /^(?:Question\s+|Q\.?\s*)?(\d{1,3})\s*[.)]\s+(.+)$/i;
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

      // Only treat as MCQ when at least 2 clean options (including A and B) are present
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


export async function extractQuestionsFromPdfFile(file: File): Promise<ExtractedPdfResult> {
  const buffer = await file.arrayBuffer();
  const rawExtracted = await extractRawTextFromPdfArrayBuffer(buffer);
  const normalized = normalizeExtractedText(rawExtracted);
  const questions = parseQuestionsFromNormalizedText(normalized);

  const cleanTitle = file.name
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    questions,
    suggestedTitle: cleanTitle || undefined,
    rawTextPreview: normalized.slice(0, 1200),
    extractedCount: questions.length,
  };
}
