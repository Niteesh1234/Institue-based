import { deploymentMetadata, loadDatabaseHealth, loadValidationReport } from '../vercel-catalog.js';
import {
  applyNativeCors,
  assertSameOrigin,
  readJsonBody,
  sendAuthError,
} from '../auth-service.js';
import { answerTutorQuestion } from '../ai-tutor-service.js';
import { changeStaffAccess, getInstituteControl, saveInstituteControl } from '../institute-control-service.js';

export default async function handler(request, response) {
  if (request.query?.control === '1') {
    response.setHeader('Cache-Control', 'no-store');
    if (applyNativeCors(request, response)) return;
    try {
      if (request.method === 'GET') {
        return response.status(200).json({ control: await getInstituteControl(request) });
      }
      assertSameOrigin(request);
      if (request.method === 'PUT') {
        return response.status(200).json({ control: await saveInstituteControl(request, await readJsonBody(request)) });
      }
      if (request.method === 'PATCH' && request.query?.action === 'staff-access') {
        return response.status(200).json(await changeStaffAccess(request, await readJsonBody(request)));
      }
      return response.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
    } catch (error) {
      return sendAuthError(response, error);
    }
  }
  if (request.query?.tutor === '1') {
    response.setHeader('Cache-Control', 'no-store');
    if (applyNativeCors(request, response)) return;
    try {
      if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
      assertSameOrigin(request);
      return response.status(200).json(await answerTutorQuestion(await readJsonBody(request), request));
    } catch (error) {
      return sendAuthError(response, error);
    }
  }
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  if (request.query?.report === '1') {
    try {
      const course = request.query.course || 'jnvst';
      response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return response.status(200).json(await loadValidationReport(course));
    } catch (error) {
      return response.status(503).json({ error: error.message });
    }
  }
  try {
    const databaseHealth = await loadDatabaseHealth();
    return response.status(databaseHealth.connected ? 200 : 503).json({
      service: 'vijetha-testing-api',
      database: deploymentMetadata.databaseName,
      moduleVersion: deploymentMetadata.moduleVersion,
      ...databaseHealth,
    });
  } catch (error) {
    return response.status(503).json({
      service: 'vijetha-testing-api',
      database: deploymentMetadata.databaseName,
      moduleVersion: deploymentMetadata.moduleVersion,
      status: 'database-error',
      connected: false,
      error: error.message,
    });
  }
}
