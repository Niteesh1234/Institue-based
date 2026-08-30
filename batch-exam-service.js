import { ObjectId } from 'mongodb';
import { AuthError, getTestingDatabase, instituteIdForUser, sessionUser } from './auth-service.js';
import { VIJETHA_COLLECTIONS } from './database-config.js';
import { composeBatchExam } from './batch-exam-engine.js';
import { getExamCourse } from './exam-courses.js';
import { loadInstitutePolicies } from './institute-control-service.js';
import { resolveStudentAccess } from './resource-service.js';
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
  return { user, instituteId: instituteIdForUser(user), ownerId: objectId(user.id, 'account identifier') };
}

function instituteFilter(instituteId) {
  return { $or: [{ instituteId }, { instituteId: { $exists: false } }] };
}

async function collections() {
  const db = await getTestingDatabase();
  if (!indexPromise) {
    indexPromise = Promise.all([
      db.collection(VIJETHA_COLLECTIONS.batchExams).createIndex({ ownerId: 1, course: 1, createdAt: -1 }),
      db.collection(VIJETHA_COLLECTIONS.batchExams).createIndex({ ownerId: 1, course: 1, batch: 1, startsAt: 1 }),
      db.collection(VIJETHA_COLLECTIONS.batchExams).createIndex({ instituteId: 1, course: 1, createdAt: -1 }),
      db.collection(VIJETHA_COLLECTIONS.batchExams).createIndex({ instituteId: 1, course: 1, batch: 1, startsAt: 1 }),
      db.collection(VIJETHA_COLLECTIONS.examSubmissions).createIndex({ examId: 1, studentId: 1 }, { unique: true }),
      db.collection(VIJETHA_COLLECTIONS.examSubmissions).createIndex({ instituteId: 1, examId: 1, submittedAt: -1 }),
    ]).catch((error) => { indexPromise = null; throw error; });
  }
  await indexPromise;
  return {
    db,
    exams: db.collection(VIJETHA_COLLECTIONS.batchExams),
    students: db.collection(VIJETHA_COLLECTIONS.students),
    submissions: db.collection(VIJETHA_COLLECTIONS.examSubmissions),
  };
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
  const { instituteId } = await staffContext(request);
  const course = normalizeCourse(query.course);
  const { exams } = await collections();
  if (query.id) {
    const exam = await exams.findOne({ _id: objectId(query.id, 'batch exam identifier'), course, ...instituteFilter(instituteId) });
    if (!exam) throw new AuthError(404, 'BATCH_EXAM_NOT_FOUND', 'The batch exam was not found.');
    return [publicExam(exam, true)];
  }
  const rows = await exams.find({ course, ...instituteFilter(instituteId) }).sort({ createdAt: -1 }).limit(100).toArray();
  return rows.map((exam) => publicExam(exam));
}

export async function createBatchExam(request, input = {}) {
  const { user, instituteId, ownerId } = await staffContext(request);
  const course = normalizeCourse(input.course);
  const title = cleanText(input.title, 'title', { min: 3, max: 120 });
  const batch = cleanText(input.batch, 'batch', { min: 2, max: 80 });
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) throw new AuthError(400, 'INVALID_START_TIME', 'Choose a valid exam start time.');
  const { db, exams, students } = await collections();
  const policies = await loadInstitutePolicies(db, instituteId);
  if (user.role === 'teacher' && !policies.teacherCanCreateExams) throw new AuthError(403, 'TEACHER_EXAM_DISABLED', 'The principal has disabled teacher-created exams.');
  const control = await db.collection(VIJETHA_COLLECTIONS.instituteControl).findOne({ scope: instituteId }, { projection: { batches: 1 } });
  if (!control?.batches?.some((row) => row.name === batch)) throw new AuthError(400, 'INVALID_BATCH', 'Choose one of the principal-approved batches.');
  const assignedStudents = await students.find({ course, batch, ...instituteFilter(instituteId) }).project({ _id: 1 }).limit(500).toArray();
  if (!assignedStudents.length) throw new AuthError(400, 'EMPTY_BATCH', 'Add students to this batch before creating its exam.');

  const previous = await exams.find({ course, ...instituteFilter(instituteId) }).project({ questionIds: 1 }).limit(100).toArray();
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
    instituteId,
    ownerId,
    course,
    title,
    batch,
    teacher: user.name,
    teacherId: ownerId,
    startsAt,
    status: startsAt ? 'scheduled' : 'active',
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
  const { user, instituteId } = await staffContext(request);
  if (!['administrator', 'principal'].includes(user.role)) throw new AuthError(403, 'PRINCIPAL_REQUIRED', 'Only the principal can delete a batch exam.');
  const { exams } = await collections();
  const result = await exams.deleteOne({ _id: objectId(id, 'batch exam identifier'), ...instituteFilter(instituteId) });
  if (!result.deletedCount) throw new AuthError(404, 'BATCH_EXAM_NOT_FOUND', 'The batch exam was not found.');
}

function studentExamSummary(exam, submission = null) {
  const scheduled = exam.startsAt && exam.startsAt > new Date();
  return {
    id: String(exam._id),
    course: exam.course,
    title: exam.title,
    batch: exam.batch,
    teacher: exam.teacher,
    startsAt: exam.startsAt?.toISOString?.() || null,
    status: submission ? 'submitted' : scheduled ? 'scheduled' : exam.status,
    questionCount: exam.questionCount,
    levelCounts: exam.levelCounts,
    submitted: Boolean(submission),
    result: submission ? {
      score: submission.score,
      totalMarks: submission.totalMarks,
      attempted: submission.attempted,
      submittedAt: submission.submittedAt?.toISOString?.() || null,
    } : null,
  };
}

export async function listStudentBatchExams(studentId, token) {
  const { student } = await resolveStudentAccess(studentId, token);
  const { exams, submissions } = await collections();
  const [rows, submittedRows] = await Promise.all([
    exams.find({
      course: student.course,
      assignedStudentIds: student._id,
      ...instituteFilter(student.instituteId),
    }).sort({ createdAt: -1 }).limit(100).toArray(),
    submissions.find({ studentId: student._id }, { projection: { examId: 1, score: 1, totalMarks: 1, attempted: 1, submittedAt: 1 } }).limit(100).toArray(),
  ]);
  const byExam = new Map(submittedRows.map((row) => [String(row.examId), row]));
  return rows.map((exam) => studentExamSummary(exam, byExam.get(String(exam._id))));
}

export async function getStudentBatchExam(studentId, token, examId) {
  const { student } = await resolveStudentAccess(studentId, token);
  const { exams, submissions } = await collections();
  const id = objectId(examId, 'batch exam identifier');
  const [exam, submission] = await Promise.all([
    exams.findOne({ _id: id, course: student.course, assignedStudentIds: student._id, ...instituteFilter(student.instituteId) }),
    submissions.findOne({ examId: id, studentId: student._id }),
  ]);
  if (!exam) throw new AuthError(404, 'BATCH_EXAM_NOT_FOUND', 'This exam is not assigned to the student.');
  if (exam.startsAt && exam.startsAt > new Date()) throw new AuthError(403, 'EXAM_NOT_STARTED', 'This exam has not started yet.');
  if (exam.status === 'draft') throw new AuthError(403, 'EXAM_NOT_ACTIVE', 'This exam has not been released by the institute.');
  return {
    ...studentExamSummary(exam, submission),
    questions: submission ? [] : exam.questions.map(safeQuestion),
  };
}

export async function submitStudentBatchExam(studentId, token, examId, input = {}) {
  const { student } = await resolveStudentAccess(studentId, token);
  const { exams, submissions } = await collections();
  const id = objectId(examId, 'batch exam identifier');
  const exam = await exams.findOne({ _id: id, course: student.course, assignedStudentIds: student._id, ...instituteFilter(student.instituteId) });
  if (!exam) throw new AuthError(404, 'BATCH_EXAM_NOT_FOUND', 'This exam is not assigned to the student.');
  if (exam.startsAt && exam.startsAt > new Date()) throw new AuthError(403, 'EXAM_NOT_STARTED', 'This exam has not started yet.');
  if (exam.status === 'draft') throw new AuthError(403, 'EXAM_NOT_ACTIVE', 'This exam has not been released by the institute.');
  const supplied = input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers) ? input.answers : {};
  const validQuestionIds = new Set(exam.questions.map((question) => String(question.questionId)));
  const answers = Object.fromEntries(Object.entries(supplied)
    .filter(([questionId, option]) => validQuestionIds.has(questionId) && /^[A-D]$/.test(String(option)))
    .slice(0, exam.questionCount));
  const score = exam.questions.reduce((total, question) => {
    const correct = String(question.correctOption || question.answer || '');
    return total + (answers[String(question.questionId)] === correct ? Number(question.marks || 1) : 0);
  }, 0);
  const totalMarks = exam.questions.reduce((total, question) => total + Number(question.marks || 1), 0);
  const document = {
    instituteId: student.instituteId,
    examId: exam._id,
    studentId: student._id,
    course: student.course,
    batch: student.batch,
    answers,
    attempted: Object.keys(answers).length,
    score,
    totalMarks,
    submittedAt: new Date(),
  };
  try {
    await submissions.insertOne(document);
  } catch (error) {
    if (error?.code === 11000) throw new AuthError(409, 'EXAM_ALREADY_SUBMITTED', 'This exam was already submitted. Answers are locked.');
    throw error;
  }
  return studentExamSummary(exam, document).result;
}
