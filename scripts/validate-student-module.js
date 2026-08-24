import assert from 'node:assert/strict';
import studentsHandler from '../api/students.js';
import { normalizeStudentInput, studentStatus } from '../student-service.js';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

const valid = normalizeStudentInput({
  course: 'jnvst',
  name: '  Aarav   Nair ',
  batch: 'JNVST Morning A',
  guardian: 'Meera Nair',
  email: 'AARAV@example.com',
  phone: '+91 98765 43210',
  guardianEmail: 'meera@example.com',
  guardianPhone: '9876543210',
  progress: 72.4,
  ignoredAdministrativeField: true
});

assert.deepEqual(valid, {
  course: 'jnvst',
  name: 'Aarav Nair',
  batch: 'JNVST Morning A',
  guardian: 'Meera Nair',
  email: 'aarav@example.com',
  phone: '+91 98765 43210',
  guardianEmail: 'meera@example.com',
  guardianPhone: '9876543210',
  progress: 72
});
assert.deepEqual(studentStatus(70), { state: 'On track', tone: 'green' });
assert.deepEqual(studentStatus(50), { state: 'Needs review', tone: 'amber' });
assert.deepEqual(studentStatus(49), { state: 'At risk', tone: 'red' });
assert.throws(() => normalizeStudentInput({ ...valid, progress: 101 }), /between 0 and 100/);
assert.throws(() => normalizeStudentInput({ ...valid, email: 'not-an-email' }), /valid student email/);
assert.throws(() => normalizeStudentInput({ ...valid, course: 'unknown' }), /JNVST, AISSEE, or RMS CET/);
assert.deepEqual(normalizeStudentInput({}, { partial: true }), {});

delete process.env.MONGODB_URI;
delete process.env.AUTH_SECRET;
const unauthenticatedResponse = responseRecorder();
await studentsHandler({ method: 'GET', query: { course: 'jnvst' }, headers: {} }, unauthenticatedResponse);
assert.equal(unauthenticatedResponse.statusCode, 401);
assert.equal(unauthenticatedResponse.body.code, 'AUTHENTICATION_REQUIRED');
assert.equal(unauthenticatedResponse.headers['cache-control'], 'no-store');

const crossOriginResponse = responseRecorder();
await studentsHandler({
  method: 'POST',
  query: {},
  headers: { origin: 'https://attacker.example', host: 'vijetha.example' },
  body: valid
}, crossOriginResponse);
assert.equal(crossOriginResponse.statusCode, 403);
assert.equal(crossOriginResponse.body.code, 'INVALID_ORIGIN');

console.log('Student module validation passed: fields, status derivation, input boundaries, authentication, and origin protection.');
