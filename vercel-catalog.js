import { generateTestingBank, validateTestingBank } from './question-engine.js';
import { generateEntranceBank, validateEntranceBank } from './entrance-question-engine.js';
import { COURSE_KEYS, courseCollectionNames, getExamCourse } from './exam-courses.js';
import { VIJETHA_COLLECTIONS, VIJETHA_DATABASE_NAME } from './database-config.js';
import { getVijethaDatabase, hasVijethaDatabaseConfiguration } from './mongo-runtime.js';

const databaseName = VIJETHA_DATABASE_NAME;
const previewBanks = new Map();
const catalogCaches = new Map();
const catalogLoads = new Map();
const supportCaches = new Map();
const supportLoads = new Map();

async function cachedSupport(key, ttl, loader) {
  const cached = supportCaches.get(key);
  if (cached && Date.now() - cached.loadedAt < ttl) return cached.value;
  if (supportLoads.has(key)) return supportLoads.get(key);
  const pending = Promise.resolve()
    .then(loader)
    .then((value) => {
      supportCaches.set(key, { loadedAt: Date.now(), value });
      return value;
    })
    .catch((error) => {
      if (cached) return cached.value;
      throw error;
    })
    .finally(() => supportLoads.delete(key));
  supportLoads.set(key, pending);
  return pending;
}

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
  if (!hasVijethaDatabaseConfiguration()) return null;
  return getVijethaDatabase();
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

async function loadCatalogUncached({ course: requestedCourse = 'jnvst', includeQuestions = false, testId = null } = {}) {
  const course = getExamCourse(requestedCourse);
  const cacheKey = `${course.key}:${includeQuestions ? testId || 'all' : 'metadata'}`;
  const db = await getDatabase();
  const collections = courseCollectionNames(course.key);
  let testDocuments = [];
  let questionDocuments = [];
  let source = '';
  if (db) {
    const match = { moduleVersion: course.moduleVersion, status: 'validated', ...(testId ? { testId } : {}) };
    testDocuments = await db.collection(collections.tests).find(match, { projection: { _id: 0 } }).sort({ number: 1 }).maxTimeMS(8_000).toArray();
    if (testDocuments.length && includeQuestions) {
      const testIds = testDocuments.map((test) => test.testId);
      questionDocuments = await db.collection(collections.questions).find({ moduleVersion: course.moduleVersion, status: 'validated', testId: { $in: testIds } }, { projection: { _id: 0, createdAt: 0, updatedAt: 0 } }).sort({ testId: 1, questionNumber: 1 }).maxTimeMS(8_000).toArray();
    }
    if (testDocuments.length) source = `${databaseName}.${collections.questions}`;
    if (!testDocuments.length) {
      throw new Error(`${databaseName}.${collections.tests} has not been seeded for ${course.shortName}.`);
    }
  }
  if (!testDocuments.length) {
    const bank = getPreviewBank(course.key);
    testDocuments = testId ? bank.tests.filter((test) => test.testId === testId) : bank.tests;
    const ids = new Set(testDocuments.map((test) => test.testId));
    questionDocuments = includeQuestions ? bank.questions.filter((question) => ids.has(question.testId)) : [];
    source = `${course.shortName} in-memory question bank · configure MONGODB_URI for ${databaseName}`;
  }
  const tests = mapCatalog(course, testDocuments, questionDocuments);
  validateCatalog(course, tests, { completeCatalog: !testId, includeQuestions });
  const result = { loadedAt: Date.now(), course: course.key, tests, source };
  catalogCaches.set(cacheKey, result);
  return result;
}

export async function loadCatalog(options = {}) {
  const course = getExamCourse(options.course || 'jnvst');
  const cacheKey = `${course.key}:${options.includeQuestions ? options.testId || 'all' : 'metadata'}`;
  const cached = catalogCaches.get(cacheKey);
  const ttl = options.includeQuestions ? 30 * 60 * 1000 : 5 * 60 * 1000;
  if (!options.refresh && cached && Date.now() - cached.loadedAt < ttl) return cached;
  if (!options.refresh && catalogLoads.has(cacheKey)) return catalogLoads.get(cacheKey);
  const load = loadCatalogUncached(options)
    .catch((error) => {
      if (cached) return { ...cached, stale: true, staleReason: error.message };
      throw error;
    })
    .finally(() => catalogLoads.delete(cacheKey));
  catalogLoads.set(cacheKey, load);
  return load;
}

export async function loadAggregation(requestedCourse = 'jnvst') {
  const course = getExamCourse(requestedCourse);
  return cachedSupport(`aggregation:${course.key}`, 5 * 60 * 1000, async () => {
    const db = await getDatabase();
    const collections = courseCollectionNames(course.key);
    if (db) {
      const rows = await db.collection(collections.questions).aggregate([
        { $match: { moduleVersion: course.moduleVersion, status: 'validated' } },
        { $group: { _id: { difficulty: '$difficulty', subject: '$subject' }, questionCount: { $sum: 1 }, tests: { $addToSet: '$testId' }, topics: { $addToSet: '$topic' } } },
        { $project: { _id: 0, difficulty: '$_id.difficulty', subject: '$_id.subject', questionCount: 1, testCount: { $size: '$tests' }, topicCount: { $size: '$topics' } } }
      ], { maxTimeMS: 8_000 }).toArray();
      if (rows.length) return rows;
    }
    if (db) throw new Error(`${databaseName}.${collections.questions} has not been seeded for ${course.shortName}.`);
    return buildPreviewAggregation(course.key);
  });
}

export async function loadValidationReport(requestedCourse = 'jnvst') {
  const course = getExamCourse(requestedCourse);
  const db = await getDatabase();
  const collections = courseCollectionNames(course.key);
  if (db) {
    const report = await db.collection(collections.validation).findOne({ moduleVersion: course.moduleVersion }, { sort: { runAt: -1 }, projection: { _id: 0 } });
    if (report) return report;
    throw new Error(`${databaseName}.${collections.validation} has no validation report for ${course.shortName}.`);
  }
  const bank = getPreviewBank(course.key);
  return { runAt: new Date().toISOString(), source: 'validated-preview', ...(course.key === 'jnvst' ? validateTestingBank(bank) : validateEntranceBank(course.key, bank)) };
}

export async function loadSyllabus(requestedCourse = 'jnvst') {
  const course = getExamCourse(requestedCourse);
  return cachedSupport(`syllabus:${course.key}`, 10 * 60 * 1000, async () => {
    const db = await getDatabase();
    const collections = courseCollectionNames(course.key);
    if (!db) return { source: 'application-fallback', blueprint: course.blueprint };
    const documents = await db.collection(collections.syllabus)
      .find({ moduleVersion: course.moduleVersion }, { projection: { _id: 0, createdAt: 0, updatedAt: 0 } })
      .maxTimeMS(8_000).toArray();
    if (!documents.length) throw new Error(`${collections.syllabus} has not been seeded.`);
    const bySubject = new Map(documents.map((document) => [document.subject, document]));
    const blueprint = course.blueprint.map((fallback) => {
      const document = bySubject.get(fallback.subject);
      if (!document) throw new Error(`${collections.syllabus} is missing ${fallback.subject}.`);
      return { ...fallback, section: document.section, subject: document.subject, questionCount: document.questionCountPerPaper, marks: document.marksPerPaper ?? fallback.marks, topics: (document.topics || []).map((topic) => [topic, [String(topic).toLowerCase()]]), detailedPlan: document.detailedPlan ?? fallback.detailedPlan };
    });
    return { source: `${databaseName}.${collections.syllabus}`, blueprint };
  });
}

export async function loadCourseProfile(requestedCourse = 'jnvst') {
  const fallback = getExamCourse(requestedCourse);
  return cachedSupport(`profile:${fallback.key}`, 10 * 60 * 1000, async () => {
    const db = await getDatabase();
    if (!db) return { source: 'application-fallback', profile: fallback };
    const document = await db.collection(VIJETHA_COLLECTIONS.courseCatalog).findOne(
      { course: fallback.key },
      { projection: { _id: 0, createdAt: 0, updatedAt: 0 }, maxTimeMS: 8_000 },
    );
    if (!document) throw new Error(`${databaseName}.${VIJETHA_COLLECTIONS.courseCatalog} is missing ${fallback.key}.`);
    const { course, ...profile } = document;
    return { source: `${databaseName}.${VIJETHA_COLLECTIONS.courseCatalog}`, profile: { ...fallback, ...profile, key: course } };
  });
}

export function catalogContract(requestedCourse = 'jnvst', blueprint = null, profile = null) {
  const course = profile || getExamCourse(requestedCourse);
  const resolvedBlueprint = blueprint || course.blueprint;
  return {
    course: course.key, total: course.levels.length * course.standard.papersPerLevel, perLevel: course.standard.papersPerLevel,
    levels: course.levels, totalQuestionsPerPaper: course.standard.questionsPerPaper,
    totalMarksPerPaper: course.standard.marksPerPaper, durationMinutes: course.standard.durationMinutes,
    subjects: resolvedBlueprint.map((section) => ({ subject: section.subject, questions: section.questionCount, marks: section.marks })),
    blueprint: resolvedBlueprint,
    courseProfile: { ...course, blueprint: resolvedBlueprint },
  };
}

export const deploymentMetadata = {
  databaseName,
  moduleVersion: 'VIJETHA-MULTI-EXAM-V1',
  modules: Object.fromEntries(COURSE_KEYS.map((key) => [key, getExamCourse(key).moduleVersion])),
  hasMongo: hasVijethaDatabaseConfiguration()
};

export async function loadDatabaseHealth() {
  return cachedSupport('database-health', 60 * 1000, async () => {
    if (!process.env.MONGODB_URI) return { status: 'preview', connected: false, courses: {} };
    const db = await getDatabase();
    await db.command({ ping: 1, maxTimeMS: 5_000 });
    const courses = Object.fromEntries(await Promise.all(COURSE_KEYS.map(async (key) => {
      const names = courseCollectionNames(key);
      const [tests, questions, syllabus, validations] = await Promise.all([
        db.collection(names.tests).countDocuments({ moduleVersion: getExamCourse(key).moduleVersion, status: 'validated' }, { maxTimeMS: 8_000 }),
        db.collection(names.questions).countDocuments({ moduleVersion: getExamCourse(key).moduleVersion, status: 'validated' }, { maxTimeMS: 8_000 }),
        db.collection(names.syllabus).countDocuments({ moduleVersion: getExamCourse(key).moduleVersion }, { maxTimeMS: 8_000 }),
        db.collection(names.validation).countDocuments({ moduleVersion: getExamCourse(key).moduleVersion, status: 'passed' }, { maxTimeMS: 8_000 }),
      ]);
      return [key, { tests, questions, syllabus, validations }];
    })));
    const ready = Object.values(courses).every((entry) => entry.tests === 30 && entry.questions > 0 && entry.syllabus > 0 && entry.validations > 0);
    return { status: ready ? 'database-ready' : 'database-incomplete', connected: true, courses };
  });
}
