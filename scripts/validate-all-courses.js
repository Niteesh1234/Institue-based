import { generateTestingBank, validateTestingBank } from '../question-engine.js';
import { generateEntranceBank, validateEntranceBank } from '../entrance-question-engine.js';

const banks = [
  { course: 'jnvst', bank: generateTestingBank() },
  ...['sainik', 'rms'].map((course) => ({ course, bank: generateEntranceBank(course) }))
];
const reports = banks.map(({ course, bank }) => course === 'jnvst' ? validateTestingBank(bank) : validateEntranceBank(course, bank));
const allQuestions = banks.flatMap(({ course, bank }) => bank.questions.map((question) => ({ ...question, auditCourse: course })));

const normalize = (value) => String(value ?? '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/\s+/g, ' ')
  .trim();
const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${normalize(key)}:${stable(value[key])}`).join(',')}}`;
  return normalize(value);
};
const optionText = (option) => normalize(option?.text ?? option?.label ?? stable(option?.figure) ?? option);
const canonicalPrompt = (question) => [normalize(question.passage), normalize(question.stem || question.text), stable(question.stimulus)].join('|');
const canonicalQuestion = (question) => [canonicalPrompt(question), question.options.map(optionText).sort().join('|')].join('|');
const canonicalAnswer = (question) => {
  const correctId = question.correctOption || question.answer;
  const correct = question.options.find((option) => option.id === correctId);
  return [canonicalQuestion(question), optionText(correct)].join('|');
};
const duplicateGroupCount = (keyFor) => {
  const groups = new Map();
  for (const question of allQuestions) {
    const key = keyFor(question);
    groups.set(key, [...(groups.get(key) || []), question]);
  }
  return [...groups.values()].filter((group) => new Set(group.map((question) => question.testId)).size > 1).length;
};

const totals = reports.reduce((summary, report) => ({
  tests: summary.tests + report.testCount,
  questions: summary.questions + report.questionCount,
  uniquePrompts: 0,
  uniqueRenders: 0,
  optionOrderChecks: summary.optionOrderChecks + report.optionOrderInvariantChecks
}), { tests: 0, questions: 0, uniquePrompts: 0, uniqueRenders: 0, optionOrderChecks: 0 });
totals.uniqueQuestionIds = new Set(allQuestions.map((question) => question.questionId)).size;
totals.uniquePrompts = new Set(allQuestions.map((question) => question.promptFingerprint)).size;
totals.uniqueRenders = new Set(allQuestions.map((question) => question.renderFingerprint)).size;
totals.canonicalPromptDuplicateGroups = duplicateGroupCount(canonicalPrompt);
totals.optionOrderIndependentDuplicateGroups = duplicateGroupCount(canonicalQuestion);
totals.answerAwareDuplicateGroups = duplicateGroupCount(canonicalAnswer);

const simpleInterestRows = allQuestions.filter((question) => question.auditCourse === 'sainik' && question.topic === 'Simple Interest');
const arrangingFractionRows = allQuestions.filter((question) => question.auditCourse === 'sainik' && question.topic === 'Arranging of Fractions');
const complementaryRows = allQuestions.filter((question) => question.auditCourse === 'sainik' && question.topic === 'Complementary and Supplementary Angles');
const semanticAudit = {
  simpleInterestQuestions: simpleInterestRows.length,
  invalidSimpleInterestQuestions: simpleInterestRows.filter((question) => !/simple interest.+%|%.+simple interest/i.test(`${question.stem} ${question.explanation}`)).length,
  arrangingFractionQuestions: arrangingFractionRows.length,
  invalidArrangingFractionQuestions: arrangingFractionRows.filter((question) => !/arrange.+ascending|ascending order/i.test(`${question.stem} ${question.explanation}`)).length,
  complementaryAndSupplementaryQuestions: complementaryRows.length,
  complementaryQuestions: complementaryRows.filter((question) => /complement of/i.test(question.stem)).length,
  supplementaryQuestions: complementaryRows.filter((question) => /supplement of/i.test(question.stem)).length,
};

if (totals.tests !== 90 || totals.questions !== 12150 || totals.uniqueQuestionIds !== 12150 || totals.uniquePrompts !== 12150 || totals.uniqueRenders !== 12150 || totals.optionOrderChecks !== 12150 || totals.canonicalPromptDuplicateGroups !== 0 || totals.optionOrderIndependentDuplicateGroups !== 0 || totals.answerAwareDuplicateGroups !== 0 || semanticAudit.simpleInterestQuestions !== 60 || semanticAudit.invalidSimpleInterestQuestions !== 0 || semanticAudit.arrangingFractionQuestions !== 60 || semanticAudit.invalidArrangingFractionQuestions !== 0 || semanticAudit.complementaryQuestions < 20 || semanticAudit.supplementaryQuestions < 20) {
  throw new Error(`Multi-course validation totals are invalid: ${JSON.stringify(totals)}`);
}

console.log(JSON.stringify({ status: 'passed', totals, semanticAudit, courses: reports }, null, 2));
