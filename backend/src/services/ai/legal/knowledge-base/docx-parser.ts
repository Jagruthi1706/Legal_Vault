import * as mammoth from 'mammoth';

export interface DocxExtractionResult {
  text: string;
  messages: Array<{
    type: string;
    message: string;
  }>;
}

export const extractDocxText = async (
  buffer: Buffer,
): Promise<DocxExtractionResult> => {
  if (!buffer || buffer.length === 0) {
    throw new Error('DOCX file is empty.');
  }

  const result = await mammoth.extractRawText({ buffer });

  const text = result.value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();

  if (!text) {
    throw new Error('DOCX did not contain extractable text.');
  }

  return {
    text,
    messages: result.messages,
  };
};