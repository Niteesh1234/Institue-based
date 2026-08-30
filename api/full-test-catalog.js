import { catalogContract, deploymentMetadata, loadAggregation, loadCatalog, loadCourseProfile, loadSyllabus } from '../vercel-catalog.js';
import { courseCollectionNames } from '../exam-courses.js';
import { withApiObservability } from '../api-observability.js';

async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  try {
    const course = request.query.course || 'jnvst';
    if (request.query.view === 'aggregation') {
      response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return response.status(200).json({
        source: deploymentMetadata.hasMongo
          ? `${deploymentMetadata.databaseName}.${courseCollectionNames(course).questions}`
          : 'Validated in-memory preview',
        aggregation: await loadAggregation(course),
      });
    }
    const [catalog, syllabus, courseProfile] = await Promise.all([
      loadCatalog({ course, refresh: request.query.refresh === '1', includeQuestions: false }),
      loadSyllabus(course),
      loadCourseProfile(course),
    ]);
    const level = request.query.level || 'all';
    const tests = level === 'all' ? catalog.tests : catalog.tests.filter((test) => test.level === String(level).toLowerCase());
    response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return response.status(200).json({
      source: catalog.source,
      syllabusSource: syllabus.source,
      courseSource: courseProfile.source,
      format: 'Validated syllabus-aligned full tests',
      contract: catalogContract(course, syllabus.blueprint, courseProfile.profile),
      tests,
    });
  } catch (error) {
    return response.status(503).json({ error: error.message });
  }
}

export default withApiObservability('full-test-catalog', handler);
