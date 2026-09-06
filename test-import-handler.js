import { applyNativeCors, assertSameOrigin, AuthError, sendAuthError } from './auth-service.js';
import {
  createTestImport,
  deleteTestImport,
  listTestImports,
  previewTestImport,
} from './test-import-service.js';
import { withApiObservability } from './api-observability.js';

const maxRequestBytes = 4.25 * 1024 * 1024;
const previewWindowMs = 10 * 60 * 1000;
const maxPreviewsPerWindow = 6;
const previewWindows = new Map();

function enforcePreviewRateLimit(request) {
  const forwarded = String(request.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const key = forwarded || request.socket?.remoteAddress || 'local-preview';
  const now = Date.now();
  const window = previewWindows.get(key);
  if (!window || now - window.startedAt >= previewWindowMs) {
    previewWindows.set(key, { startedAt: now, count: 1 });
    return;
  }
  window.count += 1;
  if (window.count > maxPreviewsPerWindow) {
    throw new AuthError(429, 'PREVIEW_RATE_LIMITED', 'Too many demo extractions. Wait a few minutes and try again.');
  }
}

async function readImportBody(request) {
  if (request.body && typeof request.body === 'object') {
    if (Buffer.byteLength(JSON.stringify(request.body)) > maxRequestBytes) throw new AuthError(413, 'BODY_TOO_LARGE', 'The upload request is too large.');
    return request.body;
  }
  if (typeof request.body === 'string') {
    if (Buffer.byteLength(request.body) > maxRequestBytes) throw new AuthError(413, 'BODY_TOO_LARGE', 'The upload request is too large.');
    try { return JSON.parse(request.body); } catch { throw new AuthError(400, 'INVALID_JSON', 'The upload request is invalid.'); }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) throw new AuthError(413, 'BODY_TOO_LARGE', 'The upload request is too large.');
    chunks.push(chunk);
  }
  try { return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; } catch { throw new AuthError(400, 'INVALID_JSON', 'The upload request is invalid.'); }
}

async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (applyNativeCors(request, response)) return;
  try {
    if (request.method === 'GET') {
      return response.status(200).json({ imports: await listTestImports(request, request.query || {}) });
    }
    assertSameOrigin(request);
    if (request.method === 'POST') {
      if (request.query?.action === 'preview') {
        enforcePreviewRateLimit(request);
        return response.status(200).json({ testImport: await previewTestImport(await readImportBody(request)) });
      }
      return response.status(201).json({ testImport: await createTestImport(request, await readImportBody(request)) });
    }
    if (request.method === 'DELETE') {
      await deleteTestImport(request, request.query?.id);
      return response.status(200).json({ deleted: true });
    }
    return response.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return sendAuthError(response, error);
  }
}

export default withApiObservability('test-imports', handler);
