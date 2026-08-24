import { applyNativeCors, assertSameOrigin, readJsonBody, requestOtp, sendAuthError } from '../../auth-service.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (applyNativeCors(request, response)) return;
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  try {
    assertSameOrigin(request);
    return response.status(200).json(await requestOtp(await readJsonBody(request)));
  } catch (error) { return sendAuthError(response, error); }
}
