import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { COURSE_KEYS } from '../exam-courses.js';
import {
  buildPreviewAggregation,
  buildValidatedPreviewCatalog,
  catalogContract
} from '../vercel-catalog.js';

const outputRoot = resolve('public', 'generated');

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value));
}

await mkdir(outputRoot, { recursive: true });

const manifest = { generatedAt: new Date().toISOString(), courses: {} };

for (const courseKey of COURSE_KEYS) {
  const courseDirectory = resolve(outputRoot, courseKey);
  const testsDirectory = resolve(courseDirectory, 'tests');
  await mkdir(testsDirectory, { recursive: true });

  const snapshot = buildValidatedPreviewCatalog(courseKey);
  const metadataTests = snapshot.tests.map((test) => ({ ...test, questions: [] }));
  const catalog = {
    source: snapshot.source,
    format: 'Validated syllabus-aligned full tests',
    contract: catalogContract(courseKey),
    tests: metadataTests
  };
  const aggregation = {
    source: snapshot.source,
    aggregation: buildPreviewAggregation(courseKey)
  };

  await Promise.all([
    writeJson(resolve(courseDirectory, 'catalog.json'), catalog),
    writeJson(resolve(courseDirectory, 'aggregation.json'), aggregation),
    ...snapshot.tests.map((test) =>
      writeJson(resolve(testsDirectory, `${test.id}.json`), {
        source: snapshot.source,
        test
      })
    )
  ]);

  manifest.courses[courseKey] = {
    tests: snapshot.tests.length,
    questions: snapshot.tests.reduce((total, test) => total + test.questions.length, 0)
  };
}

await writeJson(resolve(outputRoot, 'manifest.json'), manifest);
console.log(`Built validated static question banks for ${COURSE_KEYS.join(', ')}.`);
