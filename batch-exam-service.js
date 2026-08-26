import { ObjectId } from 'mongodb';
import { AuthError, getTestingDatabase, sessionUser } from './auth-service.js';
import { composeBatchExam } from './batch-exam-engine.js';
import { getExamCourse } from './exam-courses.js';
import { loadCatalog } from './vercel-catalog.js';

let indexPromise;

function objectId(value, label = 'identifier') {
  if (!ObjectId.isValid(String(value || ''))) throw new AuthError(400, 'INVALID_ID', `The ${label} is invalid.`);
  return new ObjectId(String(value));
}

function cleanText(value, field, { min = 2, max = 120 } = {}) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (clean.length < min || clean.length > max) throw new AuthError(400, `INVALID_${field.toUpperCase()}`, `${field} must contain ${min}–${max} characters.`);
  return clean;
}

function normalizeCourse(value) {
  const key = String(value || '').toLowerCase();
  if (!['jnvst', 'sainik', 'rms'].includes(key)) throw new AuthError(400, 'INVALID_COURSE', 'Choose JNVST, AISSEE, or RMS CET.');
  return getExamCourse(key).key;
}

async function staffContext(request) {
  const user = await sessionUser(request);
  if (!user) throw new AuthError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to manage batch exams.');
  if (!['administrator', 'principal', 'teacher'].includes(user.role)) throw new AuthError(403, 'STAFF_ACCESS_REQUIRED', 'Only institute staff can manage batch exams.');
  return { user, ownerId: objectId(user.id, 'account identifier') };
}

async function collections() {
  const db = await getTestingDatabase();
  if (!indexPromise) {
    indexPromise = Promise.all([
      db.collection('batch_exams').createIndex({ ownerId: 1, course: 1, createdAt: -1 }),
      db.collection('batch_exams').createIndex({ ownerId: 1, course: 1, batch: 1, startsAt: 1 }),
    ]).catch((error) => { indexPromise = null; throw error; });
  }
  await indexPromise;
  return { exams: db.collection('batch_exams'), students: db.collection('students') };
}

function safeQuestion(question) {
  const { correctOption, answer, explanation, ...safe } = question;
  return safe;
}

function publicExam(exam, includeQuestions = false) {
  return {
    id: String(exam._id),
    course: exam.course,
    title: exam.title,
    batch: exam.batch,
    teacher: exam.teacher,
    startsAt: exam.startsAt?.toISOString?.() || null,
    status: exam.status,
    questionCount: exam.questionCount,
    levelCounts: exam.levelCounts,
    subjectCounts: exam.subjectCounts,
    assignedStudentCount: exam.assignedStudentIds?.length || 0,
    createdAt: exam.createdAt?.toISOString?.() || null,
    ...(includeQuestions ? { questions: exam.questions.map(safeQuestion) } : {}),
  };
}

export async function listBatchExams(request, query = {}) {
  const { ownerId } = await staffContext(request);
  const course = normalizeCourse(query.course);
  const { exams } = await collections();
  if (query.id) {
    const exam = await exams.findOne({ _id: objectId(query.id, 'batch exam identifier'), ownerId, course });
    if (!exam) throw new AuthError(404, 'BATCH_EXAM_NOT_FOUND', 'The batch exam was not found.');
    return [publicExam(exam, true)];
  }
  const rows = await exams.find({ ownerId, course }).sort({ createdAt: -1 }).limit(100).toArray();
  return rows.map((exam) => publicExam(exam));
}

export async function createBatchExam(request, input = {}) {
  const { user, ownerId } = await staffContext(request);
  const course = normalizeCourse(input.course);
  const title = cleanText(input.title, 'title', { min: 3, max: 120 });
  const batch = cleanText(input.batch, 'batch', { min: 2, max: 80 });
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) throw new AuthError(400, 'INVALID_START_TIME', 'Choose a valid exam start time.');
  const { exams, students } = await collections();
  const assignedStudents = await students.find({ ownerId, course, batch }).project({ _id: 1 }).limit(500).toArray();
  if (!assignedStudents.length) throw new AuthError(400, 'EMPTY_BATCH', 'Add students to this batch before creating its exam.');

  const previous = await exams.find({ ownerId, course }).project({ questionIds: 1 }).limit(100).toArray();
  const excludedQuestionIds = previous.flatMap((exam) => exam.questionIds || []);
  const catalog = await loadCatalog({ course, includeQuestions: true });
  const bankQuestions = catalog.tests.flatMap((test) => test.questions);
  let composed;
  try {
    composed = composeBatchExam({
      courseKey: course,
      questions: bankQuestions,
      seed: `${ownerId}:${course}:${batch}:${Date.now()}`,
      excludedQuestionIds,
    });
  } catch (error) {
    throw new AuthError(409, 'QUESTION_POOL_EXHAUSTED', error.message);
  }
  const now = new Date();
  const document = {
    ownerId,
    course,
    title,
    batch,
    teacher: user.name,
    teacherId: ownerId,
    startsAt,
    status: startsAt ? 'scheduled' : 'draft',
    questionCount: composed.questionCount,
    levelCounts: composed.levelCounts,
    subjectCounts: composed.subjectCounts,
    subjectTargetsPerLevel: composed.subjectTargetsPerLevel,
    assignedStudentIds: assignedStudents.map((student) => student._id),
    questionIds: composed.questions.map((question) => question.questionId),
    questions: composed.questions,
    source: catalog.source,
    createdAt: now,
    updatedAt: now,
  };
  const result = await exams.insertOne(document);
  return publicExam({ ...document, _id: result.insertedId });
}

export async function deleteBatchExam(request, id) {
  const { user, ownerId } = await staffContext(request);
  if (!['administrator', 'principal'].includes(user.role)) throw new AuthError(403, 'PRINCIPAL_REQUIRED', 'Only the principal can delete a batch exam.');
  const { exams } = await collections();
  const result = await exams.deleteOne({ _id: objectId(id, 'batch exam identifier'), ownerId });
  if (!result.deletedCount) throw new AuthError(404, 'BATCH_EXAM_NOT_FOUND', 'The batch exam was not found.');
}
