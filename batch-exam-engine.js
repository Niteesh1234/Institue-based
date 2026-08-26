import { getExamCourse } from './exam-courses.js';

export const BATCH_EXAM_LEVELS = ['easy', 'medium', 'challenging'];
export const QUESTIONS_PER_LEVEL = 20;
export const BATCH_EXAM_QUESTION_COUNT = BATCH_EXAM_LEVELS.length * QUESTIONS_PER_LEVEL;

function hashNumber(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicShuffle(items, seed) {
  return [...items]
    .map((item, index) => ({ item, rank: hashNumber(`${seed}:${questionKey(item, index)}`) }))
    .sort((first, second) => first.rank - second.rank)
    .map(({ item }) => item);
}

export function questionKey(question, fallback = '') {
  return String(
    question?.questionId ||
    question?.promptFingerprint ||
    question?.renderFingerprint ||
    question?.fingerprint ||
    fallback,
  );
}

export function batchSubjectTargets(courseKey, count = QUESTIONS_PER_LEVEL) {
  const course = getExamCourse(courseKey);
  const blueprintTotal = course.blueprint.reduce((sum, section) => sum + section.questionCount, 0);
  const rows = course.blueprint.map((section, index) => {
    const exact = (section.questionCount / blueprintTotal) * count;
    return { subject: section.subject, count: Math.floor(exact), remainder: exact % 1, index };
  });
  let remaining = count - rows.reduce((sum, row) => sum + row.count, 0);
  [...rows]
    .sort((first, second) => second.remainder - first.remainder || first.index - second.index)
    .slice(0, remaining)
    .forEach((row) => { row.count += 1; });
  return Object.fromEntries(rows.map(({ subject, count: target }) => [subject, target]));
}

export function validateBatchExam(exam) {
  const course = getExamCourse(exam.course);
  const questions = Array.isArray(exam.questions) ? exam.questions : [];
  if (questions.length !== BATCH_EXAM_QUESTION_COUNT) throw new Error(`Batch exam contains ${questions.length}/${BATCH_EXAM_QUESTION_COUNT} questions.`);
  const ids = questions.map((question, index) => questionKey(question, index));
  if (new Set(ids).size !== questions.length) throw new Error('Batch exam contains repeated question records.');
  const prompts = questions.map((question) => question.promptFingerprint).filter(Boolean);
  if (new Set(prompts).size !== prompts.length) throw new Error('Batch exam contains duplicate question prompts.');
  for (const level of BATCH_EXAM_LEVELS) {
    const rows = questions.filter((question) => String(question.difficulty).toLowerCase() === level);
    if (rows.length !== QUESTIONS_PER_LEVEL) throw new Error(`${level} count is ${rows.length}/${QUESTIONS_PER_LEVEL}.`);
    const targets = batchSubjectTargets(course.key);
    for (const [subject, target] of Object.entries(targets)) {
      const actual = rows.filter((question) => question.subject === subject).length;
      if (actual !== target) throw new Error(`${level} ${subject} count is ${actual}/${target}.`);
    }
  }
  return true;
}

export function composeBatchExam({ courseKey, questions, seed, excludedQuestionIds = [] }) {
  const course = getExamCourse(courseKey);
  const excluded = new Set([...excludedQuestionIds].map(String));
  const selected = [];
  const selectedKeys = new Set();
  const levelCounts = {};
  const subjectCounts = {};
  const targets = batchSubjectTargets(course.key);

  for (const level of BATCH_EXAM_LEVELS) {
    levelCounts[level] = 0;
    for (const [subject, target] of Object.entries(targets)) {
      const candidates = deterministicShuffle(
        questions.filter((question, index) => {
          const key = questionKey(question, index);
          return String(question.difficulty).toLowerCase() === level &&
            question.subject === subject &&
            !excluded.has(key) &&
            !selectedKeys.has(key);
        }),
        `${seed}:${level}:${subject}`,
      );
      if (candidates.length < target) {
        throw new Error(`Not enough unused ${level} ${subject} questions (${candidates.length}/${target}).`);
      }
      for (const question of candidates.slice(0, target)) {
        const key = questionKey(question);
        selectedKeys.add(key);
        selected.push({ ...question, questionId: key, difficulty: level });
        levelCounts[level] += 1;
        subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
      }
    }
  }

  const delivered = deterministicShuffle(selected, `${seed}:delivery`).map((question, index) => ({
    ...question,
    questionNumber: index + 1,
  }));
  const exam = {
    course: course.key,
    questionCount: delivered.length,
    levelCounts,
    subjectCounts,
    subjectTargetsPerLevel: targets,
    questions: delivered,
  };
  validateBatchExam(exam);
  return exam;
}
