import { generateTestingBank, validateTestingBank } from '../question-engine.js';

const bank = generateTestingBank();
const source = bank.questions.find((question) => question.questionId === 'TST-EAS-01-Q001');
const targetIndex = bank.questions.findIndex((question) => question.questionId === 'TST-EAS-02-Q001');
const target = bank.questions[targetIndex];

bank.questions[targetIndex] = {
  ...source,
  questionId: target.questionId,
  testId: target.testId,
  questionNumber: target.questionNumber,
  options: [...source.options].reverse()
};

let rejected = false;
let reason = '';
try {
  validateTestingBank(bank);
} catch (error) {
  reason = error.message;
  rejected = /duplicate/i.test(reason);
}

if (!rejected) throw new Error('The validator accepted a duplicate question whose options were reordered.');

console.log(JSON.stringify({
  status: 'passed',
  scenario: 'Same question copied into another test with A/B/C/D order reversed',
  result: 'duplicate rejected',
  detectedBy: ['promptFingerprint', 'renderFingerprint', 'fingerprint']
}, null, 2));
