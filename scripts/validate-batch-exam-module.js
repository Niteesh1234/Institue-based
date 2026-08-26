import assert from 'node:assert/strict';
import { BATCH_EXAM_LEVELS, composeBatchExam, validateBatchExam } from '../batch-exam-engine.js';
import { buildValidatedPreviewCatalog } from '../vercel-catalog.js';
import batchExamsHandler from '../api/batch-exams.js';

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

const report = {};
for (const course of ['jnvst', 'sainik', 'rms']) {
  const bank = buildValidatedPreviewCatalog(course);
  const questions = bank.tests.flatMap((test) => test.questions);
  const used = new Set();
  report[course] = { exams: 0, questions: 0 };
  for (let index = 0; index < 12; index += 1) {
    const exam = composeBatchExam({ courseKey: course, questions, seed: `${course}-batch-${index + 1}`, excludedQuestionIds: used });
    assert.equal(validateBatchExam(exam), true);
    assert.equal(exam.questions.length, 60);
    for (const level of BATCH_EXAM_LEVELS) assert.equal(exam.levelCounts[level], 20);
    for (const question of exam.questions) {
      assert.equal(used.has(question.questionId), false, `${course} repeated ${question.questionId} across batch exams.`);
      used.add(question.questionId);
    }
    report[course].exams += 1;
    report[course].questions += exam.questions.length;
  }
  assert.equal(used.size, 720);
}

delete process.env.MONGODB_URI;
delete process.env.AUTH_SECRET;
const unauthenticated = responseRecorder();
await batchExamsHandler({ method: 'GET', query: { course: 'jnvst' }, headers: {} }, unauthenticated);
assert.equal(unauthenticated.statusCode, 401);
assert.equal(unauthenticated.body.code, 'AUTHENTICATION_REQUIRED');

const crossOrigin = responseRecorder();
await batchExamsHandler({
  method: 'POST',
  query: {},
  headers: { origin: 'https://attacker.example', host: 'vijetha.example' },
  body: { course: 'jnvst', title: 'Unsafe request', batch: 'Batch A' },
}, crossOrigin);
assert.equal(crossOrigin.statusCode, 403);
assert.equal(crossOrigin.body.code, 'INVALID_ORIGIN');

console.log(JSON.stringify({ status: 'passed', ...report }, null, 2));
