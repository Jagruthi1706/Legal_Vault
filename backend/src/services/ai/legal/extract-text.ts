import { createHash } from 'crypto';
import { inflateSync } from 'zlib';
import { AppError } from '../../../utils/AppError';
import { HTTP_STATUS, LEGAL_INGEST_MIME_TYPES } from '../../../constants/app.constants';

const isAllowedLegalMime = (mime: string): boolean =>
  (LEGAL_INGEST_MIME_TYPES as readonly string[]).includes(mime);

export const deterministicLegalId = (sourceUrl: string, title: string): string =>
  `legal-${createHash('sha256').update(`${sourceUrl}::${title}`).digest('hex').slice(0, 16)}`;

export const extractLegalDocumentText = (buffer: Buffer, mimeType: string, fileName: string): string => {
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (!isAllowedLegalMime(mime) && !name.endsWith('.txt') && !name.endsWith('.md') && !name.endsWith('.pdf')) {
    throw new AppError('Unsupported legal ingest type. Use PDF or UTF-8 text.', HTTP_STATUS.BAD_REQUEST);
  }

  if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    const text = buffer.toString('utf8').trim();
    if (!text) throw new AppError('Legal ingest file was empty.', HTTP_STATUS.BAD_REQUEST);
    return text;
  }

  return extractPdfText(buffer);
};

/**
 * Minimum extracted text length before a PDF is treated as text-based.
 * Matches the previous extraction threshold.
 */
const MIN_EXTRACTABLE_PDF_TEXT = 20;

/**
 * Parenthesized PDF string literals, e.g. the operands of Tj/TJ text operators.
 * Requiring at least 4 characters keeps binary noise out of extracted text.
 */
const PDF_TEXT_LITERAL_RE = /\((?:\\\\.|[^\\\\)]){4,}\)/g;

/** A short heuristic so compressed binary data is never mistaken for text. */
const looksTextual = (text: string): boolean => /[A-Za-z]{4}/.test(text);

/** Collect parenthesized string literals exactly like the previous extractor. */
const extractTextLiterals = (source: string): string[] =>
  [...source.matchAll(PDF_TEXT_LITERAL_RE)]
    .map((match) => match[0].slice(1, -1).replace(/\\n/g, '\n').replace(/\\r/g, '').trim())
    .filter(Boolean);

/**
 * Decode PDF ASCII85-encoded bytes.
 *
 * PDF ASCII85 (Ascii85Decode / A85) encodes binary data as printable characters
 * '!' (33) through 'u' (117). The special token 'z' marks four zero bytes.
 * Stream data is terminated by the two-byte sentinel '~>' which is not part of
 * the decoded output. Partial final groups are padded with 'u' and the
 * corresponding trailing output bytes are discarded.
 *
 * No external dependency: pure implementation matching the PDF spec.
 */
const ascii85Decode = (input: Buffer): Buffer<ArrayBuffer> => {
  const str = input.toString('latin1');
  const clean = str.replace(/\s/g, '');
  const terminator = clean.indexOf('~>');
  const payload = terminator === -1 ? clean : clean.slice(0, terminator);

  const output: number[] = [];
  let i = 0;
  let finalPadding = 0;

  while (i < payload.length) {
    if (payload[i] === 'z') {
      output.push(0, 0, 0, 0);
      i++;
      continue;
    }

    let chunk = payload.slice(i, i + 5);
    let padding = 0;
    if (chunk.length < 5) {
      padding = 5 - chunk.length;
      finalPadding = padding;
      chunk += 'u'.repeat(padding);
    }

    let value = 0;
    for (let j = 0; j < 5; j++) {
      const code = chunk.charCodeAt(j) - 33;
      if (code < 0 || code > 84) {
        throw new Error(`Invalid ASCII85 character: ${String.fromCharCode(chunk.charCodeAt(j))}`);
      }
      value = value * 85 + code;
    }

    output.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);

    i += 5 - padding;
    if (padding > 0) break;
  }

  if (finalPadding > 0) {
    output.splice(-finalPadding, finalPadding);
  }

  return Buffer.from(new Uint8Array(output));
};

/**
 * Decode PDF ASCIIHex-encoded bytes.
 *
 * ASCIIHexDecode (AHx) represents each byte as two hex digits (0-9, A-F, a-f).
 * The stream is terminated by '>'. An odd trailing digit is treated as if
 * padded with a leading 0.
 */
const asciiHexDecode = (input: Buffer): Buffer<ArrayBuffer> => {
  const str = input.toString('latin1');
  const clean = str.replace(/\s/g, '');
  const terminator = clean.indexOf('>');
  const payload = terminator === -1 ? clean : clean.slice(0, terminator);

  const padded = payload.length % 2 === 0 ? payload : `0${payload}`;
  const output: number[] = [];
  for (let i = 0; i < padded.length; i += 2) {
    const byte = parseInt(padded.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error('Invalid ASCIIHex byte');
    }
    output.push(byte);
  }
  return Buffer.from(new Uint8Array(output));
};

/**
 * Normalized PDF stream filter names.
 */
type StreamFilter = 'ascii85' | 'asciihex' | 'flate';

/**
 * Map raw PDF filter name tokens (as they appear in a /Filter dictionary entry)
 * to a normalized internal form. Returns null for unrecognized filters.
 */
const normalizePdfFilterName = (token: string): StreamFilter | null => {
  switch (token) {
    case '/ASCII85Decode':
    case '/A85':
      return 'ascii85';
    case '/ASCIIHexDecode':
    case '/AHx':
      return 'asciihex';
    case '/FlateDecode':
    case '/Fl':
      return 'flate';
    default:
      return null;
  }
};

/**
 * Resolve the ordered filter chain for the stream object that contains the
 * /FlateDecode marker at `flatePosition`.
 *
 * The PDF spec allows /Filter to name either a single filter or an array of
 * filters applied in order (e.g. [ /ASCII85Decode /FlateDecode ]). We walk
 * backward from the /FlateDecode marker to the nearest preceding /Filter
 * dictionary entry, parse its value, and return the ordered, normalized
 * filter list. Filters that precede /FlateDecode (ASCII85, ASCIIHex) must
 * be applied to the raw stream bytes before Flate decompression.
 */
const resolveStreamFilterChain = (raw: string, flatePosition: number): StreamFilter[] => {
  const filterIdx = raw.lastIndexOf('/Filter', flatePosition);
  if (filterIdx === -1) return ['flate'];

  let i = filterIdx + '/Filter'.length;
  const limit = flatePosition;

  while (i < limit && /\s/.test(raw[i])) i++;

  const filters: StreamFilter[] = [];

  if (raw[i] === '[') {
    i++;
    while (i < limit && raw[i] !== ']') {
      while (i < limit && /\s/.test(raw[i])) i++;
      if (raw[i] === '/') {
        let token = '/';
        i++;
        while (i < limit && /[a-zA-Z0-9]/.test(raw[i])) {
          token += raw[i];
          i++;
        }
        const normalized = normalizePdfFilterName(token);
        if (normalized) filters.push(normalized);
      } else if (raw[i] === ']') {
        break;
      } else {
        i++;
      }
    }
  } else if (raw[i] === '/') {
    let token = '/';
    i++;
    while (i < limit && /[a-zA-Z0-9]/.test(raw[i])) {
      token += raw[i];
      i++;
    }
    const normalized = normalizePdfFilterName(token);
    if (normalized) filters.push(normalized);
  }

  return filters.length > 0 ? filters : ['flate'];
};

/**
 * True when the PDF declares any encoded content stream (i.e. a /Filter entry
 * naming Flate, ASCII85 or ASCIIHex). When this is the case, the meaningful
 * document text lives inside those streams and Pass 1 raw extraction would
 * only surface metadata/binary garbage that must not be accepted as text.
 */
const hasEncodedContentStream = (raw: string): boolean =>
  /\/Filter\s*(\[|\/(?:Fl(?:ateDecode)?|ASCII85Decode|A85|ASCIIHexDecode|AHx))/.test(raw);

/**
 * Decompress every /FlateDecode (or abbreviated /Fl) stream found in a PDF,
 * correctly honoring the stream's /Filter chain.
 */
const decompressFlateDecodedStreams = (raw: string): string[] => {
  const decompressed: string[] = [];
  const flateRe = /\/Fl(?:ateDecode)?/g;
  let match: RegExpExecArray | null;
  while ((match = flateRe.exec(raw)) !== null) {
    const matchIndex = match.index;
    const filterChain = resolveStreamFilterChain(raw, matchIndex);

    const tail = raw.slice(matchIndex);
    const streamLeader = /stream[\r\n]+/.exec(tail);
    if (!streamLeader) continue;
    const dataStart = matchIndex + streamLeader.index + streamLeader[0].length;
    const endIndex = raw.indexOf('endstream', dataStart);
    if (endIndex === -1) continue;
    const rawData = raw.slice(dataStart, endIndex).replace(/[\r\n]+$/, '');
    if (!rawData) continue;

    try {
      let bytes: Buffer<ArrayBuffer> = Buffer.from(rawData, 'latin1') as Buffer<ArrayBuffer>;

      for (const filter of filterChain) {
        if (filter === 'ascii85') {
          bytes = ascii85Decode(bytes);
        } else if (filter === 'asciihex') {
          bytes = asciiHexDecode(bytes);
        }
      }

      decompressed.push(inflateSync(bytes).toString('latin1'));
    } catch {
      // Not a decodable stream (wrong filter, predictor, unsupported variant,
      // or corrupt data). Skip it; other streams may still yield text.
    }
  }
  return decompressed;
};

const extractPdfText = (buffer: Buffer): string => {
  const raw = buffer.toString('latin1');
  if (!raw.startsWith('%PDF')) {
    throw new AppError('File is not a PDF.', HTTP_STATUS.BAD_REQUEST);
  }

  // When the PDF declares an encoded content stream, the meaningful document
  // text lives inside that stream -- Pass 1 raw extraction would only surface
  // parenthesized metadata/binary noise that must NOT be accepted as text.
  const encoded = hasEncodedContentStream(raw);

  // Pass 1: uncompressed text literals (existing behavior, preserved verbatim).
  // Only trusted when no encoded content stream is present.
  if (!encoded) {
    const plainText = extractTextLiterals(raw).join('\n').trim();
    if (plainText.length >= MIN_EXTRACTABLE_PDF_TEXT && looksTextual(plainText)) {
      return plainText;
    }
  }

  // Pass 2: compressed/encoded content streams.
  const decompressedParts = decompressFlateDecodedStreams(raw);
  const streamedText = decompressedParts
    .map((part) => extractTextLiterals(part).join('\n'))
    .join('\n')
    .trim();
  if (streamedText.length >= MIN_EXTRACTABLE_PDF_TEXT) {
    return streamedText;
  }

  // Scanned/image-only PDFs (no text layer) and corrupt files reach this point
  // and fail safely: the caller degrades to a transparent metadata-only chunk.
  throw new AppError('PDF did not contain extractable text. Provide a UTF-8 text file instead.', HTTP_STATUS.BAD_REQUEST);
};