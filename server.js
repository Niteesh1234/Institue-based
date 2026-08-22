import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { JNVST_BLUEPRINT, JNVST_LEVELS, JNVST_STANDARD, TESTING_MODULE_VERSION } from './syllabus.js';
import { generateTestingBank, validateTestingBank } from './question-engine.js';

const port = Number(process.env.PORT || 5174);
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.join(rootDirectory, 'dist');
const mongoUri = process.env.MONGODB_URI;
const databaseName = 'Testing';
const collectionNames = {
  questions: 'jnvst_questions',
  tests: 'jnvst_tests',
  syllabus: 'jnvst_syllabus_topics',
  validation: 'jnvst_validation_runs'
};
const client = mongoUri ? new MongoClient(mongoUri, { maxPoolSize: 10, serverSelectionTimeoutMS: 7000 }) : null;
let database;
let catalogCache;
let previewBank;

function getValidatedPreviewBank() {
  if (!previewBank) {
    previewBank = generateTestingBank();
    validateTestingBank(previewBank);
  }
  return previewBank;
}

async function getDatabase() {
  if (!client) throw new Error('MONGODB_URI is not configured. Seed and start the Testing database API with a MongoDB connection string.');
  if (!database) {
    await client.connect();
    database = client.db(databaseName);
  }
  return database;
}

function validateCatalog(tests) {
  const errors = [];
  if (tests.length !== 30) errors.push(`Testing contains ${tests.length}/30 validated papers.`);
  for (const difficulty of JNVST_LEVELS) {
    const count = tests.filter((test) => test.level === difficulty).length;
    if (count !== 10) errors.push(`Testing contains ${count}/10 ${difficulty} papers.`);
  }
  for (const test of tests) {
    if (test.questions.length !== 80) errors.push(`${test.id} contains ${test.questions.length}/80 questions.`);
    for (const section of JNVST_BLUEPRINT) {
      const count = test.questions.filter((question) => question.subject === section.subject).length;
      if (count !== 20) errors.push(`${test.id} contains ${count}/20 ${section.subject} questions.`);
    }
  }
  if (errors.length) throw new Error(`Testing database validation failed: ${errors.slice(0, 8).join(' ')}`);
}

async function loadFullCatalog({ bypassCache = false } = {}) {
  if (!bypassCache && catalogCache && Date.now() - catalogCache.loadedAt < 60000) return catalogCache.tests;
  let testDocuments;
  let questionDocuments;
  if (client) {
    const db = await getDatabase();
    const match = { moduleVersion: TESTING_MODULE_VERSION, status: 'validated' };
    testDocuments = await db.collection(collectionNames.tests).find(match, { projection: { _id: 0 } }).sort({ number: 1 }).toArray();
    const testIds = testDocuments.map((test) => test.testId);
    questionDocuments = testIds.length
      ? await db.collection(collectionNames.questions).find({ ...match, testId: { $in: testIds } }, { projection: { _id: 0, createdAt: 0, updatedAt: 0, fingerprint: 0, promptFingerprint: 0, renderFingerprint: 0 } }).sort({ testId: 1, questionNumber: 1 }).toArray()
      : [];
  } else {
    const bank = getValidatedPreviewBank();
    testDocuments = bank.tests;
    questionDocuments = bank.questions;
  }
  const questionsByTest = Map.groupBy(questionDocuments, (question) => question.testId);
  const tests = testDocuments.map((test) => ({
    id: test.testId,
    number: test.number,
    categoryNumber: test.categoryNumber,
    title: test.title,
    level: test.difficulty,
    subject: 'JNVST Class 6 · Testing authored bank',
    questionCount: test.questionCount,
    totalMarks: test.totalMarks,
    durationMinutes: test.durationMinutes,
    sectionCounts: test.sectionCounts,
    topics: test.topicCoverage,
    syllabusCoverage: test.syllabusCoverage,
    subtopicCoverage: test.subtopicCoverage,
    matParts: test.matParts,
    markingScheme: test.markingScheme,
    qualifyingMarks: test.qualifyingMarks,
    examMode: test.examMode,
    divyangExtraTimeMinutes: test.divyangExtraTimeMinutes,
    language: test.language,
    syllabusVersion: test.syllabusVersion,
    validationStatus: test.status,
    questions: questionsByTest.get(test.testId) || []
  }));
  validateCatalog(tests);
  catalogCache = { loadedAt: Date.now(), tests };
  return tests;
}

async function aggregation() {
  if (!client) {
    const { questions } = getValidatedPreviewBank();
    const groups = new Map();
    for (const question of questions) {
      const key = `${question.difficulty}|${question.subject}`;
      const group = groups.get(key) || { difficulty: question.difficulty, subject: question.subject, questionCount: 0, tests: new Set(), topics: new Set() };
      group.questionCount += 1;
      group.tests.add(question.testId);
      group.topics.add(question.topic);
      groups.set(key, group);
    }
    return [...groups.values()].map((group) => ({ difficulty: group.difficulty, subject: group.subject, questionCount: group.questionCount, testCount: group.tests.size, topicCount: group.topics.size }));
  }
  const db = await getDatabase();
  return db.collection(collectionNames.questions).aggregate([
    { $match: { moduleVersion: TESTING_MODULE_VERSION, status: 'validated' } },
    { $group: { _id: { difficulty: '$difficulty', subject: '$subject' }, questionCount: { $sum: 1 }, tests: { $addToSet: '$testId' }, topics: { $addToSet: '$topic' } } },
    { $project: { _id: 0, difficulty: '$_id.difficulty', subject: '$_id.subject', questionCount: 1, testCount: { $size: '$tests' }, topicCount: { $size: '$topics' } } },
    { $sort: { difficulty: 1, subject: 1 } }
  ]).toArray();
}

async function latestValidation() {
  const db = await getDatabase();
  return db.collection(collectionNames.validation).findOne({ moduleVersion: TESTING_MODULE_VERSION }, { sort: { runAt: -1 }, projection: { _id: 0 } });
}

const json = (response, status, body) => {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  response.end(JSON.stringify(body));
};

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

async function serveApplication(url, response) {
  const requestedPath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const resolvedPath = path.resolve(distDirectory, requestedPath);
  const safePath = resolvedPath.startsWith(`${distDirectory}${path.sep}`) ? resolvedPath : path.join(distDirectory, 'index.html');
  try {
    const body = await readFile(safePath);
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(safePath)] || 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    if (path.extname(requestedPath)) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    const body = await readFile(path.join(distDirectory, 'index.html'));
    response.writeHead(200, { 'Content-Type': contentTypes['.html'] });
    response.end(body);
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/api/health') {
    if (!client) return json(response, 200, { service: 'vijetha-testing-api', database: databaseName, moduleVersion: TESTING_MODULE_VERSION, status: 'preview', message: 'Validated preview is active; set MONGODB_URI to use Testing.' });
    try {
      const db = await getDatabase();
      await db.command({ ping: 1 });
      return json(response, 200, { service: 'vijetha-testing-api', database: databaseName, moduleVersion: TESTING_MODULE_VERSION, status: 'connected' });
    } catch (error) {
      return json(response, 503, { service: 'vijetha-testing-api', database: databaseName, status: 'unavailable', error: error.message });
    }
  }
  if (url.pathname === '/api/full-test-catalog' || url.pathname === '/api/test-catalog') {
    try {
      const allTests = await loadFullCatalog({ bypassCache: url.searchParams.get('refresh') === '1' });
      const level = url.searchParams.get('level') || 'all';
      const tests = level === 'all' ? allTests : allTests.filter((test) => test.level === level.toLowerCase());
      return json(response, 200, {
        source: client ? `${databaseName}.${collectionNames.questions}` : 'Validated in-memory preview (set MONGODB_URI for Testing DB)',
        moduleVersion: TESTING_MODULE_VERSION,
        format: 'JNVST 2027 validated authored full tests',
        contract: {
          total: 30,
          perLevel: JNVST_STANDARD.papersPerLevel,
          levels: JNVST_LEVELS,
          perSubject: JNVST_STANDARD.questionsPerSubject,
          totalQuestionsPerPaper: JNVST_STANDARD.questionsPerPaper,
          subjects: JNVST_BLUEPRINT.map((section) => section.subject)
        },
        levelCounts: Object.fromEntries(JNVST_LEVELS.map((difficulty) => [difficulty, allTests.filter((test) => test.level === difficulty).length])),
        tests
      });
    } catch (error) { return json(response, 503, { error: error.message }); }
  }
  if (url.pathname === '/api/question-aggregation') {
    try { return json(response, 200, { source: client ? `${databaseName}.${collectionNames.questions}` : 'Validated in-memory preview', aggregation: await aggregation() }); }
    catch (error) { return json(response, 503, { error: error.message }); }
  }
  if (url.pathname === '/api/validation-report') {
    try {
      const report = await latestValidation();
      if (!report) return json(response, 404, { error: `No validation run exists for ${TESTING_MODULE_VERSION}.` });
      return json(response, 200, report);
    } catch (error) { return json(response, 503, { error: error.message }); }
  }
  if (request.method === 'GET') return serveApplication(url, response);
  response.writeHead(405);
  response.end('Method not allowed');
});

server.listen(port, () => console.log(`Vijetha Testing API running at http://localhost:${port}`));
