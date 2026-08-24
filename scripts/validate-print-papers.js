import fs from 'node:fs';
import path from 'node:path';
import { COURSE_KEYS, EXAM_COURSES } from '../exam-courses.js';

const root = process.cwd();
const supportedStimuli = new Set([
  'sequence',
  'figure-sequence',
  'outline',
  'mirror',
  'water',
  'embedded',
  'bar',
  'pictograph'
  ,'table'
]);
const supportedShapes = new Set([
  'circle',
  'triangle',
  'square',
  'pentagon',
  'hexagon',
  'arrow'
]);
const errors = [];
const report = {
  status: 'passed',
  totals: { courses: 0, papers: 0, questions: 0, options: 0, passages: 0, visualQuestions: 0, visualFigureChecks: 0 },
  courses: []
};

function fail(message) {
  errors.push(message);
}

function printableOption(option) {
  return Boolean(
    String(option?.text ?? option?.label ?? '').trim() ||
    (option?.figure && supportedShapes.has(option.figure.shape))
  );
}

for (const courseKey of COURSE_KEYS) {
  const course = EXAM_COURSES[courseKey];
  const generatedRoot = path.join(root, 'public', 'generated', courseKey);
  const catalogPath = path.join(generatedRoot, 'catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const courseReport = {
    course: course.shortName,
    papers: catalog.tests.length,
    questions: 0,
    passages: 0,
    visualQuestions: 0,
    printable: true
  };

  if (catalog.tests.length !== 30) {
    fail(`${course.shortName}: expected 30 papers, found ${catalog.tests.length}.`);
  }

  const printSections = course.printPattern?.sections || [];
  const printQuestionTotal = printSections.reduce((total, section) => total + section.questions, 0);
  const printMarksTotal = printSections.reduce((total, section) => total + section.marks, 0);
  if (printQuestionTotal !== course.standard.questionsPerPaper) {
    fail(`${course.shortName}: printable pattern totals ${printQuestionTotal}/${course.standard.questionsPerPaper} questions.`);
  }
  if (printMarksTotal !== course.standard.marksPerPaper) {
    fail(`${course.shortName}: printable pattern totals ${printMarksTotal}/${course.standard.marksPerPaper} marks.`);
  }

  for (const metadata of catalog.tests) {
    const paperPath = path.join(generatedRoot, 'tests', `${metadata.id}.json`);
    if (!fs.existsSync(paperPath)) {
      fail(`${metadata.id}: printable paper file is missing.`);
      continue;
    }

    const test = JSON.parse(fs.readFileSync(paperPath, 'utf8')).test;
    const questions = Array.isArray(test?.questions) ? test.questions : [];
    const expectedQuestions = course.standard.questionsPerPaper;
    if (questions.length !== expectedQuestions) {
      fail(`${metadata.id}: expected ${expectedQuestions} questions, found ${questions.length}.`);
    }

    let sectionStart = 0;
    for (const section of course.blueprint) {
      const count = questions.filter((question) => question.subject === section.subject).length;
      if (count !== section.questionCount) {
        fail(`${metadata.id}: ${section.subject} has ${count}/${section.questionCount} printable questions.`);
      }
      const sectionSlice = questions.slice(sectionStart, sectionStart + section.questionCount);
      if (sectionSlice.some((question) => question.subject !== section.subject)) {
        fail(`${metadata.id}: ${section.subject} is not in the official printable section order.`);
      }
      sectionStart += section.questionCount;
    }

    questions.forEach((question, index) => {
      const label = `${metadata.id} question ${index + 1}`;
      if (question.questionNumber !== index + 1) fail(`${label}: question numbering is not sequential.`);
      if (!String(question.stem || question.text || '').trim()) fail(`${label}: question text is empty.`);
      if (!String(question.subject || '').trim()) fail(`${label}: subject is empty.`);
      if (!String(question.topic || '').trim()) fail(`${label}: topic is empty.`);
      if (!Array.isArray(question.options) || question.options.length !== 4) {
        fail(`${label}: exactly four printable options are required.`);
      } else {
        const optionIds = new Set(question.options.map((option) => option.id));
        if (optionIds.size !== 4) fail(`${label}: option identifiers are duplicated.`);
        question.options.forEach((option) => {
          if (!printableOption(option)) fail(`${label}: option ${option?.id || '?'} has no printable content.`);
        });
      }
      if (question.passageId) {
        courseReport.passages += 1;
        if (!String(question.passage || '').trim()) fail(`${label}: passage text is missing.`);
      }
      if (question.stimulus) {
        courseReport.visualQuestions += 1;
        if (!supportedStimuli.has(question.stimulus.kind)) {
          fail(`${label}: unsupported printable stimulus ${question.stimulus.kind}.`);
        }
        const stimulusFigures = question.stimulus.kind === 'figure-sequence'
          ? question.stimulus.items || []
          : question.stimulus.figure
            ? [question.stimulus.figure]
            : [];
        stimulusFigures.forEach((figure) => {
          report.totals.visualFigureChecks += 1;
          if (!supportedShapes.has(figure?.shape)) fail(`${label}: unsupported printable figure shape ${figure?.shape || 'missing'}.`);
        });
      }
      (question.options || []).filter((option) => option.figure).forEach((option) => {
        report.totals.visualFigureChecks += 1;
        if (!supportedShapes.has(option.figure.shape)) fail(`${label}: unsupported printable option figure ${option.figure.shape}.`);
      });
    });

    courseReport.questions += questions.length;
    report.totals.papers += 1;
    report.totals.questions += questions.length;
    report.totals.options += questions.reduce(
      (total, question) => total + (question.options?.length || 0),
      0
    );
  }

  report.totals.courses += 1;
  report.totals.passages += courseReport.passages;
  report.totals.visualQuestions += courseReport.visualQuestions;
  report.courses.push(courseReport);
}

if (errors.length) {
  report.status = 'failed';
  report.errors = errors;
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
