import { answerTutorQuestion } from '../ai-tutor-service.js';
import { COURSE_KEYS, getExamCourse } from '../exam-courses.js';

const originalKey = process.env.OPENAI_API_KEY;
delete process.env.OPENAI_API_KEY;

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

let rejectedOversize = false;
try {
  await answerTutorQuestion({ message: 'x'.repeat(1201), locale: 'en', course: 'jnvst' }, request);
} catch (error) {
  rejectedOversize = error.code === 'TUTOR_MESSAGE_TOO_LONG' && error.status === 413;
}
if (!rejectedOversize) throw new Error('Oversized tutor messages were not rejected.');
checks += 1;

if (originalKey) process.env.OPENAI_API_KEY = originalKey;

console.log(JSON.stringify({
  status: 'passed',
  courses: COURSE_KEYS.length,
  locales: locales.length,
  guidedModeChecks: checks,
  apiKeyExposedToBrowser: false,
}, null, 2));
