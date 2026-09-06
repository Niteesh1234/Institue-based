import { createHash } from 'node:crypto';
import { generateText } from 'ai';
import { AuthError, sessionUser } from './auth-service.js';
import { getExamCourse } from './exam-courses.js';
import { translateSubject } from './src/localization.js';

const allowedLocales = new Set(['en', 'hi', 'te']);
const allowedLearningModes = new Set(['explain', 'steps', 'practice']);
const requestWindows = new Map();
const windowDurationMs = 60 * 1000;
const requestsPerWindow = 16;

const localeNames = { en: 'English', hi: 'Hindi', te: 'Telugu' };
const modeInstructions = {
  explain: 'Explain the idea in plain language, give one concrete example, and end with one quick understanding-check question.',
  steps: 'Teach through numbered steps. Show every important reasoning step, explain why it works, and end with a short recap.',
  practice: 'Briefly teach the idea, then give one age-appropriate practice question. Do not reveal the practice answer until the student attempts it.',
};

function boundedText(value, max = 1200) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function findSection(course, value) {
  const needle = boundedText(value, 120).toLowerCase();
  if (!needle) return null;
  return course.blueprint.find((section) => (
    section.key.toLowerCase() === needle
    || section.subject.toLowerCase() === needle
    || (section.aliases || []).some((alias) => alias.toLowerCase() === needle)
  )) || null;
}

function findTopic(section, value) {
  const needle = boundedText(value, 160).toLowerCase();
  if (!needle || !section) return '';
  const match = section.topics.find(([topic]) => topic.toLowerCase() === needle);
  return match?.[0] || '';
}

function normalizeLearningContext(value, course) {
  if (!value || typeof value !== 'object') return { subject: '', topic: '', mode: 'explain' };
  const requestedSubject = boundedText(value.subject, 120);
  const requestedTopic = boundedText(value.topic, 160);
  let section = requestedSubject ? findSection(course, requestedSubject) : null;
  if (requestedSubject && !section) {
    throw new AuthError(400, 'TUTOR_SUBJECT_INVALID', 'Choose a subject from the selected exam syllabus.');
  }
  if (!section && requestedTopic) {
    section = course.blueprint.find((candidate) => findTopic(candidate, requestedTopic)) || null;
  }
  const topic = requestedTopic ? findTopic(section, requestedTopic) : '';
  if (requestedTopic && !topic) {
    throw new AuthError(400, 'TUTOR_TOPIC_INVALID', 'Choose a topic from the selected syllabus subject.');
  }
  const mode = allowedLearningModes.has(value.mode) ? value.mode : 'explain';
  return { subject: section?.subject || '', topic, mode };
}

const GUIDED_COPY = {
  en: {
    plan: (course) => `Here is a simple ${course.shortName} study plan:\n1. Review one syllabus topic for 25 minutes.\n2. Solve 10 questions without notes.\n3. Check every mistake and write the rule you missed.\n4. Finish with a 10-minute recap.\nUse the Mock Tests page for full-paper practice.`,
    warmup: (course, topics) => `For a quick ${course.shortName} warm-up, practise one question from each of these areas: ${topics.slice(0, 5).join(', ')}. Open Mock Tests to answer validated questions from the question bank.`,
    syllabus: (course, sections) => `${course.shortName} ${course.className} has ${course.standard.questionsPerPaper} questions for ${course.standard.marksPerPaper} marks in ${course.standard.durationMinutes} minutes. The paper covers ${sections}.`,
    selected: ({ subject, topic, mode }) => mode === 'practice'
      ? `${topic} is part of ${subject}. First recall the meaning and one example. Now try this learning check: explain one rule or pattern you would use when solving a ${topic} question. Send your attempt and I will guide the next step.`
      : mode === 'steps'
        ? `${topic} is part of ${subject}.\n1. State what the question gives you.\n2. Identify the ${topic} rule or relationship.\n3. Apply that rule one small step at a time.\n4. Check that the result answers the original question.\nTell me the exact part that is confusing, and I will work through it with you.`
        : `${topic} belongs to the ${subject} syllabus. Start by describing the idea in your own words, then connect it to one everyday example. Ask me a specific “why” or “how” question about ${topic}, and I will explain it at Class VI level.`,
    default: (course, sections) => `I can guide you through the ${course.shortName} syllabus: ${sections}. Choose a subject and topic above, then ask what you want to understand. I am in guided mode right now; full conversational explanations require the institute's AI provider connection.`,
  },
  hi: {
    plan: (course) => `${course.shortName} के लिए सरल अध्ययन योजना:\n1. 25 मिनट एक पाठ्यक्रम विषय पढ़ें।\n2. बिना नोट्स के 10 प्रश्न हल करें।\n3. हर गलती जाँचें और छूटा हुआ नियम लिखें।\n4. 10 मिनट में दोहराव करें।\nपूरा अभ्यास प्रश्नपत्र Mock Tests में खोलें।`,
    warmup: (course, topics) => `${course.shortName} के त्वरित अभ्यास के लिए इन क्षेत्रों से एक-एक प्रश्न हल करें: ${topics.slice(0, 5).join(', ')}। सत्यापित प्रश्न हल करने के लिए Mock Tests खोलें।`,
    syllabus: (course, sections) => `${course.shortName} ${course.className} में ${course.standard.durationMinutes} मिनट में ${course.standard.marksPerPaper} अंकों के ${course.standard.questionsPerPaper} प्रश्न हैं। प्रश्नपत्र में ${sections} शामिल हैं।`,
    selected: ({ subject, topic, mode }) => mode === 'practice'
      ? `${topic}, ${subject} का विषय है। पहले इसका अर्थ और एक उदाहरण याद करें। अब अभ्यास करें: ${topic} का प्रश्न हल करते समय उपयोग होने वाला एक नियम या पैटर्न अपने शब्दों में लिखें। अपना उत्तर भेजें; मैं अगला कदम समझाऊँगा।`
      : mode === 'steps'
        ? `${topic}, ${subject} का विषय है।\n1. प्रश्न में दी गई जानकारी लिखें।\n2. ${topic} का सही नियम पहचानें।\n3. नियम को छोटे चरणों में लागू करें।\n4. जाँचें कि परिणाम मूल प्रश्न का उत्तर देता है।\nकौन-सा चरण कठिन है, वह बताइए।`
        : `${topic}, ${subject} का पाठ्यक्रम विषय है। पहले विचार को अपने शब्दों में कहें और उसे एक रोज़मर्रा के उदाहरण से जोड़ें। ${topic} पर “क्यों” या “कैसे” वाला स्पष्ट प्रश्न पूछें; मैं कक्षा VI स्तर पर समझाऊँगा।`,
    default: (course, sections) => `मैं ${course.shortName} पाठ्यक्रम में मार्गदर्शन कर सकता हूँ: ${sections}। ऊपर विषय और अध्याय चुनकर पूछें कि आप क्या समझना चाहते हैं। अभी निर्देशित मोड चालू है; पूरी बातचीत के लिए संस्थान का AI प्रदाता जुड़ना आवश्यक है।`,
  },
  te: {
    plan: (course) => `${course.shortName} కోసం సరళమైన చదువు ప్రణాళిక:\n1. ఒక సిలబస్ అంశాన్ని 25 నిమిషాలు చదవండి.\n2. నోట్స్ లేకుండా 10 ప్రశ్నలు పరిష్కరించండి.\n3. ప్రతి తప్పును పరిశీలించి మిస్సయిన నియమాన్ని రాయండి.\n4. 10 నిమిషాల పునశ్చరణతో ముగించండి.\nపూర్తి పేపర్ సాధనకు Mock Tests తెరవండి.`,
    warmup: (course, topics) => `${course.shortName} త్వరిత వార్మప్ కోసం ఈ అంశాల నుంచి ఒక్కో ప్రశ్న సాధన చేయండి: ${topics.slice(0, 5).join(', ')}. ధృవీకరించిన ప్రశ్నల కోసం Mock Tests తెరవండి.`,
    syllabus: (course, sections) => `${course.shortName} ${course.className} పరీక్షలో ${course.standard.durationMinutes} నిమిషాల్లో ${course.standard.marksPerPaper} మార్కులకు ${course.standard.questionsPerPaper} ప్రశ్నలు ఉంటాయి. పేపర్‌లో ${sections} ఉంటాయి.`,
    selected: ({ subject, topic, mode }) => mode === 'practice'
      ? `${topic}, ${subject}లోని అంశం. ముందుగా దాని అర్థం, ఒక ఉదాహరణ గుర్తుచేసుకోండి. ఇప్పుడు సాధన: ${topic} ప్రశ్నను పరిష్కరించేటప్పుడు ఉపయోగించే ఒక నియమం లేదా నమూనాను మీ మాటల్లో చెప్పండి. మీ ప్రయత్నాన్ని పంపండి; తదుపరి దశలో సహాయం చేస్తాను.`
      : mode === 'steps'
        ? `${topic}, ${subject}లోని అంశం.\n1. ప్రశ్నలో ఇచ్చిన సమాచారాన్ని రాయండి.\n2. ${topic} నియమం లేదా సంబంధాన్ని గుర్తించండి.\n3. దానిని చిన్న దశల్లో ఉపయోగించండి.\n4. ఫలితం అసలు ప్రశ్నకు సమాధానమో చూడండి.\nఏ దశ కష్టంగా ఉందో చెప్పండి.`
        : `${topic}, ${subject} సిలబస్ అంశం. భావాన్ని మీ మాటల్లో చెప్పి, రోజువారీ ఉదాహరణతో కలపండి. ${topic} గురించి స్పష్టమైన “ఎందుకు” లేదా “ఎలా” ప్రశ్న అడగండి; నేను ఆరవ తరగతి స్థాయిలో వివరిస్తాను.`,
    default: (course, sections) => `${course.shortName} సిలబస్‌లో నేను మీకు మార్గనిర్దేశం చేయగలను: ${sections}. పైన విషయం, అంశం ఎంచుకుని మీ సందేహాన్ని అడగండి. ప్రస్తుతం గైడెడ్ మోడ్‌లో ఉంది; పూర్తి సంభాషణాత్మక వివరణలకు సంస్థ AI ప్రొవైడర్ కనెక్షన్ అవసరం.`,
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
  return { message, locale, course, history, learningContext: normalizeLearningContext(input.learningContext, course) };
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
  if (locale === 'hi') return `${left} ${operator} ${right} = ${answer}। पहले संक्रिया पहचानें, फिर संख्याओं पर उसे लागू करें। चाहें तो मैं इसी प्रकार का अभ्यास प्रश्न दूँगा।`;
  if (locale === 'te') return `${left} ${operator} ${right} = ${answer}. ముందుగా క్రియను గుర్తించి సంఖ్యలపై వర్తింపజేయండి. కావాలంటే ఇదే తరహా సాధన ప్రశ్న ఇస్తాను.`;
  return `${left} ${operator} ${right} = ${answer}. First identify the operation, then apply it to the two numbers. I can give you a similar practice question next.`;
}

function topicLocationReply(message, locale, course) {
  const normalized = String(message).toLowerCase();
  for (const section of course.blueprint) {
    const topic = section.topics.map(([name]) => name).find((name) => normalized.includes(name.toLowerCase()));
    if (!topic) continue;
    const subject = translateSubject(section.subject, locale);
    if (locale === 'hi') return `${topic}, ${subject} खंड का सत्यापित पाठ्यक्रम विषय है। ऊपर यह विषय चुनें और बताइए कि परिभाषा, उदाहरण, चरणबद्ध समझ या अभ्यास में से क्या चाहिए।`;
    if (locale === 'te') return `${topic}, ${subject} విభాగంలోని ధృవీకరించిన సిలబస్ అంశం. పైన దాన్ని ఎంచుకుని నిర్వచనం, ఉదాహరణ, దశల వివరణ లేదా సాధనలో ఏది కావాలో చెప్పండి.`;
    return `${topic} is a verified syllabus topic in the ${subject} section. Select it above and ask for a definition, example, step-by-step explanation, or practice.`;
  }
  return '';
}

function guidedReply({ message, locale, course, learningContext }) {
  const copy = GUIDED_COPY[locale] || GUIDED_COPY.en;
  const normalized = message.toLowerCase();
  const localizedSubjects = course.blueprint.map((section) => translateSubject(section.subject, locale));
  const sections = localizedSubjects.join(', ');
  const topics = locale === 'en'
    ? course.blueprint.flatMap((section) => section.topics.map(([topic]) => topic))
    : localizedSubjects;
  const calculation = arithmeticReply(message, locale);
  if (calculation) return calculation;
  if (learningContext.subject && learningContext.topic) {
    return copy.selected({
      subject: translateSubject(learningContext.subject, locale),
      topic: learningContext.topic,
      mode: learningContext.mode,
    });
  }
  const topicLocation = topicLocationReply(message, locale, course);
  if (topicLocation) return topicLocation;
  if (/plan|schedule|time|study|योजना|समय|पढ़|ప్రణాళిక|సమయం|చదువు/.test(normalized)) return copy.plan(course);
  if (/warm|quiz|question|practice|अभ्यास|प्रश्न|సాధన|ప్రశ్న/.test(normalized)) return copy.warmup(course, topics);
  if (/syllabus|subject|section|topic|पाठ्यक्रम|विषय|खंड|సిలబస్|అంశం|విషయం/.test(normalized)) return copy.syllabus(course, sections);
  return copy.default(course, sections);
}

function enforceRateLimit(identity) {
  const now = Date.now();
  const active = requestWindows.get(identity);
  const window = !active || now - active.startedAt >= windowDurationMs
    ? { startedAt: now, count: 0 }
    : active;
  window.count += 1;
  requestWindows.set(identity, window);
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

function tutorInstructions(locale, course, learningContext) {
  const instructions = [
    'You are Vijetha AI Study Tutor, a warm, patient conversational teacher for Class VI entrance-exam preparation.',
    `The preferred interface language is ${localeNames[locale]}. If the student clearly asks in English, Hindi, or Telugu, answer in that same language; otherwise use ${localeNames[locale]}.`,
    `The selected course is ${course.name} (${course.shortName}), ${course.className}, syllabus year ${course.year}.`,
    `Use this approved syllabus map and exam structure as the source of truth for exam-specific answers: ${JSON.stringify(syllabusContext(course))}.`,
    `Paper structure: ${course.standard.questionsPerPaper} questions, ${course.standard.marksPerPaper} marks, ${course.standard.durationMinutes} minutes.`,
    'The chat is a standalone learning module. Do not assume that the student is asking about an uploaded or extracted test question.',
    'Directly answer the student’s actual question. Teach the underlying concept, connect new ideas to what a Class VI student already knows, and use a simple example whenever useful.',
    'For calculations, show short, understandable steps. For ambiguous questions, ask one concise clarifying question. For follow-ups, use the supplied conversation history.',
    'When a question is related but outside the selected exam syllabus, briefly label it as extra learning and still help. Never pretend it is an official syllabus topic.',
    'Keep most answers between 80 and 300 words unless the student asks for a different level of detail. Use plain text, short paragraphs, or numbered steps. Do not use Markdown tables or code fences.',
    'End explanations with a brief check-for-understanding question when appropriate. Encourage thinking without being judgmental.',
    'Do not claim to be an official exam authority. Do not request or repeat personal information. Refuse dangerous, sexual, or otherwise age-inappropriate requests and redirect to safe learning.',
    'Do not invent current dates, official notices, rules, answer keys, or syllabus topics. If current information is required or you are unsure, say so and advise the student to ask their teacher.',
    modeInstructions[learningContext.mode],
  ];
  if (learningContext.subject) instructions.push(`The student selected the syllabus subject “${learningContext.subject}”. Focus the answer on that subject unless their message clearly changes the subject.`);
  if (learningContext.topic) instructions.push(`The student selected the syllabus topic “${learningContext.topic}”. Use it as learning context, but answer the student's exact request rather than reciting a generic overview.`);
  return instructions.join('\n');
}

function gatewayModel() {
  const configured = process.env.OPENAI_TUTOR_MODEL || 'gpt-6-astra';
  return configured.includes('/') ? configured : `openai/${configured}`;
}

function callerIdentity(request, user) {
  if (user?.id) return `user-${user.id}`.slice(0, 64);
  const forwarded = String(request?.headers?.['x-forwarded-for'] || request?.socket?.remoteAddress || 'anonymous').split(',')[0].trim();
  const agent = String(request?.headers?.['user-agent'] || 'unknown').slice(0, 160);
  return `guest-${createHash('sha256').update(`${forwarded}:${agent}`).digest('hex').slice(0, 32)}`;
}

async function gatewayReply(normalized, identity) {
  const { locale, course, learningContext } = normalized;
  const result = await generateText({
    model: gatewayModel(),
    instructions: tutorInstructions(locale, course, learningContext),
    messages: [...normalized.history, { role: 'user', content: normalized.message }],
    maxOutputTokens: 900,
    abortSignal: AbortSignal.timeout(28000),
    providerOptions: {
      gateway: {
        user: identity,
        tags: ['feature:study-tutor', `course:${course.key}`, `locale:${locale}`, `mode:${learningContext.mode}`],
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

async function openAiReply(normalized, identity) {
  const { locale, course, learningContext } = normalized;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TUTOR_MODEL || 'gpt-6-astra',
      store: false,
      max_output_tokens: 900,
      instructions: tutorInstructions(locale, course, learningContext),
      input: [...normalized.history, { role: 'user', content: normalized.message }],
      safety_identifier: identity,
      prompt_cache_key: `vijetha-study-${course.key}-${locale}`,
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
  if (!gatewayConfigured && !openAiConfigured) {
    return { reply: guidedReply(normalized), aiConnected: false, mode: 'guided', learningContext: normalized.learningContext };
  }

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
    return { reply, aiConnected: true, mode: 'ai', learningContext: normalized.learningContext };
  } catch (error) {
    console.error('AI tutor provider failed; using guided fallback:', error?.name || 'Error', error?.message || 'unknown');
    return { reply: guidedReply(normalized), aiConnected: false, mode: 'guided', degraded: true, learningContext: normalized.learningContext };
  }
}
