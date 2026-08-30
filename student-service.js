import { ObjectId } from 'mongodb';
import { AuthError, getTestingDatabase, instituteIdForUser, sessionUser } from './auth-service.js';
import { VIJETHA_COLLECTIONS } from './database-config.js';

const allowedCourses = new Set(['jnvst', 'sainik', 'rms']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9][0-9\s-]{6,18}[0-9]$/;
let studentIndexPromise;

function cleanText(value, field, { required = false, min = 0, max = 120 } = {}) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (required && clean.length < min) throw new AuthError(400, `INVALID_${field.toUpperCase()}`, `${field} must contain at least ${min} characters.`);
  if (clean.length > max) throw new AuthError(400, `INVALID_${field.toUpperCase()}`, `${field} must contain no more than ${max} characters.`);
  return clean;
}

function cleanEmail(value, field) {
  const clean = String(value || '').trim().toLowerCase();
  if (clean && (!emailPattern.test(clean) || clean.length > 254)) throw new AuthError(400, `INVALID_${field.toUpperCase()}`, `Enter a valid ${field}.`);
  return clean;
}

function cleanPhone(value, field) {
  const clean = String(value || '').trim();
  if (clean && !phonePattern.test(clean)) throw new AuthError(400, `INVALID_${field.toUpperCase()}`, `Enter a valid ${field}.`);
  return clean;
}

export function studentStatus(progress) {
  if (progress >= 70) return { state: 'On track', tone: 'green' };
  if (progress >= 50) return { state: 'Needs review', tone: 'amber' };
  return { state: 'At risk', tone: 'red' };
}

export function normalizeStudentInput(input = {}, { partial = false } = {}) {
  const output = {};
  const has = (field) => Object.prototype.hasOwnProperty.call(input, field);
  if (!partial || has('course')) {
    const course = String(input.course || '').trim().toLowerCase();
    if (!allowedCourses.has(course)) throw new AuthError(400, 'INVALID_COURSE', 'Choose JNVST, AISSEE, or RMS CET.');
    output.course = course;
  }
  if (!partial || has('name')) output.name = cleanText(input.name, 'name', { required: true, min: 2, max: 80 });
  if (!partial || has('batch')) output.batch = cleanText(input.batch, 'batch', { required: true, min: 2, max: 80 });
  if (!partial || has('guardian')) output.guardian = cleanText(input.guardian, 'guardian', { required: true, min: 2, max: 80 });
  if (!partial || has('email')) output.email = cleanEmail(input.email, 'student email');
  if (!partial || has('phone')) output.phone = cleanPhone(input.phone, 'student phone');
  if (!partial || has('guardianEmail')) output.guardianEmail = cleanEmail(input.guardianEmail, 'guardian email');
  if (!partial || has('guardianPhone')) output.guardianPhone = cleanPhone(input.guardianPhone, 'guardian phone');
  if (!partial || has('progress')) {
    const progress = Number(input.progress ?? 0);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw new AuthError(400, 'INVALID_PROGRESS', 'Progress must be between 0 and 100.');
    output.progress = Math.round(progress);
  }
  return output;
}

function objectId(value, label = 'student') {
  if (!ObjectId.isValid(String(value || ''))) throw new AuthError(400, 'INVALID_STUDENT_ID', `The ${label} identifier is invalid.`);
  return new ObjectId(String(value));
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function relativeActivity(date) {
  if (!date) return 'Never';
  const elapsed = Math.max(0, Date.now() - new Date(date).getTime());
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} hr ago`;
  if (elapsed < 172_800_000) return 'Yesterday';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(date));
}

function publicStudent(student) {
  const status = studentStatus(student.progress);
  return {
    id: String(student._id),
    course: student.course,
    name: student.name,
    initials: initials(student.name),
    email: student.email || '',
    phone: student.phone || '',
    guardian: student.guardian,
    guardianEmail: student.guardianEmail || '',
    guardianPhone: student.guardianPhone || '',
    batch: student.batch,
    progress: student.progress,
    ...status,
    last: relativeActivity(student.lastActiveAt || student.updatedAt),
    lastActiveAt: (student.lastActiveAt || student.updatedAt)?.toISOString?.() || null,
    createdAt: student.createdAt?.toISOString?.() || null,
    updatedAt: student.updatedAt?.toISOString?.() || null
  };
}

async function ownerContext(request, { mutate = false } = {}) {
  const user = await sessionUser(request);
  if (!user) throw new AuthError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to manage students.');
  if (!['administrator', 'principal', 'teacher'].includes(user.role)) throw new AuthError(403, 'STAFF_ACCESS_REQUIRED', 'Only institute staff can access students.');
  if (mutate && !['administrator', 'principal'].includes(user.role)) throw new AuthError(403, 'PRINCIPAL_REQUIRED', 'Only the principal can add, import, update, or remove students.');
  return { user, instituteId: instituteIdForUser(user), ownerId: objectId(user.id, 'account') };
}

function instituteFilter(instituteId) {
  return { $or: [{ instituteId }, { instituteId: { $exists: false } }] };
}

async function studentsCollection() {
  const db = await getTestingDatabase();
  if (!studentIndexPromise) {
    studentIndexPromise = Promise.all([
      db.collection(VIJETHA_COLLECTIONS.students).createIndex({ ownerId: 1, course: 1, name: 1 }),
      db.collection(VIJETHA_COLLECTIONS.students).createIndex({ ownerId: 1, course: 1, updatedAt: -1 }),
      db.collection(VIJETHA_COLLECTIONS.students).createIndex({ instituteId: 1, course: 1, name: 1 }),
      db.collection(VIJETHA_COLLECTIONS.students).createIndex({ instituteId: 1, course: 1, batch: 1 })
    ]).catch((error) => {
      studentIndexPromise = null;
      throw error;
    });
  }
  await studentIndexPromise;
  return db.collection(VIJETHA_COLLECTIONS.students);
}

export async function listStudents(request, query = {}) {
  const { instituteId } = await ownerContext(request);
  const course = String(query.course || '').toLowerCase();
  if (!allowedCourses.has(course)) throw new AuthError(400, 'INVALID_COURSE', 'Choose a valid entrance exam.');
  const search = String(query.query || '').trim().slice(0, 80);
  const filter = { course, ...instituteFilter(instituteId) };
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$and = [{ $or: ['name', 'batch', 'guardian', 'email', 'guardianEmail'].map((field) => ({ [field]: { $regex: escaped, $options: 'i' } })) }];
  }
  const collection = await studentsCollection();
  const rows = await collection.find(filter).sort({ name: 1 }).limit(500).toArray();
  return rows.map(publicStudent);
}

export async function createStudent(request, input) {
  const { instituteId, ownerId } = await ownerContext(request, { mutate: true });
  const values = normalizeStudentInput(input);
  const now = new Date();
  const document = { ...values, instituteId, ownerId, createdAt: now, updatedAt: now, lastActiveAt: now };
  const collection = await studentsCollection();
  const result = await collection.insertOne(document);
  return publicStudent({ ...document, _id: result.insertedId });
}

export async function createStudents(request, input = {}) {
  const { instituteId, ownerId } = await ownerContext(request, { mutate: true });
  const rows = Array.isArray(input.students) ? input.students : [];
  if (!rows.length || rows.length > 500) throw new AuthError(400, 'INVALID_IMPORT_SIZE', 'Import between 1 and 500 students at a time.');
  const values = rows.map((row) => normalizeStudentInput(row));
  const keys = values.map((row) => `${row.course}|${row.batch.toLowerCase()}|${row.name.toLowerCase()}`);
  if (new Set(keys).size !== keys.length) throw new AuthError(409, 'DUPLICATE_IMPORT', 'The import contains duplicate student names in the same batch.');
  const collection = await studentsCollection();
  const existing = await collection.find({
    $and: [
      instituteFilter(instituteId),
      { $or: values.map((row) => ({ course: row.course, batch: row.batch, name: { $regex: `^${row.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })) },
    ],
  }, { projection: { name: 1, batch: 1 } }).limit(500).toArray();
  if (existing.length) throw new AuthError(409, 'STUDENT_EXISTS', `${existing[0].name} already exists in ${existing[0].batch}.`);
  const now = new Date();
  const documents = values.map((row) => ({ ...row, instituteId, ownerId, createdAt: now, updatedAt: now, lastActiveAt: now }));
  const result = await collection.insertMany(documents, { ordered: true });
  return documents.map((document, index) => publicStudent({ ...document, _id: result.insertedIds[index] }));
}

export async function updateStudent(request, id, input) {
  const { instituteId } = await ownerContext(request, { mutate: true });
  const values = normalizeStudentInput(input, { partial: true });
  if (!Object.keys(values).length) throw new AuthError(400, 'NO_STUDENT_CHANGES', 'Provide at least one student field to update.');
  const collection = await studentsCollection();
  const result = await collection.findOneAndUpdate(
    { _id: objectId(id), ...instituteFilter(instituteId) },
    { $set: { ...values, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!result) throw new AuthError(404, 'STUDENT_NOT_FOUND', 'The student was not found.');
  return publicStudent(result);
}

export async function deleteStudent(request, id) {
  const { instituteId } = await ownerContext(request, { mutate: true });
  const collection = await studentsCollection();
  const result = await collection.deleteOne({ _id: objectId(id), ...instituteFilter(instituteId) });
  if (!result.deletedCount) throw new AuthError(404, 'STUDENT_NOT_FOUND', 'The student was not found.');
}
