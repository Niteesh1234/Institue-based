import { applyNativeCors, assertSameOrigin, isNativeClient, readJsonBody, sendAuthError, sessionCookie, verifyOtpCode } from '../../auth-service.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (applyNativeCors(request, response)) return;
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  try {
    assertSameOrigin(request);
    const result = await verifyOtpCode(await readJsonBody(request), request);
    const nativeClient = isNativeClient(request);
    if (result.token && !nativeClient) response.setHeader('Set-Cookie', sessionCookie(result.token));
    return response.status(200).json({
      user: result.user,
      pendingApproval: Boolean(result.pendingApproval),
      message: result.message,
      ...(nativeClient && result.token ? { sessionToken: result.token } : {}),
    });
  } catch (error) { return sendAuthError(response, error); }
}
