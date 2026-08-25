import { AuthError, authConfiguration, sessionUser } from './auth-service.js';
import { getExamCourse } from './exam-courses.js';
import { translateSubject } from './src/localization.js';

const allowedLocales = new Set(['en', 'hi', 'te']);
const requestWindows = new Map();
const windowDurationMs = 60 * 1000;
const requestsPerWindow = 20;

const localeNames = { en: 'English', hi: 'Hindi', te: 'Telugu' };

const GUIDED_COPY = {
  en: {
    plan: (course) => `Here is a simple ${course.shortName} study plan:\n1. Review one syllabus topic for 25 minutes.\n2. Solve 10 questions without notes.\n3. Check every mistake and write the rule you missed.\n4. Finish with a 10-minute recap.\nUse the Mock Tests page for full-paper practice.`,
    warmup: (course, topics) => `For a quick ${course.shortName} warm-up, practise one question from each of these areas: ${topics.slice(0, 5).join(', ')}. Open Mock Tests to answer validated questions from the question bank.`,
    syllabus: (course, sections) => `${course.shortName} ${course.className} has ${course.standard.questionsPerPaper} questions for ${course.standard.marksPerPaper} marks in ${course.standard.durationMinutes} minutes. The paper covers ${sections}.`,
    default: (course, sections) => `I can guide you through the ${course.shortName} syllabus: ${sections}. Ask me for a topic summary, a study plan, or where to find a practice test. Full AI explanations become available after secure institute AI access is configured.`,
  },
  hi: {
    plan: (course) => `${course.shortName} के लिए सरल अध्ययन योजना:\n1. 25 मिनट एक पाठ्यक्रम विषय पढ़ें।\n2. बिना नोट्स के 10 प्रश्न हल करें।\n3. हर गलती जाँचें और छूटा हुआ नियम लिखें।\n4. 10 मिनट में दोहराव करें।\nपूरा अभ्यास प्रश्नपत्र Mock Tests में खोलें।`,
    warmup: (course, topics) => `${course.shortName} के त्वरित अभ्यास के लिए इन क्षेत्रों से एक-एक प्रश्न हल करें: ${topics.slice(0, 5).join(', ')}। सत्यापित प्रश्न हल करने के लिए Mock Tests खोलें।`,
    syllabus: (course, sections) => `${course.shortName} ${course.className} में ${course.standard.durationMinutes} मिनट में ${course.standard.marksPerPaper} अंकों के ${course.standard.questionsPerPaper} प्रश्न हैं। प्रश्नपत्र में ${sections} शामिल हैं।`,
    default: (course, sections) => `मैं ${course.shortName} पाठ्यक्रम में मार्गदर्शन कर सकता हूँ: ${sections}। विषय सारांश, अध्ययन योजना या अभ्यास टेस्ट के बारे में पूछें। सुरक्षित संस्थान AI पहुँच कॉन्फ़िगर होने पर विस्तृत AI व्याख्या उपलब्ध होगी।`,
  },
  te: {
    plan: (course) => `${course.shortName} కోసం సరళమైన చదువు ప్రణాళిక:\n1. ఒక సిలబస్ అంశాన్ని 25 నిమిషాలు చదవండి.\n2. నోట్స్ లేకుండా 10 ప్రశ్నలు పరిష్కరించండి.\n3. ప్రతి తప్పును పరిశీలించి మిస్సయిన నియమాన్ని రాయండి.\n4. 10 నిమిషాల పునశ్చరణతో ముగించండి.\nపూర్తి పేపర్ సాధనకు Mock Tests తెరవండి.`,
    warmup: (course, topics) => `${course.shortName} త్వరిత వార్మప్ కోసం ఈ అంశాల నుంచి ఒక్కో ప్రశ్న సాధన చేయండి: ${topics.slice(0, 5).join(', ')}. ధృవీకరించిన ప్రశ్నల కోసం Mock Tests తెరవండి.`,
    syllabus: (course, sections) => `${course.shortName} ${course.className} పరీక్షలో ${course.standard.durationMinutes} నిమిషాల్లో ${course.standard.marksPerPaper} మార్కులకు ${course.standard.questionsPerPaper} ప్రశ్నలు ఉంటాయి. పేపర్‌లో ${sections} ఉంటాయి.`,
    default: (course, sections) => `${course.shortName} సిలబస్‌లో నేను మీకు మార్గనిర్దేశం చేయగలను: ${sections}. అంశ సారాంశం, చదువు ప్రణాళిక లేదా ప్రాక్టీస్ టెస్ట్ ఎక్కడ దొరుకుతుందో అడగండి. సురక్షిత సంస్థ AI యాక్సెస్ కాన్ఫిగర్ అయిన తరువాత పూర్తి AI వివరణలు అందుబాటులో ఉంటాయి.`,
  },
};

function normalizeInput(input = {}) {
  const message = String(input.message || '').trim();
  if (!message) throw new AuthError(400, 'TUTOR_MESSAGE_REQUIRED', 'Enter a question for the tutor.');
  if (message.length > 1200) throw new AuthError(413, 'TUTOR_MESSAGE_TOO_LONG', 'Keep the tutor question under 1,200 characters.');
  const locale = allowedLocales.has(input.locale) ? input.locale : 'en';
  const course = getExamCourse(input.course);
  const history = Array.isArray(input.history)
    ? input.history.slice(-6).map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: String(item?.content || '').slice(0, 1200),
    })).filter((item) => item.content)
    : [];
  return { message, locale, course, history };
}

function guidedReply({ message, locale, course }) {
  const copy = GUIDED_COPY[locale] || GUIDED_COPY.en;
  const normalized = message.toLowerCase();
  const localizedSubjects = course.blueprint.map((section) => translateSubject(section.subject, locale));
  const sections = localizedSubjects.join(', ');
  const topics = locale === 'en'
    ? course.blueprint.flatMap((section) => section.topics.map(([topic]) => topic))
    : localizedSubjects;
  if (/plan|schedule|time|study|योजना|समय|पढ़|ప్రణాళిక|సమయం|చదువు/.test(normalized)) return copy.plan(course);
  if (/warm|quiz|question|practice|अभ्यास|प्रश्न|సాధన|ప్రశ్న/.test(normalized)) return copy.warmup(course, topics);
  if (/syllabus|subject|section|topic|पाठ्यक्रम|विषय|खंड|సిలబస్|అంశం|విషయం/.test(normalized)) return copy.syllabus(course, sections);
  return copy.default(course, sections);
}

function enforceRateLimit(user) {
  const key = user.id;
  const now = Date.now();
  const active = requestWindows.get(key);
  const window = !active || now - active.startedAt >= windowDurationMs
    ? { startedAt: now, count: 0 }
    : active;
  window.count += 1;
  requestWindows.set(key, window);
  if (window.count > requestsPerWindow) throw new AuthError(429, 'TUTOR_RATE_LIMITED', 'Please wait a minute before asking more tutor questions.');
}

function syllabusContext(course) {
  return course.blueprint.map((section) => ({
    subject: section.subject,
    questionCount: section.questionCount,
    marks: section.marks,
    topics: section.topics.map(([topic]) => topic),
  }));
}

function responseText(payload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text' && item.text)
    .map((item) => item.text)
    .join('\n')
    .trim();
}

async function openAiReply({ message, locale, course, history }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TUTOR_MODEL || 'gpt-5.4-mini',
      store: false,
      max_output_tokens: 550,
      instructions: [
        'You are Vijetha Holo Tutor, an age-appropriate learning assistant for Class VI entrance-exam preparation.',
        `Reply in ${localeNames[locale]}. Keep explanations clear, encouraging, concise, and suitable for a child.`,
        `The selected course is ${course.name} (${course.shortName}), ${course.className}, syllabus year ${course.year}.`,
        `Use only this approved syllabus map and exam structure: ${JSON.stringify(syllabusContext(course))}.`,
        `Paper structure: ${course.standard.questionsPerPaper} questions, ${course.standard.marksPerPaper} marks, ${course.standard.durationMinutes} minutes.`,
        'Do not claim to be an official exam authority. Do not request or repeat personal information. Refuse dangerous, sexual, or otherwise age-inappropriate requests and redirect to safe learning.',
        'If unsure, say so and advise the student to ask their teacher. Do not invent official dates, rules, answers, or syllabus topics.',
      ].join('\n'),
      input: [...history, { role: 'user', content: message }],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('OpenAI tutor request failed:', response.status, payload?.error?.type || 'unknown');
    throw new AuthError(502, 'TUTOR_PROVIDER_ERROR', 'The AI tutor is temporarily unavailable. Guided syllabus mode is still available.');
  }
  const reply = responseText(payload);
  if (!reply) throw new AuthError(502, 'TUTOR_EMPTY_RESPONSE', 'The AI tutor did not return an explanation. Please try again.');
  return reply;
}

export async function answerTutorQuestion(input, request) {
  const normalized = normalizeInput(input);
  const configuration = authConfiguration();
  const liveConfigured = Boolean(process.env.OPENAI_API_KEY && configuration.database && configuration.secret);
  if (!liveConfigured) return { reply: guidedReply(normalized), aiConnected: false, mode: 'guided' };

  const user = await sessionUser(request);
  if (!user) return { reply: guidedReply(normalized), aiConnected: false, mode: 'guided' };
  enforceRateLimit(user);
  return { reply: await openAiReply(normalized), aiConnected: true, mode: 'ai' };
}
