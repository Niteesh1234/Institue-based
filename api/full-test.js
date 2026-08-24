import { loadCatalog } from '../vercel-catalog.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const course = request.query.course || 'jnvst';
  const testId = request.query.id;
  if (!testId) return response.status(400).json({ error: 'A test id is required.' });
  try {
    const catalog = await loadCatalog({ course, testId, includeQuestions: true, refresh: request.query.refresh === '1' });
    if (!catalog.tests[0]) return response.status(404).json({ error: `Test ${testId} was not found.` });
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    return response.status(200).json({ source: catalog.source, test: catalog.tests[0] });
  } catch (error) {
    return response.status(503).json({ error: error.message });
  }
}
