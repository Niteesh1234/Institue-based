import { MongoClient } from 'mongodb';
import { generateEntranceBank, validateEntranceBank } from '../entrance-question-engine.js';
import { courseCollectionNames, getExamCourse } from '../exam-courses.js';

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error('MONGODB_URI is required to seed the Testing database.');
const client = new MongoClient(mongoUri, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 });

async function ensureCollection(db, name) {
  if (!await db.listCollections({ name }, { nameOnly: true }).hasNext()) await db.createCollection(name);
}

async function upsertInChunks(collection, documents, key, seededAt) {
  for (let start = 0; start < documents.length; start += 400) {
    const chunk = documents.slice(start, start + 400);
    await collection.bulkWrite(chunk.map((document) => ({
      updateOne: { filter: { [key]: document[key] }, update: { $set: { ...document, updatedAt: seededAt }, $setOnInsert: { createdAt: seededAt } }, upsert: true }
    })), { ordered: false });
  }
}

try {
  await client.connect();
  const db = client.db('Testing');
  const results = [];
  for (const courseKey of ['sainik', 'rms']) {
    const course = getExamCourse(courseKey);
    const names = courseCollectionNames(courseKey);
    const bank = generateEntranceBank(courseKey);
    const generationReport = validateEntranceBank(courseKey, bank);
    await Promise.all(Object.values(names).map((name) => ensureCollection(db, name)));
    const questionCollection = db.collection(names.questions);
    const testCollection = db.collection(names.tests);
    await Promise.all([
      questionCollection.createIndex({ questionId: 1 }, { unique: true, name: 'uq_question_id' }),
      questionCollection.createIndex({ fingerprint: 1 }, { unique: true, name: 'uq_question_fingerprint' }),
      questionCollection.createIndex({ promptFingerprint: 1 }, { unique: true, name: 'uq_prompt_fingerprint' }),
      questionCollection.createIndex({ renderFingerprint: 1 }, { unique: true, name: 'uq_render_fingerprint' }),
      questionCollection.createIndex({ underlyingFingerprint: 1 }, { unique: true, name: 'uq_underlying_fingerprint' }),
      questionCollection.createIndex({ semanticFingerprint: 1 }, { unique: true, name: 'uq_semantic_fingerprint' }),
      questionCollection.createIndex({ testId: 1, questionNumber: 1 }, { unique: true, name: 'uq_test_position' }),
      testCollection.createIndex({ testId: 1 }, { unique: true, name: 'uq_test_id' }),
      testCollection.createIndex({ moduleVersion: 1, difficulty: 1, number: 1 }, { name: 'catalog_lookup' })
    ]);
    const seededAt = new Date();
    await upsertInChunks(questionCollection, bank.questions, 'questionId', seededAt);
    await upsertInChunks(testCollection, bank.tests, 'testId', seededAt);
    await upsertInChunks(db.collection(names.syllabus), course.blueprint.map((section) => ({
      syllabusKey: `${course.moduleVersion}-${section.key}`, course: course.key, moduleVersion: course.moduleVersion,
      syllabusYear: course.year, section: section.section, subject: section.subject, questionCountPerPaper: section.questionCount,
      marksPerPaper: section.marks, topics: section.topics.map(([topic]) => topic), sourceType: course.sourceType,
      sourceLabel: course.sourceLabel, sourceUrl: course.sourceUrl, coverageNote: course.coverageNote
    })), 'syllabusKey', seededAt);
    const storedQuestions = await questionCollection.countDocuments({ moduleVersion: course.moduleVersion, status: 'validated' });
    const storedTests = await testCollection.countDocuments({ moduleVersion: course.moduleVersion, status: 'validated' });
    const databaseReport = { status: storedQuestions === bank.questions.length && storedTests === bank.tests.length ? 'passed' : 'failed', storedQuestions, storedTests };
    await db.collection(names.validation).insertOne({ moduleVersion: course.moduleVersion, runAt: seededAt, status: databaseReport.status, generationReport, databaseReport });
    if (databaseReport.status !== 'passed') throw new Error(`${course.shortName} MongoDB count audit failed.`);
    results.push({ course: course.key, generationReport, databaseReport });
  }
  console.log(JSON.stringify({ status: 'passed', database: 'Testing', results }, null, 2));
} finally {
  await client.close();
}
