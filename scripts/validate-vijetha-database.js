import { MongoClient } from 'mongodb';
import { VIJETHA_COLLECTIONS, VIJETHA_DATABASE_NAME } from '../database-config.js';
import { COURSE_KEYS, courseCollectionNames, getExamCourse } from '../exam-courses.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 3, serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const db = client.db(VIJETHA_DATABASE_NAME);
  await db.command({ ping: 1 });
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  const platformCollections = [
    ...Object.values(VIJETHA_COLLECTIONS).filter((name) => name !== VIJETHA_COLLECTIONS.resourceFilesBucket),
    `${VIJETHA_COLLECTIONS.resourceFilesBucket}.files`,
    `${VIJETHA_COLLECTIONS.resourceFilesBucket}.chunks`,
  ];
  const missingPlatform = platformCollections.filter((name) => !existing.has(name));
  const courses = {};
  for (const key of COURSE_KEYS) {
    const course = getExamCourse(key);
    const names = courseCollectionNames(key);
    const missing = Object.values(names).filter((name) => !existing.has(name));
    const [tests, questions, syllabus, validations] = await Promise.all([
      db.collection(names.tests).countDocuments({ moduleVersion: course.moduleVersion, status: 'validated' }),
      db.collection(names.questions).countDocuments({ moduleVersion: course.moduleVersion, status: 'validated' }),
      db.collection(names.syllabus).countDocuments({ moduleVersion: course.moduleVersion }),
      db.collection(names.validation).countDocuments({ moduleVersion: course.moduleVersion, status: 'passed' }),
    ]);
    courses[key] = { tests, questions, syllabus, validations, missing };
  }
  const expectedQuestions = { jnvst: 2400, sainik: 3750, rms: 6000 };
  const errors = [...missingPlatform.map((name) => `Missing ${name}`)];
  for (const key of COURSE_KEYS) {
    const row = courses[key];
    if (row.missing.length) errors.push(`${key} missing: ${row.missing.join(', ')}`);
    if (row.tests !== 30) errors.push(`${key} has ${row.tests}/30 tests`);
    if (row.questions !== expectedQuestions[key]) errors.push(`${key} has ${row.questions}/${expectedQuestions[key]} questions`);
    if (row.syllabus !== 4) errors.push(`${key} has ${row.syllabus}/4 syllabus sections`);
    if (row.validations < 1) errors.push(`${key} has no passing validation report`);
  }
  const courseProfiles = await db.collection(VIJETHA_COLLECTIONS.courseCatalog).countDocuments({ course: { $in: COURSE_KEYS } });
  if (courseProfiles !== 3) errors.push(`course catalog has ${courseProfiles}/3 profiles`);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ status: 'passed', database: VIJETHA_DATABASE_NAME, courseProfiles, courses }, null, 2));
} finally {
  await client.close();
}
