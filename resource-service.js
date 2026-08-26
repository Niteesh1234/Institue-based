import { createHash, randomBytes } from 'node:crypto';
import { GridFSBucket, ObjectId } from 'mongodb';
import { AuthError, getTestingDatabase, sessionUser } from './auth-service.js';

const allowedCourses = new Set(['jnvst', 'sainik', 'rms']);
const allowedTypes = new Set(['note', 'test']);
const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const maxFileBytes = 3 * 1024 * 1024;
let resourceIndexPromise;

function objectId(value, code = 'INVALID_ID', message = 'The identifier is invalid.') {
  if (!ObjectId.isValid(String(value || ''))) throw new AuthError(400, code, message);
  return new ObjectId(String(value));
}

function cleanText(value, field, { required = false, min = 0, max = 500 } = {}) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (required && clean.length < min) throw new AuthError(400, `INVALID_${field.toUpperCase()}`, `${field} must contain at least ${min} characters.`);
  if (clean.length > max) throw new AuthError(400, `INVALID_${field.toUpperCase()}`, `${field} must contain no more than ${max} characters.`);
  return clean;
}

function normalizeCourse(value) {
  const course = String(value || '').trim().toLowerCase();
  if (!allowedCourses.has(course)) throw new AuthError(400, 'INVALID_COURSE', 'Choose JNVST, AISSEE, or RMS CET.');
  return course;
}

function tokenHash(token) {
  return createHash('sha256').update(String(token || '')).digest('base64url');
}

function safeFilename(value) {
  const clean = String(value || 'resource').trim().replace(/[^a-zA-Z0-9._ -]/g, '').replace(/\s+/g, '-').slice(0, 120);
  return clean || 'resource';
}

export function normalizeResourceInput(input = {}) {
  const type = String(input.type || '').trim().toLowerCase();
  if (!allowedTypes.has(type)) throw new AuthError(400, 'INVALID_RESOURCE_TYPE', 'Choose Notes or Test paper.');
  const studentIds = [...new Set(Array.isArray(input.studentIds) ? input.studentIds.map(String) : [])];
  if (!studentIds.length) throw new AuthError(400, 'ASSIGNMENT_REQUIRED', 'Assign this resource to at least one student.');
  if (studentIds.length > 500) throw new AuthError(400, 'TOO_MANY_ASSIGNMENTS', 'No more than 500 students can be assigned at once.');
  return {
    course: normalizeCourse(input.course),
    type,
    title: cleanText(input.title, 'title', { required: true, min: 3, max: 120 }),
    description: cleanText(input.description, 'description', { max: 500 }),
    studentIds: studentIds.map((id) => objectId(id, 'INVALID_STUDENT_ID', 'One of the selected students is invalid.')),
  };
}

export function decodeResourceFile(input = {}) {
  const filename = safeFilename(input.fileName);
  const mimeType = String(input.mimeType || '').toLowerCase();
  if (!allowedMimeTypes.has(mimeType)) throw new AuthError(400, 'UNSUPPORTED_FILE_TYPE', 'Upload a PDF, image, text, Word, or PowerPoint file.');
  const encoded = String(input.dataBase64 || '');
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new AuthError(400, 'INVALID_FILE', 'Choose a valid file to upload.');
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length) throw new AuthError(400, 'EMPTY_FILE', 'The uploaded file is empty.');
  if (buffer.length > maxFileBytes) throw new AuthError(413, 'FILE_TOO_LARGE', 'Files must be 3 MB or smaller.');
  if (mimeType === 'application/pdf') {
    if (!filename.toLowerCase().endsWith('.pdf')) throw new AuthError(400, 'INVALID_PDF', 'PDF files must use the .pdf extension.');
    if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new AuthError(400, 'INVALID_PDF', 'The selected file is not a valid PDF document.');
    }
  }
  return { filename, mimeType, buffer };
}

async function databaseResources() {
  const db = await getTestingDatabase();
  if (!resourceIndexPromise) {
    resourceIndexPromise = Promise.all([
      db.collection('resources').createIndex({ ownerId: 1, course: 1, createdAt: -1 }),
      db.collection('resources').createIndex({ ownerId: 1, studentIds: 1, createdAt: -1 }),
      db.collection('students').createIndex({ resourceAccessTokenHash: 1 }, { sparse: true }),
    ]).catch((error) => {
      resourceIndexPromise = null;
      throw error;
    });
  }
  await resourceIndexPromise;
  return { db, resources: db.collection('resources'), students: db.collection('students'), files: new GridFSBucket(db, { bucketName: 'resource_files' }) };
}

async function staffContext(request) {
  const user = await sessionUser(request);
  if (!user) throw new AuthError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to manage notes and tests.');
  if (!['administrator', 'teacher'].includes(user.role)) throw new AuthError(403, 'STAFF_ACCESS_REQUIRED', 'Only institute staff can manage resources.');
  return { user, ownerId: objectId(user.id, 'INVALID_ACCOUNT_ID', 'The account identifier is invalid.') };
}

function publicResource(resource, studentMap = new Map()) {
  return {
    id: String(resource._id),
    course: resource.course,
    type: resource.type,
    title: resource.title,
    description: resource.description || '',
    fileName: resource.fileName,
    mimeType: resource.mimeType,
    size: resource.size,
    studentIds: resource.studentIds.map(String),
    students: resource.studentIds.map((id) => studentMap.get(String(id))).filter(Boolean),
    createdByName: resource.createdByName,
    createdAt: resource.createdAt?.toISOString?.() || null,
  };
}

async function assignedStudents(students, ownerId, course, studentIds) {
  const rows = await students.find({ _id: { $in: studentIds }, ownerId, course }).project({ name: 1, batch: 1 }).toArray();
  if (rows.length !== studentIds.length) throw new AuthError(400, 'INVALID_ASSIGNMENT', 'Every selected student must belong to this institute and course.');
  return rows;
}

export async function listResources(request, query = {}) {
  const { ownerId } = await staffContext(request);
  const course = normalizeCourse(query.course);
  const { resources, students } = await databaseResources();
  const rows = await resources.find({ ownerId, course }).sort({ createdAt: -1 }).limit(300).toArray();
  const ids = [...new Map(rows.flatMap((row) => row.studentIds).map((id) => [String(id), id])).values()];
  const studentRows = ids.length ? await students.find({ _id: { $in: ids }, ownerId }).project({ name: 1, batch: 1 }).toArray() : [];
  const studentMap = new Map(studentRows.map((student) => [String(student._id), { id: String(student._id), name: student.name, batch: student.batch }]));
  return rows.map((resource) => publicResource(resource, studentMap));
}

export async function createResource(request, input) {
  const { user, ownerId } = await staffContext(request);
  const values = normalizeResourceInput(input);
  const file = decodeResourceFile(input.file || {});
  const { resources, students, files } = await databaseResources();
  const assigned = await assignedStudents(students, ownerId, values.course, values.studentIds);
  const now = new Date();
  const upload = files.openUploadStream(file.filename, { metadata: { ownerId, course: values.course, mimeType: file.mimeType } });
  await new Promise((resolve, reject) => {
    upload.on('finish', resolve);
    upload.on('error', reject);
    upload.end(file.buffer);
  });
  const document = {
    ...values,
    ownerId,
    fileId: upload.id,
    fileName: file.filename,
    mimeType: file.mimeType,
    size: file.buffer.length,
    createdById: ownerId,
    createdByName: user.name,
    createdAt: now,
    updatedAt: now,
  };
  try {
    const result = await resources.insertOne(document);
    const studentMap = new Map(assigned.map((student) => [String(student._id), { id: String(student._id), name: student.name, batch: student.batch }]));
    return publicResource({ ...document, _id: result.insertedId }, studentMap);
  } catch (error) {
    await files.delete(upload.id).catch(() => {});
    throw error;
  }
}

export async function updateResource(request, id, input) {
  const { ownerId } = await staffContext(request);
  const values = normalizeResourceInput(input);
  const { resources, students } = await databaseResources();
  const assigned = await assignedStudents(students, ownerId, values.course, values.studentIds);
  const resource = await resources.findOneAndUpdate(
    { _id: objectId(id, 'INVALID_RESOURCE_ID', 'The resource identifier is invalid.'), ownerId },
    { $set: { ...values, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!resource) throw new AuthError(404, 'RESOURCE_NOT_FOUND', 'The resource was not found.');
  const studentMap = new Map(assigned.map((student) => [String(student._id), { id: String(student._id), name: student.name, batch: student.batch }]));
  return publicResource(resource, studentMap);
}

export async function deleteResource(request, id) {
  const { ownerId } = await staffContext(request);
  const { resources, files } = await databaseResources();
  const resource = await resources.findOneAndDelete({ _id: objectId(id, 'INVALID_RESOURCE_ID', 'The resource identifier is invalid.'), ownerId });
  if (!resource) throw new AuthError(404, 'RESOURCE_NOT_FOUND', 'The resource was not found.');
  await files.delete(resource.fileId).catch((error) => {
    if (error?.code !== 'ENOENT') console.error('Resource file cleanup failed:', error);
  });
}

export async function staffResourceFile(request, id) {
  const { ownerId } = await staffContext(request);
  const { resources, files } = await databaseResources();
  const resource = await resources.findOne({ _id: objectId(id, 'INVALID_RESOURCE_ID', 'The resource identifier is invalid.'), ownerId });
  if (!resource) throw new AuthError(404, 'RESOURCE_NOT_FOUND', 'The resource was not found.');
  return { resource, stream: files.openDownloadStream(resource.fileId) };
}

export async function createStudentResourceAccess(request, studentId) {
  const { ownerId } = await staffContext(request);
  const { students } = await databaseResources();
  const token = randomBytes(32).toString('base64url');
  const result = await students.findOneAndUpdate(
    { _id: objectId(studentId, 'INVALID_STUDENT_ID', 'The student identifier is invalid.'), ownerId },
    { $set: { resourceAccessTokenHash: tokenHash(token), resourceAccessUpdatedAt: new Date() } },
    { returnDocument: 'after', projection: { name: 1 } },
  );
  if (!result) throw new AuthError(404, 'STUDENT_NOT_FOUND', 'The student was not found.');
  return { studentId: String(result._id), studentName: result.name, token };
}

async function studentAccess(studentId, token) {
  const { resources, students, files } = await databaseResources();
  const student = await students.findOne({
    _id: objectId(studentId, 'INVALID_STUDENT_ID', 'The student access link is invalid.'),
    resourceAccessTokenHash: tokenHash(token),
  });
  if (!student) throw new AuthError(403, 'INVALID_STUDENT_ACCESS', 'This student access link is invalid or has been replaced.');
  return { student, resources, files };
}

export async function listStudentResources(studentId, token) {
  const { student, resources } = await studentAccess(studentId, token);
  const rows = await resources.find({ ownerId: student.ownerId, course: student.course, studentIds: student._id }).sort({ createdAt: -1 }).limit(300).toArray();
  return {
    student: { id: String(student._id), name: student.name, course: student.course, batch: student.batch },
    resources: rows.map((resource) => publicResource(resource)),
  };
}

export async function studentResourceFile(studentId, token, resourceId) {
  const { student, resources, files } = await studentAccess(studentId, token);
  const resource = await resources.findOne({
    _id: objectId(resourceId, 'INVALID_RESOURCE_ID', 'The resource identifier is invalid.'),
    ownerId: student.ownerId,
    course: student.course,
    studentIds: student._id,
  });
  if (!resource) throw new AuthError(404, 'RESOURCE_NOT_FOUND', 'This resource is not assigned to the student.');
  return { resource, stream: files.openDownloadStream(resource.fileId) };
}

export const resourceLimits = { maxFileBytes, allowedMimeTypes: [...allowedMimeTypes] };
