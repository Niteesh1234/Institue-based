import fs from 'node:fs';
import path from 'node:path';
import { COURSE_KEYS, EXAM_COURSES } from '../exam-courses.js';
import { createExamSet, examSetSignature, EXAM_SET_CODES } from '../exam-set-engine.js';

const errors = [];
const report = {
  status: 'passed',
  courses: 0,
  sourcePapers: 0,
  generatedSets: 0,
  setQuestions: 0,
  setOptions: 0,
  answerRemapsChecked: 0,
  passageBlocksChecked: 0,
};

function fail(message) {
  errors.push(message);
}

function optionContent(option) {
  const { id: _id, sourceOptionId: _sourceOptionId, ...content } = option || {};
  return JSON.stringify(content);
}

for (const courseKey of COURSE_KEYS) {
  const course = EXAM_COURSES[courseKey];
  const generatedRoot = path.join(process.cwd(), 'public', 'generated', courseKey);
  const catalog = JSON.parse(fs.readFileSync(path.join(generatedRoot, 'catalog.json'), 'utf8'));
  report.courses += 1;

  for (const metadata of catalog.tests) {
    const payload = JSON.parse(
      fs.readFileSync(path.join(generatedRoot, 'tests', `${metadata.id}.json`), 'utf8'),
    );
    const sourceTest = payload.test;
    const sourceIds = sourceTest.questions.map((question) => question.questionId).sort();
    const sourceOrder = sourceTest.questions.map((question) => question.questionId).join('|');
    const signatures = new Set();
    report.sourcePapers += 1;

    for (const setCode of EXAM_SET_CODES) {
      const generated = createExamSet(sourceTest, setCode, course.blueprint);
      const repeated = createExamSet(sourceTest, setCode, course.blueprint);
      const label = `${metadata.id} Set ${setCode}`;
      report.generatedSets += 1;
      report.setQuestions += generated.questions.length;
      report.setOptions += generated.questions.reduce(
        (total, question) => total + question.options.length,
        0,
      );

      if (examSetSignature(generated) !== examSetSignature(repeated)) {
        fail(`${label}: generation is not deterministic.`);
      }
      signatures.add(examSetSignature(generated));

      if (generated.examSet !== setCode) fail(`${label}: booklet code is missing.`);
      if (generated.questions.length !== sourceTest.questions.length) {
        fail(`${label}: question count changed.`);
      }
      const generatedIds = generated.questions.map((question) => question.questionId).sort();
      if (JSON.stringify(generatedIds) !== JSON.stringify(sourceIds)) {
        fail(`${label}: questions were added, removed, or duplicated.`);
      }
      if (generated.questions.map((question) => question.questionId).join('|') === sourceOrder) {
        fail(`${label}: question order was not shuffled.`);
      }

      let expectedNumber = 1;
      for (const section of course.blueprint) {
        const questions = generated.questions.filter(
          (question) => question.subject === section.subject,
        );
        if (questions.length !== section.questionCount) {
          fail(`${label}: ${section.subject} count is ${questions.length}/${section.questionCount}.`);
        }
        for (const question of questions) {
          if (question.questionNumber !== expectedNumber) {
            fail(`${label}: numbering or official section order failed at ${question.questionId}.`);
          }
          expectedNumber += 1;
        }
      }

      const sourceById = new Map(
        sourceTest.questions.map((question) => [question.questionId, question]),
      );
      for (const question of generated.questions) {
        const source = sourceById.get(question.questionId);
        if ((question.stem || question.text) !== (source.stem || source.text)) {
          fail(`${label}: wording changed for ${question.questionId}.`);
        }
        if (question.options.length !== 4) {
          fail(`${label}: ${question.questionId} no longer has four options.`);
          continue;
        }
        const optionIds = question.options.map((option) => option.id).join('');
        if (optionIds !== 'ABCD') fail(`${label}: ${question.questionId} option labels are invalid.`);
        const sourceContent = source.options.map(optionContent).sort();
        const setContent = question.options.map(optionContent).sort();
        if (JSON.stringify(sourceContent) !== JSON.stringify(setContent)) {
          fail(`${label}: option content changed for ${question.questionId}.`);
        }
        const sourceAnswer = source.options.find(
          (option) => option.id === (source.correctOption || source.answer),
        );
        const generatedAnswer = question.options.find(
          (option) => option.id === (question.correctOption || question.answer),
        );
        if (!sourceAnswer || !generatedAnswer || optionContent(sourceAnswer) !== optionContent(generatedAnswer)) {
          fail(`${label}: correct answer was not safely remapped for ${question.questionId}.`);
        }
        report.answerRemapsChecked += 1;
      }

      const passageIds = [...new Set(generated.questions.map((question) => question.passageId).filter(Boolean))];
      for (const passageId of passageIds) {
        const passageQuestions = generated.questions.filter((question) => question.passageId === passageId);
        const positions = passageQuestions.map((question) => generated.questions.indexOf(question));
        const contiguous = positions.every((position, index) => index === 0 || position === positions[index - 1] + 1);
        const ordered = passageQuestions.every(
          (question, index) => index === 0 || question.sourceQuestionNumber > passageQuestions[index - 1].sourceQuestionNumber,
        );
        if (!contiguous || !ordered) fail(`${label}: passage ${passageId} was split or reordered.`);
        report.passageBlocksChecked += 1;
      }
    }

    if (signatures.size !== EXAM_SET_CODES.length) {
      fail(`${metadata.id}: Sets A–D are not four unique permutations.`);
    }
  }
}

if (errors.length) {
  report.status = 'failed';
  report.errors = errors.slice(0, 50);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
