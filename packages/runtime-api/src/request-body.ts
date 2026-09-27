import type {IncomingMessage} from 'node:http';

export const DEFAULT_MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export function configuredUploadLimit(value = process.env.CMENG_MAX_UPLOAD_BYTES): number {
  if (value === undefined || value.trim() === '') return DEFAULT_MAX_UPLOAD_BYTES;
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error('CMENG_MAX_UPLOAD_BYTES must be a positive whole number of bytes.');
  }
  return bytes;
}

export class UploadTooLargeError extends Error {
  readonly statusCode = 413;
  readonly code = 'UPLOAD_TOO_LARGE';
  constructor(readonly limitBytes: number, readonly fileBytes: number | null) {
    const limit = (limitBytes / 1024 / 1024).toLocaleString('en', {maximumFractionDigits: 1});
    const size = fileBytes === null ? 'This file' : 'This file (' + (fileBytes / 1024 / 1024).toFixed(1) + ' MB)';
    super(size + ' exceeds the ' + limit + ' MB upload limit. It has not been imported.');
  }
}

export async function readRequestBody(
  req: IncomingMessage,
  onProgress?: (receivedBytes: number, totalBytes: number | null) => void,
  limit = configuredUploadLimit(),
): Promise<Uint8Array> {
  const declared = Number(req.headers['content-length']);
  const totalBytes = Number.isSafeInteger(declared) && declared > 0 ? declared : null;
  if (totalBytes !== null && totalBytes > limit) {
    req.resume();
    throw new UploadTooLargeError(limit, totalBytes);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  // Preserve the socket when rejecting a chunked upload so the caller can send
  // a readable 413 response instead of the browser seeing a network failure.
  for await (const chunk of req.iterator({destroyOnReturn: false})) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > limit) {
      req.resume();
      throw new UploadTooLargeError(limit, totalBytes);
    }
    chunks.push(buffer);
    onProgress?.(total, totalBytes);
  }
  return Buffer.concat(chunks, total);
}
