import assert from 'node:assert/strict';
import resourcesHandler from '../api/resources.js';
import { normalizeResourceInput, resourceLimits } from '../resource-service.js';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end(body) { this.body = body; return this; },
  };
}

const firstStudent = '64b7f4bcf86cd79943901111';
const secondStudent = '64b7f4bcf86cd79943902222';
const normalized = normalizeResourceInput({
  course: 'SAINIK',
  type: 'note',
  title: '  Fractions   revision notes  ',
  description: '  Worked examples for Class VI. ',
  studentIds: [firstStudent, firstStudent, secondStudent],
  ignoredOwnerId: '64b7f4bcf86cd79943909999',
});

assert.equal(normalized.course, 'sainik');
assert.equal(normalized.type, 'note');
assert.equal(normalized.title, 'Fractions revision notes');
assert.equal(normalized.studentIds.length, 2, 'Repeated student assignments must collapse to one assignment.');
assert.equal(Object.hasOwn(normalized, 'ownerId'), false, 'The client must not control institute ownership.');
assert.throws(() => normalizeResourceInput({ course: 'jnvst', type: 'video', title: 'Invalid type', studentIds: [firstStudent] }), /Notes or Test paper/);
assert.throws(() => normalizeResourceInput({ course: 'rms', type: 'test', title: 'Valid title', studentIds: [] }), /at least one student/);
assert.throws(() => normalizeResourceInput({ course: 'other', type: 'test', title: 'Valid title', studentIds: [firstStudent] }), /JNVST, AISSEE, or RMS CET/);
assert.equal(resourceLimits.maxFileBytes, 3 * 1024 * 1024);
assert.equal(resourceLimits.allowedMimeTypes.includes('application/pdf'), true);
assert.equal(resourceLimits.allowedMimeTypes.includes('text/html'), false, 'Executable HTML uploads must not be allowed.');

delete process.env.MONGODB_URI;
delete process.env.AUTH_SECRET;
const unauthenticated = responseRecorder();
await resourcesHandler({ method: 'GET', query: { course: 'jnvst' }, headers: {} }, unauthenticated);
assert.equal(unauthenticated.statusCode, 401);
assert.equal(unauthenticated.body.code, 'AUTHENTICATION_REQUIRED');

const crossOrigin = responseRecorder();
await resourcesHandler({
  method: 'POST',
  query: {},
  headers: { origin: 'https://attacker.example', host: 'vijetha.example' },
  body: {},
}, crossOrigin);
assert.equal(crossOrigin.statusCode, 403);
assert.equal(crossOrigin.body.code, 'INVALID_ORIGIN');

const publicMutation = responseRecorder();
await resourcesHandler({ method: 'POST', query: { student: firstStudent, token: 'invalid' }, headers: {}, body: {} }, publicMutation);
assert.equal(publicMutation.statusCode, 401, 'Student link credentials must never authorize a write operation.');

console.log('Resource module validation passed: ownership, course scope, assignment deduplication, upload limits, MIME allowlist, authentication, origin protection, and read-only student access.');
