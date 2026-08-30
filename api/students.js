import { applyNativeCors, assertSameOrigin, readJsonBody, sendAuthError } from '../auth-service.js';
import { createStudent, createStudents, deleteStudent, listStudents, updateStudent } from '../student-service.js';
import { withApiObservability } from '../api-observability.js';

async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (applyNativeCors(request, response)) return;
  try {
    if (request.method === 'GET') {
      const students = await listStudents(request, request.query || {});
      return response.status(200).json({ students });
    }
    assertSameOrigin(request);
    if (request.method === 'POST' && request.query?.action === 'import') {
      return response.status(201).json({ students: await createStudents(request, await readJsonBody(request)) });
    }
    if (request.method === 'POST') {
      const student = await createStudent(request, await readJsonBody(request));
      return response.status(201).json({ student });
    }
    if (request.method === 'PATCH') {
      const student = await updateStudent(request, request.query?.id, await readJsonBody(request));
      return response.status(200).json({ student });
    }
    if (request.method === 'DELETE') {
      await deleteStudent(request, request.query?.id);
      return response.status(200).json({ deleted: true });
    }
    return response.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return sendAuthError(response, error);
  }
}

export default withApiObservability('students', handler);
