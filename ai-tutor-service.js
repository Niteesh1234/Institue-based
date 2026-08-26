import { createHash } from 'node:crypto';
import { generateText } from 'ai';
import { AuthError, sessionUser } from './auth-service.js';
import { getExamCourse } from './exam-courses.js';
import { translateSubject } from './src/localization.js';

const allowedLocales = new Set(['en', 'hi', 'te']);
const requestWindows = new Map();
const windowDurationMs = 60 * 1000;
const requestsPerWindow = 16;

const localeNames = { en: 'English', hi: 'Hindi', te: 'Telugu' };

const GUIDED_COPY = {
  en: {
    plan: (course) => `Here is a simple ${course.shortName} study plan:\n1. Review one syllabus topic for 25 minutes.\n2. Solve 10 questions without notes.\n3. Check every mistake and write the rule you missed.\n4. Finish with a 10-minute recap.\nUse the Mock Tests page for full-paper practice.`,
    warmup: (course, topics) => `For a quick ${course.shortName} warm-up, practise one question from each of these areas: ${topics.slice(0, 5).join(', ')}. Open Mock Tests to answer validated questions from the question bank.`,
    syllabus: (course, sections) => `${course.shortName} ${course.className} has ${course.standard.questionsPerPaper} questions for ${course.standard.marksPerPaper} marks in ${course.standard.durationMinutes} minutes. The paper covers ${sections}.`,
    default: (course, sections) => `I can guide you through the ${course.shortName} syllabus: ${sections}. Ask a clear question about a topic, calculation, study plan, or practice test. I am in guided mode right now, so I will stay within the verified syllabus information.`,
  },
  hi: {
    plan: (course) => `${course.shortName} के लिए सरल अध्ययन योजना:\n1. 25 मिनट एक पाठ्यक्रम विषय पढ़ें।\n2. बिना नोट्स के 10 प्रश्न हल करें।\n3. हर गलती जाँचें और छूटा हुआ नियम लिखें।\n4. 10 मिनट में दोहराव करें।\nपूरा अभ्यास प्रश्नपत्र Mock Tests में खोलें।`,
    warmup: (course, topics) => `${course.shortName} के त्वरित अभ्यास के लिए इन क्षेत्रों से एक-एक प्रश्न हल करें: ${topics.slice(0, 5).join(', ')}। सत्यापित प्रश्न हल करने के लिए Mock Tests खोलें।`,
    syllabus: (course, sections) => `${course.shortName} ${course.className} में ${course.standard.durationMinutes} मिनट में ${course.standard.marksPerPaper} अंकों के ${course.standard.questionsPerPaper} प्रश्न हैं। प्रश्नपत्र में ${sections} शामिल हैं।`,
    default: (course, sections) => `मैं ${course.shortName} पाठ्यक्रम में मार्गदर्शन कर सकता हूँ: ${sections}। किसी विषय, गणना, अध्ययन योजना या अभ्यास टेस्ट पर स्पष्ट प्रश्न पूछें। अभी मैं सत्यापित पाठ्यक्रम जानकारी वाले निर्देशित मोड में हूँ।`,
  },
  te: {
    plan: (course) => `${course.shortName} కోసం సరళమైన చదువు ప్రణాళిక:\n1. ఒక సిలబస్ అంశాన్ని 25 నిమిషాలు చదవండి.\n2. నోట్స్ లేకుండా 10 ప్రశ్నలు పరిష్కరించండి.\n3. ప్రతి తప్పును పరిశీలించి మిస్సయిన నియమాన్ని రాయండి.\n4. 10 నిమిషాల పునశ్చరణతో ముగించండి.\nపూర్తి పేపర్ సాధనకు Mock Tests తెరవండి.`,
    warmup: (course, topics) => `${course.shortName} త్వరిత వార్మప్ కోసం ఈ అంశాల నుంచి ఒక్కో ప్రశ్న సాధన చేయండి: ${topics.slice(0, 5).join(', ')}. ధృవీకరించిన ప్రశ్నల కోసం Mock Tests తెరవండి.`,
    syllabus: (course, sections) => `${course.shortName} ${course.className} పరీక్షలో ${course.standard.durationMinutes} నిమిషాల్లో ${course.standard.marksPerPaper} మార్కులకు ${course.standard.questionsPerPaper} ప్రశ్నలు ఉంటాయి. పేపర్‌లో ${sections} ఉంటాయి.`,
    default: (course, sections) => `${course.shortName} సిలబస్‌లో నేను మీకు మార్గనిర్దేశం చేయగలను: ${sections}. అంశం, లెక్క, చదువు ప్రణాళిక లేదా ప్రాక్టీస్ టెస్ట్ గురించి స్పష్టంగా అడగండి. ప్రస్తుతం నేను ధృవీకరించిన సిలబస్ సమాచారంతో గైడెడ్ మోడ్‌లో ఉన్నాను.`,
  },
};

function normalizeInput(input = {}) {
  const message = String(input.message || '').trim();
  if (!message) throw new AuthError(400, 'TUTOR_MESSAGE_REQUIRED', 'Enter a question for the tutor.');
  if (message.length > 1200) throw new AuthError(413, 'TUTOR_MESSAGE_TOO_LONG', 'Keep the tutor question under 1,200 characters.');
  const locale = allowedLocales.has(input.locale) ? input.locale : 'en';
  const course = getExamCourse(input.course);
  const history = Array.isArray(input.history)
    ? input.history.slice(-10).map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: String(item?.content || '').slice(0, 1200),
    })).filter((item) => item.content)
    : [];
  return { message, locale, course, history };
}

function arithmeticReply(message, locale) {
  const normalized = String(message)
    .toLowerCase()
    .replace(/multiplied by|times|into/g, '*')
    .replace(/divided by|over/g, '/')
    .replace(/plus/g, '+')
    .replace(/minus/g, '-');
  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return '';
  const left = Number(match[1]);
  const right = Number(match[3]);
  const operator = match[2];
  if (!Number.isFinite(left) || !Number.isFinite(right) || (operator === '/' && right === 0)) return '';
  const result = operator === '+' ? left + right
    : operator === '-' ? left - right
      : operator === '*' ? left * right
        : left / right;
  const answer = Number.isInteger(result) ? String(result) : String(Number(result.toFixed(4)));
  if (locale === 'hi') return `${left} ${operator} ${right} = ${answer}। चाहें तो मैं इसी प्रकार का एक अभ्यास प्रश्न भी दे सकता हूँ।`;
  if (locale === 'te') return `${left} ${operator} ${right} = ${answer}. కావాలంటే ఇదే తరహాలో ఒక సాధన ప్రశ్న ఇస్తాను.`;
  return `${left} ${operator} ${right} = ${answer}. I can also give you a similar practice question.`;
}

function topicLocationReply(message, locale, course) {
  const normalized = String(message).toLowerCase();
  for (const section of course.blueprint) {
    const topic = section.topics.map(([name]) => name).find((name) => normalized.includes(name.toLowerCase()));
    if (!topic) continue;
    const subject = translateSubject(section.subject, locale);
    if (locale === 'hi') return `${topic}, ${subject} खंड का एक सत्यापित पाठ्यक्रम विषय है। इसकी परिभाषा, उदाहरण या अभ्यास प्रश्न के बारे में पूछें।`;
    if (locale === 'te') return `${topic}, ${subject} విభాగంలోని ధృవీకరించిన సిలబస్ అంశం. నిర్వచనం, ఉదాహరణ లేదా సాధన ప్రశ్న గురించి అడగండి.`;
    return `${topic} is a verified syllabus topic in the ${subject} section. Ask for its definition, an example, or a practice question.`;
  }
  return '';
}

function guidedReply({ message, locale, course }) {
  const copy = GUIDED_COPY[locale] || GUIDED_COPY.en;
  const normalized = message.toLowerCase();
  const localizedSubjects = course.blueprint.map((section) => translateSubject(section.subject, locale));
  const sections = localizedSubjects.join(', ');
  const topics = locale === 'en'
    ? course.blueprint.flatMap((section) => section.topics.map(([topic]) => topic))
    : localizedSubjects;
  const calculation = arithmeticReply(message, locale);
  if (calculation) return calculation;
  const topicLocation = topicLocationReply(message, locale, course);
  if (topicLocation) return topicLocation;
  if (/plan|schedule|time|study|योजना|समय|पढ़|ప్రణాళిక|సమయం|చదువు/.test(normalized)) return copy.plan(course);
  if (/warm|quiz|question|practice|अभ्यास|प्रश्न|సాధన|ప్రశ్న/.test(normalized)) return copy.warmup(course, topics);
  if (/syllabus|subject|section|topic|पाठ्यक्रम|विषय|खंड|సిలబస్|అంశం|విషయం/.test(normalized)) return copy.syllabus(course, sections);
  return copy.default(course, sections);
}

function enforceRateLimit(identity) {
  const key = identity;
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

function tutorInstructions(locale, course) {
  return [
    'You are Vijetha Holo Tutor, a fast, warm, age-appropriate conversational learning assistant for Class VI entrance-exam preparation.',
    `The preferred interface language is ${localeNames[locale]}. If the student clearly asks in English, Hindi, or Telugu, answer in that same language; otherwise use ${localeNames[locale]}.`,
    `The selected course is ${course.name} (${course.shortName}), ${course.className}, syllabus year ${course.year}.`,
    `Use this approved syllabus map and exam structure as the source of truth for exam-specific answers: ${JSON.stringify(syllabusContext(course))}.`,
    `Paper structure: ${course.standard.questionsPerPaper} questions, ${course.standard.marksPerPaper} marks, ${course.standard.durationMinutes} minutes.`,
    'Answer safe school-level questions naturally, including arithmetic, reasoning, language, environmental studies, general knowledge, concept explanations, examples, quizzes, and study planning.',
    'When a question is related but outside the selected exam syllabus, briefly label it as extra learning and still help. Never pretend it is an official syllabus topic.',
    'For calculations, show short, understandable steps. For ambiguous questions, ask one concise clarifying question. For follow-ups, use the supplied conversation history.',
    'Keep most answers under 180 words unless the student asks for detail. Prefer short paragraphs or numbered steps that sound natural when spoken aloud.',
    'Do not claim to be an official exam authority. Do not request or repeat personal information. Refuse dangerous, sexual, or otherwise age-inappropriate requests and redirect to safe learning.',
    'Do not invent current dates, official notices, rules, answer keys, or syllabus topics. If current information is required or you are unsure, say so and advise the student to ask their teacher.',
  ].join('\n');
}

function gatewayModel() {
  const configured = process.env.OPENAI_TUTOR_MODEL || 'gpt-5.4-mini';
  return configured.includes('/') ? configured : `openai/${configured}`;
}

function callerIdentity(request, user) {
  if (user?.id) return `user-${user.id}`.slice(0, 64);
  const forwarded = String(request?.headers?.['x-forwarded-for'] || request?.socket?.remoteAddress || 'anonymous').split(',')[0].trim();
  const agent = String(request?.headers?.['user-agent'] || 'unknown').slice(0, 160);
  return `guest-${createHash('sha256').update(`${forwarded}:${agent}`).digest('hex').slice(0, 32)}`;
}

async function gatewayReply({ message, locale, course, history }, identity) {
  const result = await generateText({
    model: gatewayModel(),
    instructions: tutorInstructions(locale, course),
    messages: [...history, { role: 'user', content: message }],
    maxOutputTokens: 650,
    abortSignal: AbortSignal.timeout(28000),
    providerOptions: {
      gateway: {
        user: identity,
        tags: ['feature:holo-tutor', `course:${course.key}`, `locale:${locale}`],
      },
    },
  });
  const reply = String(result.text || '').trim();
  if (!reply) throw new Error('The gateway returned an empty tutor response.');
  return reply;
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

async function openAiReply({ message, locale, course, history }, identity) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TUTOR_MODEL || 'gpt-5.4-mini',
      store: false,
      max_output_tokens: 650,
      instructions: tutorInstructions(locale, course),
      input: [...history, { role: 'user', content: message }],
      safety_identifier: identity,
      prompt_cache_key: `vijetha-${course.key}-${locale}`,
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
  const user = await sessionUser(request);
  const identity = callerIdentity(request, user);
  // On Vercel, the AI SDK obtains the short-lived OIDC credential from the
  // request context even when VERCEL_OIDC_TOKEN is not exposed as a normal env.
  const gatewayConfigured = Boolean(process.env.VERCEL || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  if (!gatewayConfigured && !openAiConfigured) return { reply: guidedReply(normalized), aiConnected: false, mode: 'guided' };

  enforceRateLimit(identity);
  try {
    let reply;
    if (gatewayConfigured) {
      try {
        reply = await gatewayReply(normalized, identity);
      } catch (gatewayError) {
        if (!openAiConfigured) throw gatewayError;
        reply = await openAiReply(normalized, identity);
      }
    } else {
      reply = await openAiReply(normalized, identity);
    }
    return { reply, aiConnected: true, mode: 'ai' };
  } catch (error) {
    console.error('AI tutor provider failed; using guided fallback:', error?.name || 'Error', error?.message || 'unknown');
    return { reply: guidedReply(normalized), aiConnected: false, mode: 'guided', degraded: true };
  }
}
