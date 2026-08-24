import { deploymentMetadata, loadAggregation } from '../vercel-catalog.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  try {
    const course = request.query.course || 'jnvst';
    response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return response.status(200).json({ source: deploymentMetadata.hasMongo ? `Testing.${course}_questions` : 'Validated in-memory preview', aggregation: await loadAggregation(course) });
  } catch (error) {
    return response.status(503).json({ error: error.message });
  }
}
