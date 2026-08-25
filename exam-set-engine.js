export const EXAM_SET_CODES = Object.freeze(["A", "B", "C", "D"]);

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle(items, seedText) {
  const shuffled = [...items];
  const random = seededRandom(hashSeed(seedText));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function questionKey(question, index = 0) {
  return question.questionId || `${question.subject || "subject"}-${question.questionNumber || index + 1}`;
}

function groupPassageQuestions(questions) {
  const units = [];
  const passageUnits = new Map();

  questions.forEach((question, index) => {
    if (!question.passageId) {
      units.push({ key: `question:${questionKey(question, index)}`, questions: [question] });
      return;
    }

    let unit = passageUnits.get(question.passageId);
    if (!unit) {
      unit = { key: `passage:${question.passageId}`, questions: [] };
      passageUnits.set(question.passageId, unit);
      units.push(unit);
    }
    unit.questions.push(question);
  });

  return units.map((unit) => ({
    ...unit,
    questions: [...unit.questions].sort(
      (left, right) => Number(left.questionNumber || 0) - Number(right.questionNumber || 0),
    ),
  }));
}

function shuffleQuestionOptions(question, setCode, testId) {
  const sourceOptions = Array.isArray(question.options) ? question.options : [];
  const sourceAnswer = question.correctOption || question.answer || "";
  const shuffled = deterministicShuffle(
    sourceOptions.map((option, index) => ({
      ...option,
      sourceOptionId: option.sourceOptionId || option.id || String.fromCharCode(65 + index),
    })),
    `${testId}:${setCode}:${questionKey(question)}:options`,
  );
  const options = shuffled.map((option, index) => ({
    ...option,
    id: String.fromCharCode(65 + index),
  }));
  const answer = options.find((option) => option.sourceOptionId === sourceAnswer)?.id || sourceAnswer;

  return {
    ...question,
    options,
    correctOption: answer,
    answer,
  };
}

export function createExamSet(test, requestedSetCode, blueprint = []) {
  const setCode = String(requestedSetCode || "A").toUpperCase();
  if (!EXAM_SET_CODES.includes(setCode)) {
    throw new Error(`Unsupported exam set ${requestedSetCode}. Choose A, B, C, or D.`);
  }

  const sourceQuestions = Array.isArray(test?.questions) ? test.questions : [];
  const orderedSubjects = [
    ...blueprint.map((section) => section.subject),
    ...sourceQuestions.map((question) => question.subject),
  ].filter((subject, index, subjects) => subject && subjects.indexOf(subject) === index);

  const orderedQuestions = orderedSubjects.flatMap((subject) => {
    const subjectQuestions = sourceQuestions.filter((question) => question.subject === subject);
    const units = groupPassageQuestions(subjectQuestions);
    return deterministicShuffle(units, `${test.id}:${setCode}:${subject}:questions`).flatMap(
      (unit) => unit.questions,
    );
  });

  const questions = orderedQuestions.map((question, index) => ({
    ...shuffleQuestionOptions(question, setCode, test.id),
    sourceQuestionNumber: question.sourceQuestionNumber || question.questionNumber,
    questionNumber: index + 1,
  }));

  return {
    ...test,
    examSet: setCode,
    questions,
    questionCount: questions.length,
  };
}

export function examSetSignature(test) {
  return test.questions
    .map((question) =>
      `${question.questionId}:${question.options.map((option) => option.sourceOptionId || option.id).join("")}`,
    )
    .join("|");
}
