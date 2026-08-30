import { randomUUID } from 'node:crypto';

export function withApiObservability(route, handler) {
  return async function observedHandler(request, response) {
    const startedAt = Date.now();
    const requestId = String(request.headers?.['x-request-id'] || randomUUID()).slice(0, 80);
    response.setHeader('X-Request-Id', requestId);
    response.once?.('finish', () => {
      const durationMs = Date.now() - startedAt;
      console.info(JSON.stringify({ type: 'api_request', route, requestId, method: request.method, status: response.statusCode, durationMs }));
    });
    try {
      return await handler(request, response);
    } catch (error) {
      console.error(JSON.stringify({ type: 'api_error', route, requestId, method: request.method, durationMs: Date.now() - startedAt, message: error?.message || 'Unknown error' }));
      throw error;
    }
  };
}
