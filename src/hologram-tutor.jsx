import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  BookOpen,
  Footprints,
  Lightbulb,
  Mic,
  MicOff,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { authRequest } from "./api-client.js";
import { useI18n } from "./i18n.jsx";
import "./hologram-tutor.css";

const COPY = {
  en: {
    kicker: "INDEPENDENT SYLLABUS LEARNING CHAT",
    title: "Vijetha AI Study Tutor",
    copy: "Choose a syllabus subject and topic, then ask any related question by voice or text. The tutor teaches the concept at Class VI level and follows your preferred learning style.",
    online: "AI connected",
    guided: "Guided syllabus mode",
    listening: "Listening…",
    speaking: "Speaking…",
    thinking: "Preparing an explanation…",
    placeholder: "Ask anything about the selected syllabus topic…",
    send: "Send message",
    mic: "Use microphone",
    stopMic: "Stop listening",
    soundOn: "Voice replies on",
    soundOff: "Voice replies off",
    disclosure: "AI tutor · Answers can make mistakes. Teachers should review important guidance.",
    intro: "Hello! Choose a subject and topic above, then tell me what you want to understand. You can ask follow-up questions until the concept is clear.",
    suggestions: {
      explain: ["Explain this topic simply", "Why is this useful?", "Give me an everyday example"],
      steps: ["Teach this step by step", "Show me a worked example", "What should I do first?"],
      practice: ["Give me one practice question", "Start with an easy question", "Quiz me without showing the answer"],
    },
    microphoneUnsupported: "Voice input is not supported in this browser. You can continue by typing.",
    error: "I could not reach the tutor service. Please try again, or ask a syllabus question in guided mode.",
    you: "You",
    tutor: "Study Tutor",
    privacy: "Do not share passwords, phone numbers, addresses, or other private information.",
    providerUnavailable: "Guided syllabus help is active. Connect the institute AI provider for detailed free-form explanations and follow-up tutoring.",
    subject: "Syllabus subject",
    topic: "Topic",
    learningStyle: "How should I teach?",
    explain: "Explain simply",
    steps: "Step by step",
    practice: "Practice with me",
  },
  hi: {
    kicker: "अलग पाठ्यक्रम लर्निंग चैट",
    title: "विजेता AI स्टडी ट्यूटर",
    copy: "पाठ्यक्रम का विषय और अध्याय चुनें, फिर आवाज़ या टेक्स्ट से कोई भी संबंधित प्रश्न पूछें। ट्यूटर कक्षा VI के स्तर पर आपकी पसंद की शैली में समझाता है।",
    online: "AI जुड़ा है",
    guided: "निर्देशित पाठ्यक्रम मोड",
    listening: "सुन रहा है…",
    speaking: "उत्तर बोल रहा है…",
    thinking: "व्याख्या तैयार की जा रही है…",
    placeholder: "चुने हुए पाठ्यक्रम विषय के बारे में कुछ भी पूछें…",
    send: "संदेश भेजें",
    mic: "माइक्रोफ़ोन का उपयोग करें",
    stopMic: "सुनना बंद करें",
    soundOn: "आवाज़ में उत्तर चालू",
    soundOff: "आवाज़ में उत्तर बंद",
    disclosure: "AI ट्यूटर · उत्तरों में गलती हो सकती है। महत्वपूर्ण मार्गदर्शन शिक्षक से जाँचें।",
    intro: "नमस्ते! ऊपर विषय और अध्याय चुनें, फिर बताइए कि आप क्या समझना चाहते हैं। अवधारणा स्पष्ट होने तक आगे के प्रश्न पूछ सकते हैं।",
    suggestions: {
      explain: ["इसे सरल भाषा में समझाइए", "यह उपयोगी क्यों है?", "रोज़मर्रा का उदाहरण दीजिए"],
      steps: ["इसे चरण-दर-चरण सिखाइए", "एक हल किया उदाहरण दिखाइए", "पहले क्या करना चाहिए?"],
      practice: ["एक अभ्यास प्रश्न दीजिए", "आसान प्रश्न से शुरू करें", "उत्तर बताए बिना प्रश्न पूछें"],
    },
    microphoneUnsupported: "इस ब्राउज़र में आवाज़ इनपुट उपलब्ध नहीं है। आप टाइप करके पूछ सकते हैं।",
    error: "ट्यूटर सेवा से संपर्क नहीं हो सका। फिर प्रयास करें या निर्देशित मोड में पाठ्यक्रम का प्रश्न पूछें।",
    you: "आप",
    tutor: "स्टडी ट्यूटर",
    privacy: "पासवर्ड, फोन नंबर, पता या अन्य निजी जानकारी साझा न करें।",
    providerUnavailable: "निर्देशित पाठ्यक्रम सहायता चालू है। विस्तृत स्वतंत्र व्याख्या और आगे के प्रश्नों के लिए संस्थान का AI प्रदाता जोड़ें।",
    subject: "पाठ्यक्रम विषय",
    topic: "अध्याय",
    learningStyle: "कैसे समझाऊँ?",
    explain: "सरल व्याख्या",
    steps: "चरण-दर-चरण",
    practice: "मेरे साथ अभ्यास",
  },
  te: {
    kicker: "ప్రత్యేక సిలబస్ లెర్నింగ్ చాట్",
    title: "విజేత AI స్టడీ ట్యూటర్",
    copy: "సిలబస్ విషయం, అంశం ఎంచుకుని వాయిస్ లేదా టెక్స్ట్‌లో సంబంధిత ప్రశ్న అడగండి. ట్యూటర్ ఆరవ తరగతి స్థాయిలో మీకు నచ్చిన విధంగా బోధిస్తుంది.",
    online: "AI అనుసంధానమైంది",
    guided: "మార్గదర్శక సిలబస్ మోడ్",
    listening: "వింటోంది…",
    speaking: "సమాధానం చెబుతోంది…",
    thinking: "వివరణ సిద్ధమవుతోంది…",
    placeholder: "ఎంచుకున్న సిలబస్ అంశం గురించి ఏదైనా అడగండి…",
    send: "సందేశం పంపండి",
    mic: "మైక్రోఫోన్ ఉపయోగించండి",
    stopMic: "వినడం ఆపండి",
    soundOn: "వాయిస్ సమాధానాలు ఆన్",
    soundOff: "వాయిస్ సమాధానాలు ఆఫ్",
    disclosure: "AI ట్యూటర్ · సమాధానాల్లో పొరపాట్లు ఉండవచ్చు. ముఖ్యమైన సూచనలను ఉపాధ్యాయులు పరిశీలించాలి.",
    intro: "నమస్తే! పైన విషయం, అంశం ఎంచుకుని మీరు ఏమి అర్థం చేసుకోవాలనుకుంటున్నారో అడగండి. భావన స్పష్టమయ్యే వరకు తదుపరి ప్రశ్నలు అడగవచ్చు.",
    suggestions: {
      explain: ["ఈ అంశాన్ని సులభంగా వివరించండి", "ఇది ఎందుకు ఉపయోగకరం?", "రోజువారీ ఉదాహరణ ఇవ్వండి"],
      steps: ["దశల వారీగా నేర్పండి", "పరిష్కరించిన ఉదాహరణ చూపండి", "మొదట ఏమి చేయాలి?"],
      practice: ["ఒక సాధన ప్రశ్న ఇవ్వండి", "సులభమైన ప్రశ్నతో మొదలుపెట్టండి", "సమాధానం చూపకుండా ప్రశ్నించండి"],
    },
    microphoneUnsupported: "ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ అందుబాటులో లేదు. టైప్ చేసి కొనసాగించవచ్చు.",
    error: "ట్యూటర్ సేవను చేరుకోలేకపోయాను. మళ్లీ ప్రయత్నించండి లేదా మార్గదర్శక మోడ్‌లో సిలబస్ ప్రశ్న అడగండి.",
    you: "మీరు",
    tutor: "స్టడీ ట్యూటర్",
    privacy: "పాస్‌వర్డ్‌లు, ఫోన్ నంబర్లు, చిరునామాలు లేదా ఇతర వ్యక్తిగత సమాచారాన్ని పంచుకోవద్దు.",
    providerUnavailable: "గైడెడ్ సిలబస్ సహాయం పనిచేస్తోంది. వివరమైన స్వేచ్ఛా వివరణలు, తదుపరి ప్రశ్నల కోసం సంస్థ AI ప్రొవైడర్‌ను కనెక్ట్ చేయండి.",
    subject: "సిలబస్ విషయం",
    topic: "అంశం",
    learningStyle: "ఎలా బోధించాలి?",
    explain: "సులభంగా వివరించు",
    steps: "దశల వారీగా",
    practice: "నాతో సాధన",
  },
};

const SPEECH_LOCALES = { en: "en-IN", hi: "hi-IN", te: "te-IN" };

function speakReply(text, locale, { onStart, onEnd } = {}) {
  if (!("speechSynthesis" in window) || !text) {
    onEnd?.();
    return false;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LOCALES[locale] || SPEECH_LOCALES.en;
  utterance.rate = 0.96;
  utterance.pitch = 1.03;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function StudyTutorDrawer({ course, user, onClose }) {
  const { locale, subject: localizeSubject } = useI18n();
  const copy = COPY[locale] || COPY.en;
  const [messages, setMessages] = useState(() => [{ role: "assistant", content: copy.intro }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [aiConnected, setAiConnected] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(course.blueprint[0]?.subject || "");
  const [selectedTopic, setSelectedTopic] = useState(course.blueprint[0]?.topics[0]?.[0] || "");
  const [learningMode, setLearningMode] = useState("explain");
  const recognitionRef = useRef(null);
  const voiceTranscriptRef = useRef("");
  const voiceShouldSubmitRef = useRef(false);
  const transcriptRef = useRef(null);
  const composerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const avatarState = listening ? "listening" : busy ? "thinking" : speaking ? "speaking" : "ready";
  const activeSection = useMemo(
    () => course.blueprint.find((section) => section.subject === selectedSubject) || course.blueprint[0],
    [course, selectedSubject],
  );
  const topics = useMemo(() => activeSection?.topics.map(([topic]) => topic) || [], [activeSection]);
  const suggestions = useMemo(
    () => copy.suggestions[learningMode].map((suggestion) => `${suggestion}: ${selectedTopic}`),
    [copy.suggestions, learningMode, selectedTopic],
  );

  useEffect(() => {
    setMessages([{ role: "assistant", content: copy.intro }]);
    setDraft("");
    setNotice("");
    setAiConnected(false);
    setSpeaking(false);
    setSelectedSubject(course.blueprint[0]?.subject || "");
    setSelectedTopic(course.blueprint[0]?.topics[0]?.[0] || "");
    setLearningMode("explain");
    window.speechSynthesis?.cancel?.();
  }, [copy.intro, course.key]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [busy, messages]);

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel?.();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onCloseRef.current?.();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    const focusTimer = window.setTimeout(() => composerRef.current?.focus(), 80);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const submitMessage = async (value = draft) => {
    const question = String(value || "").trim();
    if (!question || busy) return;
    const nextMessages = [...messages, { role: "user", content: question }];
    window.speechSynthesis?.cancel?.();
    setSpeaking(false);
    setMessages(nextMessages);
    setDraft("");
    setNotice("");
    setBusy(true);
    try {
      const payload = await authRequest("/api/ai-tutor", {
        method: "POST",
        body: JSON.stringify({
          message: question,
          locale,
          course: course.key,
          history: messages.slice(-10),
          learningContext: {
            subject: selectedSubject,
            topic: selectedTopic,
            mode: learningMode,
          },
        }),
      });
      const reply = String(payload.reply || copy.error);
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
      setAiConnected(Boolean(payload.aiConnected));
      setNotice(payload.aiConnected ? "" : copy.providerUnavailable);
      if (voiceReplies) speakReply(reply, locale, {
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
      });
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: copy.error }]);
      setNotice(error.message || copy.error);
      setAiConnected(false);
    } finally {
      setBusy(false);
    }
  };

  const toggleMicrophone = () => {
    if (listening) {
      recognitionRef.current?.stop?.();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice(copy.microphoneUnsupported);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = SPEECH_LOCALES[locale] || SPEECH_LOCALES.en;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      window.speechSynthesis?.cancel?.();
      setSpeaking(false);
      setListening(true);
      setNotice("");
      voiceTranscriptRef.current = "";
      voiceShouldSubmitRef.current = false;
    };
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      voiceTranscriptRef.current = text;
      voiceShouldSubmitRef.current = Array.from(event.results).some((result) => result.isFinal);
      setDraft(text);
    };
    recognition.onspeechend = () => recognition.stop();
    recognition.onerror = () => {
      voiceShouldSubmitRef.current = false;
      setNotice(copy.microphoneUnsupported);
    };
    recognition.onend = () => {
      setListening(false);
      const spokenQuestion = voiceTranscriptRef.current.trim();
      const shouldSubmit = voiceShouldSubmitRef.current && Boolean(spokenQuestion);
      voiceTranscriptRef.current = "";
      voiceShouldSubmitRef.current = false;
      if (shouldSubmit) setTimeout(() => submitMessage(spokenQuestion), 0);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div
      className="tutor-drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <aside className="tutor-drawer" role="dialog" aria-modal="true" aria-labelledby="hologram-title">
        <header className="tutor-drawer-header">
          <div className={`tutor-orb ${avatarState}`} aria-hidden="true">
            <Bot size={23} />
            <span />
          </div>
          <div className="tutor-drawer-title">
            <span><Sparkles size={13} /> {copy.kicker}</span>
            <h1 id="hologram-title">{copy.title}</h1>
            <p>{listening ? copy.listening : busy ? copy.thinking : speaking ? copy.speaking : `${course.shortName} · ${user.name.split(" ")[0]}`}</p>
          </div>
          <button type="button" className="tutor-close" aria-label="Close AI Study Tutor" title="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="tutor-drawer-status-row">
          <div className={`hologram-mode ${aiConnected ? "online" : "guided"}`}>
            {aiConnected ? <Sparkles size={15} /> : <BookOpen size={15} />}
            <span><b>{aiConnected ? copy.online : copy.guided}</b><small>{course.shortName} · {course.className}</small></span>
          </div>
          <button
            type="button"
            className={`tutor-voice-toggle ${voiceReplies ? "active" : ""}`}
            aria-label={voiceReplies ? copy.soundOn : copy.soundOff}
            title={voiceReplies ? copy.soundOn : copy.soundOff}
            onClick={() => {
              setVoiceReplies((enabled) => !enabled);
              window.speechSynthesis?.cancel?.();
              setSpeaking(false);
            }}
          >
            {voiceReplies ? <Volume2 size={17} /> : <VolumeX size={17} />}
            <span>{voiceReplies ? copy.soundOn : copy.soundOff}</span>
          </button>
        </div>

        <p className="tutor-drawer-copy">{copy.copy}</p>

        <div className="hologram-chat-panel">

          <div className="hologram-learning-context" aria-label="Tutor learning context">
            <label>
              <span>{copy.subject}</span>
              <select
                value={selectedSubject}
                onChange={(event) => {
                  const subject = event.target.value;
                  const section = course.blueprint.find((item) => item.subject === subject);
                  setSelectedSubject(subject);
                  setSelectedTopic(section?.topics[0]?.[0] || "");
                }}
              >
                {course.blueprint.map((section) => <option value={section.subject} key={section.key}>{localizeSubject(section.subject)}</option>)}
              </select>
            </label>
            <label>
              <span>{copy.topic}</span>
              <select value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)}>
                {topics.map((topic) => <option value={topic} key={topic}>{topic}</option>)}
              </select>
            </label>
            <fieldset>
              <legend>{copy.learningStyle}</legend>
              <div>
                <button type="button" className={learningMode === "explain" ? "active" : ""} aria-pressed={learningMode === "explain"} onClick={() => setLearningMode("explain")}><Lightbulb size={14} />{copy.explain}</button>
                <button type="button" className={learningMode === "steps" ? "active" : ""} aria-pressed={learningMode === "steps"} onClick={() => setLearningMode("steps")}><Footprints size={14} />{copy.steps}</button>
                <button type="button" className={learningMode === "practice" ? "active" : ""} aria-pressed={learningMode === "practice"} onClick={() => setLearningMode("practice")}><Target size={14} />{copy.practice}</button>
              </div>
            </fieldset>
          </div>

          <div className="hologram-transcript" ref={transcriptRef} aria-live="polite">
            {messages.map((message, index) => (
              <article className={message.role} key={`${message.role}-${index}`}>
                <span>{message.role === "assistant" ? <Bot size={14} /> : user.name.slice(0, 1).toUpperCase()}</span>
                <div><b>{message.role === "assistant" ? copy.tutor : copy.you}</b><p>{message.content}</p></div>
              </article>
            ))}
            {busy ? (
              <article className="assistant thinking-message">
                <span><Bot size={14} /></span>
                <div><b>{copy.tutor}</b><p><i /><i /><i /></p></div>
              </article>
            ) : null}
          </div>

          {messages.length === 1 ? (
            <div className="hologram-suggestions">
              {suggestions.map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => submitMessage(suggestion)}>{suggestion}</button>
              ))}
            </div>
          ) : null}

          {notice ? <p className="hologram-notice" role="status">{notice}</p> : null}
          <form className="hologram-composer" onSubmit={(event) => { event.preventDefault(); submitMessage(); }}>
            <button
              type="button"
              className={listening ? "listening" : ""}
              aria-label={listening ? copy.stopMic : copy.mic}
              title={listening ? copy.stopMic : copy.mic}
              onClick={toggleMicrophone}
            >
              {listening ? <MicOff size={19} /> : <Mic size={19} />}
            </button>
            <input
              ref={composerRef}
              value={draft}
              maxLength={1200}
              aria-label={copy.placeholder}
              placeholder={listening ? copy.listening : copy.placeholder}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" disabled={!draft.trim() || busy} aria-label={copy.send} title={copy.send}>
              <Send size={18} />
            </button>
          </form>
          <footer>
            <span><ShieldCheck size={13} /> {copy.disclosure}</span>
            <span>{copy.privacy}</span>
          </footer>
        </div>
      </aside>
    </div>
  );
}
