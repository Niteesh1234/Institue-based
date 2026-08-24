import { applyNativeCors, assertSameOrigin, clearSessionCookie, isNativeClient, logoutAccount, sendAuthError } from '../../auth-service.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (applyNativeCors(request, response)) return;
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  try {
    assertSameOrigin(request);
    await logoutAccount(request);
    if (!isNativeClient(request)) response.setHeader('Set-Cookie', clearSessionCookie());
    return response.status(200).json({ success: true });
  } catch (error) { return sendAuthError(response, error); }
}
