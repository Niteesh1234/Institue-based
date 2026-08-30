import { GridFSBucket, MongoClient } from 'mongodb';
import { VIJETHA_COLLECTIONS, VIJETHA_DATABASE_NAME, VIJETHA_INSTITUTE_ID } from '../database-config.js';
import { COURSE_KEYS, getExamCourse } from '../exam-courses.js';
import { DEFAULT_INSTITUTE_CONTROL_DOCUMENT } from '../institute-control-service.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 });

async function ensureCollection(db, name) {
  if (!await db.listCollections({ name }, { nameOnly: true }).hasNext()) await db.createCollection(name);
  return db.collection(name);
}

try {
  await client.connect();
  const db = client.db(VIJETHA_DATABASE_NAME);
  const now = new Date();
  const collections = Object.values(VIJETHA_COLLECTIONS)
    .filter((name) => name !== VIJETHA_COLLECTIONS.resourceFilesBucket);
  const gridFiles = `${VIJETHA_COLLECTIONS.resourceFilesBucket}.files`;
  const gridChunks = `${VIJETHA_COLLECTIONS.resourceFilesBucket}.chunks`;
  await Promise.all([...collections, gridFiles, gridChunks].map((name) => ensureCollection(db, name)));
  await Promise.all([
    db.collection(VIJETHA_COLLECTIONS.authUsers).createIndex({ email: 1 }, { unique: true }),
    db.collection(VIJETHA_COLLECTIONS.authUsers).createIndex({ instituteId: 1, status: 1, role: 1 }),
    db.collection(VIJETHA_COLLECTIONS.authOtps).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(VIJETHA_COLLECTIONS.authOtps).createIndex({ email: 1, purpose: 1, createdAt: -1 }),
    db.collection(VIJETHA_COLLECTIONS.authSessions).createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection(VIJETHA_COLLECTIONS.authSessions).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(VIJETHA_COLLECTIONS.authAttempts).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(VIJETHA_COLLECTIONS.students).createIndex({ ownerId: 1, course: 1, name: 1 }),
    db.collection(VIJETHA_COLLECTIONS.students).createIndex({ instituteId: 1, course: 1, name: 1 }),
    db.collection(VIJETHA_COLLECTIONS.batchExams).createIndex({ ownerId: 1, course: 1, createdAt: -1 }),
    db.collection(VIJETHA_COLLECTIONS.batchExams).createIndex({ instituteId: 1, course: 1, createdAt: -1 }),
    db.collection(VIJETHA_COLLECTIONS.resources).createIndex({ ownerId: 1, course: 1, createdAt: -1 }),
    db.collection(VIJETHA_COLLECTIONS.resources).createIndex({ instituteId: 1, course: 1, createdAt: -1 }),
    db.collection(VIJETHA_COLLECTIONS.examSubmissions).createIndex({ examId: 1, studentId: 1 }, { unique: true }),
    db.collection(VIJETHA_COLLECTIONS.examSubmissions).createIndex({ instituteId: 1, examId: 1, submittedAt: -1 }),
    db.collection(VIJETHA_COLLECTIONS.instituteControl).createIndex({ scope: 1 }, { unique: true }),
    db.collection(VIJETHA_COLLECTIONS.courseCatalog).createIndex({ course: 1 }, { unique: true }),
    db.collection(gridFiles).createIndex({ filename: 1, uploadDate: 1 }),
    db.collection(gridChunks).createIndex({ files_id: 1, n: 1 }, { unique: true }),
  ]);
  await Promise.all([
    db.collection(VIJETHA_COLLECTIONS.authUsers).updateMany({ instituteId: { $exists: false } }, { $set: { instituteId: VIJETHA_INSTITUTE_ID } }),
    db.collection(VIJETHA_COLLECTIONS.students).updateMany({ instituteId: { $exists: false } }, { $set: { instituteId: VIJETHA_INSTITUTE_ID } }),
    db.collection(VIJETHA_COLLECTIONS.batchExams).updateMany({ instituteId: { $exists: false } }, { $set: { instituteId: VIJETHA_INSTITUTE_ID } }),
    db.collection(VIJETHA_COLLECTIONS.resources).updateMany({ instituteId: { $exists: false } }, { $set: { instituteId: VIJETHA_INSTITUTE_ID } }),
  ]);
  await db.collection(VIJETHA_COLLECTIONS.instituteControl).updateOne(
    { scope: VIJETHA_INSTITUTE_ID },
    { $setOnInsert: { ...DEFAULT_INSTITUTE_CONTROL_DOCUMENT, scope: VIJETHA_INSTITUTE_ID, createdAt: now, updatedAt: now } },
    { upsert: true },
  );
  await db.collection(VIJETHA_COLLECTIONS.courseCatalog).bulkWrite(COURSE_KEYS.map((key) => {
    const course = getExamCourse(key);
    return {
      updateOne: {
        filter: { course: key },
        update: { $set: { ...course, course: key, updatedAt: now }, $setOnInsert: { createdAt: now } },
        upsert: true,
      },
    };
  }));
  // Keep the native GridFS bucket ready for teacher note and PDF uploads.
  new GridFSBucket(db, { bucketName: VIJETHA_COLLECTIONS.resourceFilesBucket });
  console.log(JSON.stringify({ status: 'passed', database: VIJETHA_DATABASE_NAME, collections: [...collections, gridFiles, gridChunks], courses: COURSE_KEYS }, null, 2));
} finally {
  await client.close();
}
