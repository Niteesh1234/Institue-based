import { applyNativeCors, assertSameOrigin, readJsonBody, sendAuthError } from '../auth-service.js';
import {
  createBatchExam,
  deleteBatchExam,
  getStudentBatchExam,
  listBatchExams,
  submitStudentBatchExam,
} from '../batch-exam-service.js';
import { withApiObservability } from '../api-observability.js';

async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (applyNativeCors(request, response)) return;
  try {
    if (request.method === 'GET' && request.query?.student && request.query?.token && request.query?.id) {
      return response.status(200).json({ exam: await getStudentBatchExam(request.query.student, request.query.token, request.query.id) });
    }
    if (request.method === 'POST' && request.query?.student && request.query?.token && request.query?.id) {
      assertSameOrigin(request);
      return response.status(201).json({ result: await submitStudentBatchExam(request.query.student, request.query.token, request.query.id, await readJsonBody(request)) });
    }
    if (request.method === 'GET') {
      return response.status(200).json({ exams: await listBatchExams(request, request.query || {}) });
    }
    assertSameOrigin(request);
    if (request.method === 'POST') {
      return response.status(201).json({ exam: await createBatchExam(request, await readJsonBody(request)) });
    }
    if (request.method === 'DELETE') {
      await deleteBatchExam(request, request.query?.id);
      return response.status(200).json({ deleted: true });
    }
    return response.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return sendAuthError(response, error);
  }
}

export default withApiObservability('batch-exams', handler);
