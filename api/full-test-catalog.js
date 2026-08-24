import { catalogContract, loadCatalog } from '../vercel-catalog.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  try {
    const course = request.query.course || 'jnvst';
    const catalog = await loadCatalog({ course, refresh: request.query.refresh === '1', includeQuestions: false });
    const level = request.query.level || 'all';
    const tests = level === 'all' ? catalog.tests : catalog.tests.filter((test) => test.level === String(level).toLowerCase());
    response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return response.status(200).json({ source: catalog.source, format: 'Validated syllabus-aligned full tests', contract: catalogContract(course), tests });
  } catch (error) {
    return response.status(503).json({ error: error.message });
  }
}
