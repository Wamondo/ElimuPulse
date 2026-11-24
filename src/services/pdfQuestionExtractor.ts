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

  // Match PDF text objects BT ... ET
  const btEtRegex = /BT\b([\s\S]*?)\bET\b/g;
  let btMatch: RegExpExecArray | null;
  let foundAnyBt = false;

  while ((btMatch = btEtRegex.exec(latin1)) !== null) {
    foundAnyBt = true;
    const block = btMatch[1];
    let currentLine = '';

    // Track line breaks via Td / TD / T* / T"
    const tokenRegex = /\((?:\\.|[^\\() Sabotage])*?\)|\[(?:[\s\S]*?)\]|\/[A-Za-z0-9.+-]+\s+[-0-9.]+\s+Td|\/[A-Za-z0-9.+-]+\s+[-0-9.]+\s+TD|\bT\*\b|\bTj\b|\bTJ\b|[-0-9.]+\s+[-0-9.]+\s+Td|[-0-9.]+\s+[-0-9.]+\s+TD/g;
    const tokens = block.match(/\((?:\\.|[^\\()])*\)|\[(?:\\.|[^\\[\]])*\]|[A-Za-z*']+|[-+]?\d*\.?\d+/g) || [];

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

  if (foundAnyBt && lines.length > 0) {
    return lines.join('\n');
  }

  // Fallback: extract printable text runs from raw bytes
  const cleaned = latin1
    .replace(/[^\x20-\x7E\r\n]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return cleaned;
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

  // Scan stream ... endstream blocks
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
      if (text && /[A-Za-z0-9]{2,}/.test(text)) {
        collected.push(text);
      }
    }

    streamHeaderRegex.lastIndex = endIdx + 9;
  }

  if (collected.length > 0) {
    return collected.join('\n\n');
  }

  return extractTextFromContentStream(bytes);
}

function normalizeExtractedText(raw: string): string {
  let text = raw.replace(/\r\n?/g, '\n');

  // Separate inline MCQ options A. ... B. ... C. ... D. ... onto clean lines while keeping order
  text = text.replace(/([^\n])\s+([A-D])\s*[.)]\s+/g, '$1\n$2. ');

  // Separate inline question numbers if glued after punctuation or newlines
  text = text.replace(/([?.!;:])\s+(?:Question\s+|Q\.?\s*)?(\d{1,3})\s*[.)]\s+(?=[A-Z])/gi, '$1\n$2. ');

  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
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
    // Ignore obvious running headers/footers like "Page 1 of 3"
    if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(line)) continue;

    const qMatch = line.match(qStartRegex);
    if (qMatch) {
      const num = parseInt(qMatch[1], 10);
      const rest = qMatch[2].trim();
      // Avoid treating decimal numbers like "2.5 cm" as new questions unless sequential or at start
      const isPlausibleNext =
        !current ||
        num === current.num + 1 ||
        num === 1 ||
        /^(?:Question|Q\.?)\s*\d+/i.test(line) ||
        line.endsWith('?') ||
        rest.length > 18;

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

  // Keep original sequence order (Question 1, Question 2, Question 3...)
  blocks.sort((a, b) => a.num - b.num);

  return blocks.map((block, index) => {
    const optionsMap: Record<'A' | 'B' | 'C' | 'D', string> = {
      A: '',
      B: '',
      C: '',
      D: '',
    };
    const promptParts: string[] = [];
    let detectedCorrect: 'A' | 'B' | 'C' | 'D' = 'A';
    let lastOptionKey: 'A' | 'B' | 'C' | 'D' | null = null;
    let hasAnyOption = false;

    for (const rawLine of block.lines) {
      const ansMatch = rawLine.match(ansHintRegex);
      if (ansMatch) {
        detectedCorrect = ansMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
        continue;
      }

      const optMatch = rawLine.match(optRegex);
      if (optMatch) {
        const key = optMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
        optionsMap[key] = optMatch[2].trim();
        lastOptionKey = key;
        hasAnyOption = true;
      } else if (lastOptionKey && rawLine.length < 140 && !rawLine.endsWith('?')) {
        optionsMap[lastOptionKey] = `${optionsMap[lastOptionKey]} ${rawLine}`.trim();
      } else {
        lastOptionKey = null;
        promptParts.push(rawLine);
      }
    }

    const combinedPrompt = promptParts.join(' ').trim() || `Question ${block.num}`;
    const isMcq = hasAnyOption && Boolean(optionsMap.A || optionsMap.B);
    const { cleaned: finalPrompt, marks } = extractMarksFromText(
      combinedPrompt,
      isMcq ? 2 : 5
    );

    const qItem: AssignmentQuestion = {
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
    };

    return qItem;
  });
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
