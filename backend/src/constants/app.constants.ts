export const APP = {
  NAME: 'Legal Vault Backend',
  VERSION: '1.0.0',
} as const;

export const API = {
  PREFIX: '/api',
  VERSION: 'v1',
  BASE_PATH: '/api/v1',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const ERROR_MESSAGES = {
  INTERNAL_SERVER: 'An unexpected error occurred. Please try again later.',
  NOT_FOUND: 'The requested resource was not found.',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later.',
} as const;

export const CASE_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const LEGAL_INGEST_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
] as const;

export const sanitizeDownloadFilename = (input: string): string =>
  input.replace(/[\r\n"]/g, '_').replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 180) || 'download.bin';

