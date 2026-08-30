import { ObjectId } from 'mongodb';
import { AuthError, getTestingDatabase, instituteIdForUser, sessionUser } from './auth-service.js';
import { VIJETHA_COLLECTIONS, VIJETHA_INSTITUTE_ID } from './database-config.js';

export const DEFAULT_INSTITUTE_CONTROL_DOCUMENT = Object.freeze({
  policies: {
    maxBatches: 12,
    teacherCanCreateExams: true,
    teacherCanUploadQuestions: true,
    teacherCanPrint: false,
    studentCanPrint: false,
    feedbackMode: 'after-submit',
  },
  teachers: [
    { id: 'teacher-priya', name: 'Priya Sharma', email: 'priya@vijetha.in', status: 'approved' },
    { id: 'teacher-ravi', name: 'Ravi Verma', email: 'ravi@vijetha.in', status: 'approved' },
    { id: 'teacher-anita', name: 'Anita Rao', email: 'anita@vijetha.in', status: 'approved' },
  ],
  batches: [
    { name: 'JNVST Morning A', mentor: 'Priya Sharma', students: 32, schedule: 'Mon–Fri · 7:00 AM', next: 'MAT · Pattern Completion' },
    { name: 'JNVST Evening B', mentor: 'Ravi Verma', students: 28, schedule: 'Mon–Fri · 5:30 PM', next: 'EVS · Water Cycle' },
    { name: 'JNVST Weekend', mentor: 'Anita Rao', students: 24, schedule: 'Sat–Sun · 9:00 AM', next: 'Arithmetic · Fractions' },
  ],
  exams: [],
  questionUploads: [],
  prepaidBalance: 0,
  ledger: [],
  audit: [],
});

async function context(request) {
  const user = await sessionUser(request);
  if (!user) throw new AuthError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to manage institute controls.');
  if (!['administrator', 'principal', 'teacher'].includes(user.role)) {
    throw new AuthError(403, 'STAFF_ACCESS_REQUIRED', 'Only institute staff can access institute controls.');
  }
  const db = await getTestingDatabase();
  const instituteId = instituteIdForUser(user);
  const collection = db.collection(VIJETHA_COLLECTIONS.instituteControl);
  await collection.createIndex({ scope: 1 }, { unique: true });
  return { user, db, instituteId, collection };
}

function normalizedControl(value = {}) {
  const policies = { ...DEFAULT_INSTITUTE_CONTROL_DOCUMENT.policies, ...(value.policies || {}) };
  policies.maxBatches = Math.min(12, Math.max(1, Number(policies.maxBatches) || 12));
  policies.feedbackMode = 'after-submit';
  policies.teacherCanPrint = false;
  policies.studentCanPrint = false;
  return {
    policies,
    teachers: Array.isArray(value.teachers) ? value.teachers.slice(0, 100) : [],
    batches: Array.isArray(value.batches) ? value.batches.slice(0, 12) : DEFAULT_INSTITUTE_CONTROL_DOCUMENT.batches,
    exams: Array.isArray(value.exams) ? value.exams.slice(0, 100) : [],
    questionUploads: Array.isArray(value.questionUploads) ? value.questionUploads.slice(0, 100) : [],
    prepaidBalance: Math.max(0, Number(value.prepaidBalance) || 0),
    ledger: Array.isArray(value.ledger) ? value.ledger.slice(0, 500) : [],
    audit: Array.isArray(value.audit) ? value.audit.slice(0, 500) : [],
  };
}

function output(document, staffAccounts = []) {
  const { _id, scope, createdAt, updatedAt, ...control } = document || {};
  return { ...normalizedControl(control), staffAccounts, updatedAt };
}

async function staffAccounts(db, instituteId) {
  const rows = await db.collection(VIJETHA_COLLECTIONS.authUsers)
    .find(
      { $and: [{ $or: [{ instituteId }, { instituteId: { $exists: false } }] }, { role: 'teacher' }] },
      { projection: { name: 1, email: 1, role: 1, status: 1, emailVerifiedAt: 1, createdAt: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return rows.map((row) => ({
    id: String(row._id),
    name: row.name,
    email: row.email,
    role: row.role || 'teacher',
    status: row.status || 'pending',
    emailVerified: Boolean(row.emailVerifiedAt),
  }));
}

export async function loadInstitutePolicies(db, instituteId = VIJETHA_INSTITUTE_ID) {
  const document = await db.collection(VIJETHA_COLLECTIONS.instituteControl).findOne(
    { scope: instituteId },
    { projection: { policies: 1 } },
  );
  return { ...DEFAULT_INSTITUTE_CONTROL_DOCUMENT.policies, ...(document?.policies || {}) };
}

export async function getInstituteControl(request) {
  const { db, instituteId, collection } = await context(request);
  const document = await collection.findOne({ scope: instituteId });
  const accounts = await staffAccounts(db, instituteId);
  if (document) return output(document, accounts);
  const now = new Date();
  const initial = { ...normalizedControl(DEFAULT_INSTITUTE_CONTROL_DOCUMENT), scope: instituteId, createdAt: now, updatedAt: now };
  await collection.updateOne({ scope: instituteId }, { $setOnInsert: initial }, { upsert: true });
  return output(initial, accounts);
}

export async function saveInstituteControl(request, input) {
  const { user, instituteId, collection } = await context(request);
  if (!['administrator', 'principal'].includes(user.role)) {
    throw new AuthError(403, 'PRINCIPAL_REQUIRED', 'Only the principal can change institute controls.');
  }
  const control = normalizedControl(input);
  const now = new Date();
  await collection.updateOne(
    { scope: instituteId },
    { $set: { ...control, updatedAt: now }, $setOnInsert: { scope: instituteId, createdAt: now } },
    { upsert: true },
  );
  return { ...control, updatedAt: now };
}

export async function changeStaffAccess(request, input = {}) {
  const { user, db, instituteId } = await context(request);
  if (!['administrator', 'principal'].includes(user.role)) {
    throw new AuthError(403, 'PRINCIPAL_REQUIRED', 'Only the principal can approve or suspend staff access.');
  }
  if (!ObjectId.isValid(String(input.userId || ''))) throw new AuthError(400, 'INVALID_USER_ID', 'Choose a valid staff account.');
  if (String(input.userId) === String(user.id)) throw new AuthError(400, 'SELF_ACCESS_CHANGE', 'You cannot suspend your own principal account.');
  const requestedStatus = input.status || (input.action === 'approve' ? 'active' : input.action === 'suspend' ? 'suspended' : '');
  const status = requestedStatus === 'active' ? 'active' : requestedStatus === 'suspended' ? 'suspended' : null;
  if (!status) throw new AuthError(400, 'INVALID_ACCOUNT_STATUS', 'Choose approved or suspended access.');
  const users = db.collection(VIJETHA_COLLECTIONS.authUsers);
  const targetId = new ObjectId(String(input.userId));
  const target = await users.findOne({ _id: targetId, $or: [{ instituteId }, { instituteId: { $exists: false } }] });
  if (!target) throw new AuthError(404, 'STAFF_NOT_FOUND', 'The staff account was not found.');
  if (['administrator', 'principal'].includes(target.role)) throw new AuthError(403, 'PRINCIPAL_ACCOUNT_PROTECTED', 'Principal administrator access cannot be changed from the teacher approval list.');
  if (status === 'active' && !target.emailVerifiedAt) throw new AuthError(409, 'EMAIL_NOT_VERIFIED', 'The teacher must verify their email before approval.');
  await users.updateOne(
    { _id: targetId },
    { $set: { status, instituteId, approvedBy: new ObjectId(user.id), approvedAt: status === 'active' ? new Date() : null, updatedAt: new Date() } },
  );
  if (status === 'suspended') await db.collection(VIJETHA_COLLECTIONS.authSessions).deleteMany({ userId: targetId });
  return { staffAccounts: await staffAccounts(db, instituteId) };
}
