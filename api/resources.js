import { applyNativeCors, assertSameOrigin, AuthError, sendAuthError } from '../auth-service.js';
import {
  createResource,
  createStudentResourceAccess,
  deleteResource,
  listResources,
  listStudentResources,
  staffResourceFile,
  studentResourceFile,
  updateResource,
} from '../resource-service.js';
import { listStudentBatchExams } from '../batch-exam-service.js';
import { withApiObservability } from '../api-observability.js';

const maxRequestBytes = 4.25 * 1024 * 1024;

async function readResourceBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
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

function sendFile(response, { resource, stream }) {
  response.statusCode = 200;
  response.setHeader('Content-Type', resource.mimeType || 'application/octet-stream');
  response.setHeader('Content-Length', String(resource.size || ''));
  response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(resource.fileName)}`);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'private, no-store');
  stream.on('error', (error) => {
    console.error('Resource download failed:', error);
    if (!response.headersSent) response.status(500).end('The resource could not be downloaded.');
    else response.destroy(error);
  });
  stream.pipe(response);
}

async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (applyNativeCors(request, response)) return;
  try {
    if (request.method === 'GET' && request.query?.student && request.query?.token) {
      if (request.query.download) {
        return sendFile(response, await studentResourceFile(request.query.student, request.query.token, request.query.download));
      }
      const [resourcePayload, exams] = await Promise.all([
        listStudentResources(request.query.student, request.query.token),
        listStudentBatchExams(request.query.student, request.query.token),
      ]);
      return response.status(200).json({ ...resourcePayload, exams });
    }
    if (request.method === 'GET' && request.query?.download) {
      return sendFile(response, await staffResourceFile(request, request.query.download));
    }
    if (request.method === 'GET') {
      return response.status(200).json({ resources: await listResources(request, request.query || {}) });
    }
    assertSameOrigin(request);
    if (request.method === 'POST' && request.query?.action === 'student-access') {
      const body = await readResourceBody(request);
      return response.status(200).json(await createStudentResourceAccess(request, body.studentId));
    }
    if (request.method === 'POST') {
      return response.status(201).json({ resource: await createResource(request, await readResourceBody(request)) });
    }
    if (request.method === 'PATCH') {
      return response.status(200).json({ resource: await updateResource(request, request.query?.id, await readResourceBody(request)) });
    }
    if (request.method === 'DELETE') {
      await deleteResource(request, request.query?.id);
      return response.status(200).json({ deleted: true });
    }
    return response.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return sendAuthError(response, error);
  }
}

export default withApiObservability('resources', handler);
