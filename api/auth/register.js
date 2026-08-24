import { applyNativeCors, assertSameOrigin, readJsonBody, registerAccount, sendAuthError } from '../../auth-service.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (applyNativeCors(request, response)) return;
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  try {
    assertSameOrigin(request);
    return response.status(201).json(await registerAccount(await readJsonBody(request)));
  } catch (error) { return sendAuthError(response, error); }
}
