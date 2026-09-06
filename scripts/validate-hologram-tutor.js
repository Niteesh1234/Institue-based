import { answerTutorQuestion } from '../ai-tutor-service.js';
import { COURSE_KEYS, getExamCourse } from '../exam-courses.js';

const originalEnvironment = {
  openAi: process.env.OPENAI_API_KEY,
  gateway: process.env.AI_GATEWAY_API_KEY,
  oidc: process.env.VERCEL_OIDC_TOKEN,
  vercel: process.env.VERCEL,
};
delete process.env.OPENAI_API_KEY;
delete process.env.AI_GATEWAY_API_KEY;
delete process.env.VERCEL_OIDC_TOKEN;
delete process.env.VERCEL;

const request = { headers: {}, socket: {} };
const locales = ['en', 'hi', 'te'];
let checks = 0;

for (const courseKey of COURSE_KEYS) {
  const course = getExamCourse(courseKey);
  for (const locale of locales) {
    const result = await answerTutorQuestion({
      message: locale === 'hi' ? 'पाठ्यक्रम समझाइए' : locale === 'te' ? 'సిలబస్ వివరించండి' : 'Explain the syllabus',
      locale,
      course: courseKey,
      history: [],
    }, request);
    if (result.mode !== 'guided' || result.aiConnected !== false) throw new Error(`${courseKey}/${locale} did not use guided mode without a private API key.`);
    if (!result.reply.includes(String(course.standard.questionsPerPaper))) throw new Error(`${courseKey}/${locale} omitted the official question count.`);
    if (!result.reply.includes(String(course.standard.marksPerPaper))) throw new Error(`${courseKey}/${locale} omitted the official mark count.`);
    checks += 3;
  }
}

const arithmetic = await answerTutorQuestion({ message: 'What is 18 times 7?', locale: 'en', course: 'jnvst' }, request);
if (!arithmetic.reply.includes('126')) throw new Error('Guided arithmetic fallback did not solve a safe calculation.');
checks += 1;

const questionOptions = [
  { id: 'A', label: '21' },
  { id: 'B', label: '24' },
  { id: 'C', label: '28' },
  { id: 'D', label: '32' },
];
const activeTestHint = await answerTutorQuestion({
  message: 'What is the answer? Explain it.',
  locale: 'en',
  course: 'jnvst',
  questionContext: {
    number: '8',
    stem: 'What is 4 times 7?',
    options: questionOptions,
    answer: 'C',
    selectedOption: 'B',
    hintOnly: true,
    hasVisual: true,
  },
}, request);
if (!/hint/i.test(activeTestHint.reply) || /\b28\b|option C/i.test(activeTestHint.reply) || !/diagram/i.test(activeTestHint.reply)) {
  throw new Error('Active-test question tutoring did not preserve answer-safe diagram hint mode.');
}
checks += 1;

const reviewedQuestion = await answerTutorQuestion({
  message: 'Explain the answer step by step.',
  locale: 'en',
  course: 'jnvst',
  questionContext: {
    number: '8',
    stem: 'What is 4 times 7?',
    options: questionOptions,
    answer: 'C',
    selectedOption: 'B',
    hintOnly: false,
  },
}, request);
if (!reviewedQuestion.reply.includes('28')) throw new Error('Review-mode question tutoring did not explain the supplied arithmetic question.');
checks += 1;

let rejectedDiagram = false;
try {
  await answerTutorQuestion({
    message: 'Explain this diagram.',
    locale: 'en',
    course: 'jnvst',
    questionContext: {
      stem: 'Choose the next figure.',
      hintOnly: true,
      image: { mimeType: 'image/webp', dataBase64: Buffer.alloc(600 * 1024 + 1).toString('base64') },
    },
  }, request);
} catch (error) {
  rejectedDiagram = error.code === 'TUTOR_IMAGE_TOO_LARGE' && error.status === 413;
}
if (!rejectedDiagram) throw new Error('Oversized question diagrams were not rejected.');
checks += 1;

const topic = await answerTutorQuestion({ message: 'Help me learn Pattern Completion', locale: 'en', course: 'jnvst' }, request);
if (!/Pattern Completion/.test(topic.reply) || !/Mental Ability/.test(topic.reply)) throw new Error('Guided topic lookup did not map a syllabus topic to its section.');
checks += 1;

let rejectedOversize = false;
try {
  await answerTutorQuestion({ message: 'x'.repeat(1201), locale: 'en', course: 'jnvst' }, request);
} catch (error) {
  rejectedOversize = error.code === 'TUTOR_MESSAGE_TOO_LONG' && error.status === 413;
}
if (!rejectedOversize) throw new Error('Oversized tutor messages were not rejected.');
checks += 1;

if (originalEnvironment.openAi) process.env.OPENAI_API_KEY = originalEnvironment.openAi;
if (originalEnvironment.gateway) process.env.AI_GATEWAY_API_KEY = originalEnvironment.gateway;
if (originalEnvironment.oidc) process.env.VERCEL_OIDC_TOKEN = originalEnvironment.oidc;
if (originalEnvironment.vercel) process.env.VERCEL = originalEnvironment.vercel;

console.log(JSON.stringify({
  status: 'passed',
  courses: COURSE_KEYS.length,
  locales: locales.length,
  guidedModeChecks: checks,
  apiKeyExposedToBrowser: false,
}, null, 2));
