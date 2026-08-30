import { MongoClient } from 'mongodb';
import { generateTestingBank, validateTestingBank } from '../question-engine.js';
import { ARITHMETIC_SECTION_PLAN, JNVST_BLUEPRINT, JNVST_LEVELS, LANGUAGE_SKILLS, MAT_SECTION_PLAN, TESTING_MODULE_VERSION, syllabusTopicNames } from '../syllabus.js';
import { VIJETHA_DATABASE_NAME, vijethaCourseCollections } from '../database-config.js';

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error('MONGODB_URI is required to seed the Testing database.');

const client = new MongoClient(mongoUri, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 });
const databaseName = VIJETHA_DATABASE_NAME;
const collections = vijethaCourseCollections('jnvst');

const questionValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['questionId', 'testId', 'questionNumber', 'subject', 'section', 'topic', 'coverageTopics', 'syllabusSubtopics', 'skillCode', 'part', 'stem', 'options', 'correctOption', 'difficulty', 'syllabusYear', 'moduleVersion', 'fingerprint', 'promptFingerprint', 'renderFingerprint', 'status'],
    properties: {
      questionId: { bsonType: 'string' },
      testId: { bsonType: 'string' },
      questionNumber: { bsonType: 'int', minimum: 1, maximum: 80 },
      subject: { enum: JNVST_BLUEPRINT.map((section) => section.subject) },
      topic: { bsonType: 'string' },
      coverageTopics: { bsonType: 'array', minItems: 1 },
      syllabusSubtopics: { bsonType: 'array' },
      skillCode: { bsonType: ['string', 'null'] },
      part: { bsonType: ['string', 'null'] },
      stem: { bsonType: 'string', minLength: 8 },
      options: { bsonType: 'array', minItems: 4, maxItems: 4 },
      correctOption: { enum: ['A', 'B', 'C', 'D'] },
      difficulty: { enum: JNVST_LEVELS },
      syllabusYear: { bsonType: 'int', minimum: 2027, maximum: 2027 },
      moduleVersion: { bsonType: 'string' },
      fingerprint: { bsonType: 'string' },
      promptFingerprint: { bsonType: 'string' },
      renderFingerprint: { bsonType: 'string' },
      status: { enum: ['validated'] }
    }
  }
};

const testValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['testId', 'number', 'categoryNumber', 'title', 'difficulty', 'questionCount', 'totalMarks', 'durationMinutes', 'questionIds', 'sectionCounts', 'topicCoverage', 'syllabusCoverage', 'subtopicCoverage', 'matParts', 'markingScheme', 'qualifyingMarks', 'examMode', 'divyangExtraTimeMinutes', 'language', 'moduleVersion', 'status'],
    properties: {
      testId: { bsonType: 'string' },
      number: { bsonType: 'int', minimum: 1, maximum: 30 },
      categoryNumber: { bsonType: 'int', minimum: 1, maximum: 10 },
      difficulty: { enum: JNVST_LEVELS },
      questionCount: { bsonType: 'int', minimum: 80, maximum: 80 },
      totalMarks: { bsonType: 'int', minimum: 100, maximum: 100 },
      durationMinutes: { bsonType: 'int', minimum: 120, maximum: 120 },
      questionIds: { bsonType: 'array', minItems: 80, maxItems: 80 },
      matParts: { bsonType: 'array', minItems: 5, maxItems: 5 },
      markingScheme: { bsonType: 'object' },
      qualifyingMarks: { bsonType: 'object' },
      examMode: { enum: ['Offline OMR-based'] },
      divyangExtraTimeMinutes: { bsonType: 'int', minimum: 40, maximum: 40 },
      language: { bsonType: 'string' },
      moduleVersion: { bsonType: 'string' },
      status: { enum: ['validated'] }
    }
  }
};

async function ensureCollection(db, name, validator) {
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
  if (!exists) await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
  else await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
}

async function upsertInChunks(collection, documents, key, seededAt) {
  const chunkSize = 400;
  for (let start = 0; start < documents.length; start += chunkSize) {
    const chunk = documents.slice(start, start + chunkSize);
    await collection.bulkWrite(chunk.map((document) => ({
      updateOne: {
        filter: { [key]: document[key] },
        update: { $set: { ...document, updatedAt: seededAt }, $setOnInsert: { createdAt: seededAt } },
        upsert: true
      }
    })), { ordered: false });
  }
}

async function validateStoredData(db) {
  const questionCollection = db.collection(collections.questions);
  const testCollection = db.collection(collections.tests);
  const moduleMatch = { moduleVersion: TESTING_MODULE_VERSION, status: 'validated' };
  const [questionCount, testCount, levelRows, sectionRows, invalidOptions, invalidAnswers, duplicateRows, promptDuplicateRows, renderDuplicateRows, languageRows, evsPassageRows, evsStandaloneRows, evsTopicRows, arithmeticSkillRows, matSkillRows, matPartRows, invalidTestRules] = await Promise.all([
    questionCollection.countDocuments(moduleMatch),
    testCollection.countDocuments(moduleMatch),
    testCollection.aggregate([{ $match: moduleMatch }, { $group: { _id: '$difficulty', count: { $sum: 1 } } }]).toArray(),
    questionCollection.aggregate([{ $match: moduleMatch }, { $group: { _id: { testId: '$testId', subject: '$subject' }, count: { $sum: 1 } } }, { $match: { count: { $ne: 20 } } }]).toArray(),
    questionCollection.countDocuments({ ...moduleMatch, $expr: { $ne: [{ $size: '$options' }, 4] } }),
    questionCollection.countDocuments({ ...moduleMatch, $expr: { $not: { $in: ['$correctOption', '$options.id'] } } }),
    questionCollection.aggregate([{ $match: moduleMatch }, { $group: { _id: '$fingerprint', count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $limit: 1 }]).toArray(),
    questionCollection.aggregate([{ $match: moduleMatch }, { $group: { _id: '$promptFingerprint', count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $limit: 1 }]).toArray(),
    questionCollection.aggregate([{ $match: moduleMatch }, { $group: { _id: '$renderFingerprint', count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $limit: 1 }]).toArray(),
    questionCollection.aggregate([{ $match: { ...moduleMatch, subject: 'Language' } }, { $group: { _id: { testId: '$testId', passageId: '$passageId' }, count: { $sum: 1 } } }, { $match: { count: { $ne: 5 } } }]).toArray(),
    questionCollection.aggregate([{ $match: { ...moduleMatch, subject: 'Environmental Studies', passageId: { $exists: true } } }, { $group: { _id: { testId: '$testId', passageId: '$passageId' }, count: { $sum: 1 } } }, { $match: { count: { $ne: 5 } } }]).toArray(),
    questionCollection.aggregate([{ $match: { ...moduleMatch, subject: 'Environmental Studies', passageId: { $exists: false } } }, { $group: { _id: '$testId', count: { $sum: 1 } } }, { $match: { count: { $ne: 15 } } }]).toArray(),
    questionCollection.aggregate([{ $match: { ...moduleMatch, subject: 'Environmental Studies' } }, { $group: { _id: '$testId', topics: { $addToSet: '$topic' } } }, { $project: { count: { $size: '$topics' } } }, { $match: { count: { $ne: 20 } } }]).toArray(),
    questionCollection.aggregate([{ $match: { ...moduleMatch, subject: 'Arithmetic' } }, { $group: { _id: '$testId', skills: { $addToSet: '$skillCode' } } }, { $project: { count: { $size: '$skills' } } }, { $match: { count: { $ne: ARITHMETIC_SECTION_PLAN.length } } }]).toArray(),
    questionCollection.aggregate([{ $match: { ...moduleMatch, subject: 'Mental Ability' } }, { $group: { _id: '$testId', skills: { $addToSet: '$skillCode' } } }, { $project: { count: { $size: '$skills' } } }, { $match: { count: { $ne: MAT_SECTION_PLAN.length } } }]).toArray(),
    questionCollection.aggregate([{ $match: { ...moduleMatch, subject: 'Mental Ability' } }, { $group: { _id: { testId: '$testId', part: '$part' }, count: { $sum: 1 } } }, { $match: { count: { $ne: 4 } } }]).toArray(),
    testCollection.countDocuments({ ...moduleMatch, $or: [{ 'markingScheme.marksPerCorrectAnswer': { $ne: 1.25 } }, { 'markingScheme.negativeMarking': { $ne: 0 } }, { examMode: { $ne: 'Offline OMR-based' } }, { divyangExtraTimeMinutes: { $ne: 40 } }] })
  ]);
  const levelCounts = Object.fromEntries(levelRows.map((row) => [row._id, row.count]));
  const errors = [];
  if (questionCount !== 2400) errors.push(`Stored question count is ${questionCount}/2400.`);
  if (testCount !== 30) errors.push(`Stored test count is ${testCount}/30.`);
  for (const level of JNVST_LEVELS) if (levelCounts[level] !== 10) errors.push(`Stored ${level} test count is ${levelCounts[level] || 0}/10.`);
  if (sectionRows.length) errors.push(`${sectionRows.length} test/subject groups do not contain exactly 20 questions.`);
  if (invalidOptions) errors.push(`${invalidOptions} questions do not contain four options.`);
  if (invalidAnswers) errors.push(`${invalidAnswers} questions have answers outside their options.`);
  if (duplicateRows.length) errors.push('Duplicate question fingerprints exist in MongoDB.');
  if (promptDuplicateRows.length) errors.push('A test contains duplicate student-visible prompts in MongoDB.');
  if (renderDuplicateRows.length) errors.push('A test contains duplicate rendered questions in MongoDB.');
  if (languageRows.length) errors.push(`${languageRows.length} language passage groups do not contain five questions.`);
  if (evsPassageRows.length || evsStandaloneRows.length || evsTopicRows.length) errors.push('One or more EVS sections fail the 15+5 passage structure or 20-topic coverage rule.');
  if (arithmeticSkillRows.length) errors.push(`${arithmeticSkillRows.length} tests do not contain all ${ARITHMETIC_SECTION_PLAN.length} detailed Arithmetic skills.`);
  if (matSkillRows.length || matPartRows.length) errors.push('One or more MAT sections fail the 20-skill or five-parts-by-four structure.');
  if (invalidTestRules) errors.push(`${invalidTestRules} test documents contain incorrect exam-rule metadata.`);
  return { status: errors.length ? 'failed' : 'passed', database: databaseName, moduleVersion: TESTING_MODULE_VERSION, testCount, questionCount, levelCounts, invalidOptions, invalidAnswers, invalidSectionGroups: sectionRows.length, invalidLanguagePassageGroups: languageRows.length, invalidEvsPassageGroups: evsPassageRows.length, invalidEvsStandaloneGroups: evsStandaloneRows.length, invalidEvsTopicGroups: evsTopicRows.length, invalidArithmeticSkillGroups: arithmeticSkillRows.length, invalidMatSkillGroups: matSkillRows.length, invalidMatPartGroups: matPartRows.length, invalidTestRules, duplicateFingerprints: duplicateRows.length, duplicatePromptFingerprints: promptDuplicateRows.length, duplicateRenderFingerprints: renderDuplicateRows.length, errors };
}

try {
  const bank = generateTestingBank();
  const generationReport = validateTestingBank(bank);
  await client.connect();
  const db = client.db(databaseName);
  await Promise.all([
    ensureCollection(db, collections.questions, questionValidator),
    ensureCollection(db, collections.tests, testValidator),
    ensureCollection(db, collections.syllabus, { $jsonSchema: { bsonType: 'object', required: ['moduleVersion', 'subject', 'topics'] } }),
    ensureCollection(db, collections.validation, { $jsonSchema: { bsonType: 'object', required: ['moduleVersion', 'runAt', 'status'] } })
  ]);

  const questionCollection = db.collection(collections.questions);
  const testCollection = db.collection(collections.tests);
  await Promise.all([
    questionCollection.createIndex({ questionId: 1 }, { unique: true, name: 'uq_question_id' }),
    questionCollection.createIndex({ fingerprint: 1 }, { unique: true, name: 'uq_question_fingerprint' }),
    questionCollection.createIndex({ testId: 1, questionNumber: 1 }, { unique: true, name: 'uq_test_question_position' }),
    questionCollection.createIndex({ testId: 1, promptFingerprint: 1 }, { unique: true, name: 'uq_test_prompt_fingerprint' }),
    questionCollection.createIndex({ testId: 1, renderFingerprint: 1 }, { unique: true, name: 'uq_test_render_fingerprint' }),
    questionCollection.createIndex({ moduleVersion: 1, difficulty: 1, subject: 1, testId: 1, questionNumber: 1 }, { name: 'catalog_lookup' }),
    testCollection.createIndex({ testId: 1 }, { unique: true, name: 'uq_test_id' }),
    testCollection.createIndex({ moduleVersion: 1, difficulty: 1, number: 1 }, { name: 'test_catalog_lookup' })
  ]);

  const seededAt = new Date();
  await upsertInChunks(questionCollection, bank.questions, 'questionId', seededAt);
  await upsertInChunks(testCollection, bank.tests, 'testId', seededAt);
  await Promise.all([
    questionCollection.createIndex({ moduleVersion: 1, promptFingerprint: 1 }, { unique: true, name: 'uq_module_prompt_fingerprint' }),
    questionCollection.createIndex({ moduleVersion: 1, renderFingerprint: 1 }, { unique: true, name: 'uq_module_render_fingerprint' })
  ]);
  await upsertInChunks(db.collection(collections.syllabus), JNVST_BLUEPRINT.map((section) => ({
    syllabusKey: `${TESTING_MODULE_VERSION}-${section.key}`,
    moduleVersion: TESTING_MODULE_VERSION,
    syllabusYear: 2027,
    section: section.section,
    subject: section.subject,
    questionCountPerPaper: section.questionCount,
    topics: syllabusTopicNames(section),
    detailedPlan: section.key === 'mental'
      ? MAT_SECTION_PLAN
      : section.key === 'arithmetic'
        ? ARITHMETIC_SECTION_PLAN
        : section.key === 'language'
          ? LANGUAGE_SKILLS
          : { standaloneQuestions: 15, passageQuestions: 5, distinctTopicsPerPaper: 20 },
    sourceDocument: 'JNVST_Class6_2027_Syllabus.pdf'
  })), 'syllabusKey', seededAt);

  const databaseReport = await validateStoredData(db);
  await db.collection(collections.validation).insertOne({ moduleVersion: TESTING_MODULE_VERSION, runAt: seededAt, status: databaseReport.status, generationReport, databaseReport });
  if (databaseReport.status !== 'passed') throw new Error(`MongoDB validation failed:\n${databaseReport.errors.join('\n')}`);
  console.log(JSON.stringify({ generation: generationReport, mongodb: databaseReport }, null, 2));
} finally {
  await client.close();
}
