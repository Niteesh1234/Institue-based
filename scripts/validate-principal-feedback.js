import { readFile } from 'node:fs/promises';
import { DEFAULT_INSTITUTE_CONTROL_DOCUMENT } from '../institute-control-service.js';
import { BATCH_EXAM_LEVELS, composeBatchExam } from '../batch-exam-engine.js';
import { generateTestingBank } from '../question-engine.js';

const [studentService, resourceService, batchService, studentApi, studentPortal] = await Promise.all([
  readFile(new URL('../student-service.js', import.meta.url), 'utf8'),
  readFile(new URL('../resource-service.js', import.meta.url), 'utf8'),
  readFile(new URL('../batch-exam-service.js', import.meta.url), 'utf8'),
  readFile(new URL('../api/students.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/resources.jsx', import.meta.url), 'utf8'),
]);

const checks = {
  twelveBatchLimit: DEFAULT_INSTITUTE_CONTROL_DOCUMENT.policies.maxBatches === 12,
  teacherPrintDisabled: DEFAULT_INSTITUTE_CONTROL_DOCUMENT.policies.teacherCanPrint === false,
  studentPrintDisabled: DEFAULT_INSTITUTE_CONTROL_DOCUMENT.policies.studentCanPrint === false,
  feedbackAfterSubmit: DEFAULT_INSTITUTE_CONTROL_DOCUMENT.policies.feedbackMode === 'after-submit',
  principalStudentMutation: studentService.includes("mutate && !['administrator', 'principal'].includes(user.role)"),
  bulkStudentImport: studentApi.includes("action === 'import'") && studentService.includes('insertMany'),
  principalFileDownload: resourceService.includes("requirePrincipal(user, 'Only the principal can download institute files.'"),
  studentDownloadBlocked: resourceService.includes('STUDENT_DOWNLOAD_DISABLED'),
  immutableSubmission: batchService.includes("createIndex({ examId: 1, studentId: 1 }, { unique: true })") && batchService.includes('EXAM_ALREADY_SUBMITTED'),
  noStudentCheckAnswer: !studentPortal.includes('Check answer') && studentPortal.includes('Final submit'),
};

const bank = generateTestingBank();
const composed = composeBatchExam({ courseKey: 'jnvst', questions: bank.questions, seed: 'principal-feedback-validation' });
checks.exactDifficultyMix = BATCH_EXAM_LEVELS.every((level) => composed.levelCounts[level] === 20) && composed.questionCount === 60;
checks.noDuplicateQuestions = new Set(composed.questions.map((question) => question.promptFingerprint)).size === 60;

const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
console.log(JSON.stringify({ status: failed.length ? 'failed' : 'passed', checks, failed }, null, 2));
if (failed.length) process.exitCode = 1;
