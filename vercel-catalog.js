import { MongoClient } from 'mongodb';
import { generateTestingBank, validateTestingBank } from './question-engine.js';
import { generateEntranceBank, validateEntranceBank } from './entrance-question-engine.js';
import { COURSE_KEYS, courseCollectionNames, getExamCourse } from './exam-courses.js';

const databaseName = 'Testing';
const previewBanks = new Map();
const catalogCaches = new Map();
let client;
let database;

function getPreviewBank(courseKey) {
  const course = getExamCourse(courseKey);
  if (!previewBanks.has(course.key)) {
    const bank = course.key === 'jnvst' ? generateTestingBank() : generateEntranceBank(course.key);
    if (course.key === 'jnvst') validateTestingBank(bank);
    else validateEntranceBank(course.key, bank);
    previewBanks.set(course.key, bank);
  }
  return previewBanks.get(course.key);
}

async function getDatabase() {
  if (!process.env.MONGODB_URI) return null;
  if (!client) client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 7000 });
  if (!database) {
    await client.connect();
    database = client.db(databaseName);
  }
  return database;
}

function mapCatalog(course, testDocuments, questionDocuments = []) {
  const questionsByTest = Map.groupBy(questionDocuments, (question) => question.testId);
  return testDocuments.map((test) => ({
    id: test.testId,
    course: course.key,
    number: test.number,
    categoryNumber: test.categoryNumber,
    title: test.title,
    level: test.difficulty,
    subject: `${course.shortName} ${course.className} · authored question bank`,
    questionCount: test.questionCount,
    totalMarks: test.totalMarks,
    durationMinutes: test.durationMinutes,
    sectionCounts: test.sectionCounts,
    topics: test.topicCoverage,
    syllabusCoverage: test.syllabusCoverage,
    subtopicCoverage: test.subtopicCoverage || {},
    markingScheme: test.markingScheme,
    qualifyingMarks: test.qualifyingMarks || null,
    examMode: test.examMode,
    divyangExtraTimeMinutes: test.divyangExtraTimeMinutes || 0,
    language: test.language,
    syllabusVersion: test.syllabusVersion,
    validationStatus: test.status,
    questions: (questionsByTest.get(test.testId) || []).map((question) => {
      const { createdAt, updatedAt, ...safeQuestion } = question;
      return safeQuestion;
    })
  }));
}

function validateCatalog(course, tests, { completeCatalog, includeQuestions }) {
  const expectedTests = course.levels.length * course.standard.papersPerLevel;
  if (completeCatalog && tests.length !== expectedTests) throw new Error(`${course.shortName} contains ${tests.length}/${expectedTests} validated papers.`);
  if (completeCatalog) {
    for (const difficulty of course.levels) {
      if (tests.filter((test) => test.level === difficulty).length !== course.standard.papersPerLevel) throw new Error(`${course.shortName} does not contain 10 ${difficulty} papers.`);
    }
  }
  for (const test of tests) {
    if (test.questionCount !== course.standard.questionsPerPaper) throw new Error(`${test.id} declares ${test.questionCount}/${course.standard.questionsPerPaper} questions.`);
    if (includeQuestions && test.questions.length !== course.standard.questionsPerPaper) throw new Error(`${test.id} contains ${test.questions.length}/${course.standard.questionsPerPaper} questions.`);
    if (includeQuestions && new Set(test.questions.map((question) => question.promptFingerprint)).size !== test.questions.length) throw new Error(`${test.id} contains duplicate prompts.`);
    if (includeQuestions && new Set(test.questions.map((question) => question.renderFingerprint)).size !== test.questions.length) throw new Error(`${test.id} contains duplicate rendered questions.`);
  }
}

function aggregateQuestions(questionDocuments) {
  const groups = new Map();
  for (const question of questionDocuments) {
    const key = `${question.difficulty}|${question.subject}`;
    const group = groups.get(key) || { difficulty: question.difficulty, subject: question.subject, questionCount: 0, tests: new Set(), topics: new Set() };
    group.questionCount += 1;
    group.tests.add(question.testId);
    group.topics.add(question.topic);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ difficulty: group.difficulty, subject: group.subject, questionCount: group.questionCount, testCount: group.tests.size, topicCount: group.topics.size }));
}

export function buildValidatedPreviewCatalog(requestedCourse = 'jnvst') {
  const course = getExamCourse(requestedCourse);
  const bank = getPreviewBank(course.key);
  const tests = mapCatalog(course, bank.tests, bank.questions);
  validateCatalog(course, tests, { completeCatalog: true, includeQuestions: true });
  return {
    loadedAt: Date.now(),
    course: course.key,
    source: `Validated ${course.shortName} build snapshot`,
    tests
  };
}

export function buildPreviewAggregation(requestedCourse = 'jnvst') {
  const course = getExamCourse(requestedCourse);
  return aggregateQuestions(getPreviewBank(course.key).questions);
}

export async function loadCatalog({ course: requestedCourse = 'jnvst', refresh = false, includeQuestions = false, testId = null } = {}) {
  const course = getExamCourse(requestedCourse);
  const cacheKey = `${course.key}:${includeQuestions ? testId || 'all' : 'metadata'}`;
  const cached = catalogCaches.get(cacheKey);
  if (!refresh && cached && Date.now() - cached.loadedAt < 60000) return cached;
  const db = await getDatabase();
  const collections = courseCollectionNames(course.key);
  let testDocuments = [];
  let questionDocuments = [];
  let source = '';
  if (db) {
    const match = { moduleVersion: course.moduleVersion, status: 'validated', ...(testId ? { testId } : {}) };
    testDocuments = await db.collection(collections.tests).find(match, { projection: { _id: 0 } }).sort({ number: 1 }).toArray();
    if (testDocuments.length && includeQuestions) {
      const testIds = testDocuments.map((test) => test.testId);
      questionDocuments = await db.collection(collections.questions).find({ moduleVersion: course.moduleVersion, status: 'validated', testId: { $in: testIds } }, { projection: { _id: 0, createdAt: 0, updatedAt: 0 } }).sort({ testId: 1, questionNumber: 1 }).toArray();
    }
    if (testDocuments.length) source = `${databaseName}.${collections.questions}`;
  }
  if (!testDocuments.length) {
    const bank = getPreviewBank(course.key);
    testDocuments = testId ? bank.tests.filter((test) => test.testId === testId) : bank.tests;
    const ids = new Set(testDocuments.map((test) => test.testId));
    questionDocuments = includeQuestions ? bank.questions.filter((question) => ids.has(question.testId)) : [];
    source = `${course.shortName} in-memory question bank${process.env.MONGODB_URI ? ' · Mongo collection not seeded' : ' · set MONGODB_URI for Testing DB'}`;
  }
  const tests = mapCatalog(course, testDocuments, questionDocuments);
  validateCatalog(course, tests, { completeCatalog: !testId, includeQuestions });
  const result = { loadedAt: Date.now(), course: course.key, tests, source };
  catalogCaches.set(cacheKey, result);
  return result;
}

export async function loadAggregation(requestedCourse = 'jnvst') {
  const course = getExamCourse(requestedCourse);
  const db = await getDatabase();
  const collections = courseCollectionNames(course.key);
  if (db && await db.collection(collections.questions).countDocuments({ moduleVersion: course.moduleVersion, status: 'validated' })) {
    return db.collection(collections.questions).aggregate([
      { $match: { moduleVersion: course.moduleVersion, status: 'validated' } },
      { $group: { _id: { difficulty: '$difficulty', subject: '$subject' }, questionCount: { $sum: 1 }, tests: { $addToSet: '$testId' }, topics: { $addToSet: '$topic' } } },
      { $project: { _id: 0, difficulty: '$_id.difficulty', subject: '$_id.subject', questionCount: 1, testCount: { $size: '$tests' }, topicCount: { $size: '$topics' } } }
    ]).toArray();
  }
  return buildPreviewAggregation(course.key);
}

export async function loadValidationReport(requestedCourse = 'jnvst') {
  const course = getExamCourse(requestedCourse);
  const db = await getDatabase();
  const collections = courseCollectionNames(course.key);
  if (db) {
    const report = await db.collection(collections.validation).findOne({ moduleVersion: course.moduleVersion }, { sort: { runAt: -1 }, projection: { _id: 0 } });
    if (report) return report;
  }
  const bank = getPreviewBank(course.key);
  return { runAt: new Date().toISOString(), source: 'validated-preview', ...(course.key === 'jnvst' ? validateTestingBank(bank) : validateEntranceBank(course.key, bank)) };
}

export function catalogContract(requestedCourse = 'jnvst') {
  const course = getExamCourse(requestedCourse);
  return {
    course: course.key, total: course.levels.length * course.standard.papersPerLevel, perLevel: course.standard.papersPerLevel,
    levels: course.levels, totalQuestionsPerPaper: course.standard.questionsPerPaper,
    totalMarksPerPaper: course.standard.marksPerPaper, durationMinutes: course.standard.durationMinutes,
    subjects: course.blueprint.map((section) => ({ subject: section.subject, questions: section.questionCount, marks: section.marks }))
  };
}

export const deploymentMetadata = {
  databaseName,
  moduleVersion: 'VIJETHA-MULTI-EXAM-V1',
  modules: Object.fromEntries(COURSE_KEYS.map((key) => [key, getExamCourse(key).moduleVersion])),
  hasMongo: Boolean(process.env.MONGODB_URI)
};
