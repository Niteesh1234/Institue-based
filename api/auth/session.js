import { applyNativeCors, authConfiguration, sendAuthError, sessionUser } from '../../auth-service.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (applyNativeCors(request, response)) return;
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await sessionUser(request);
    const configuration = authConfiguration();
    return response.status(200).json({ authenticated: Boolean(user), configured: configuration.database && configuration.email && configuration.secret, user });
  } catch (error) { return sendAuthError(response, error); }
}
