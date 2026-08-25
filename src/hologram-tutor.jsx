import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  BookOpen,
  Mic,
  MicOff,
  Send,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { authRequest } from "./api-client.js";
import { useI18n } from "./i18n.jsx";
import "./hologram-tutor.css";

const COPY = {
  en: {
    kicker: "INTERACTIVE LEARNING ASSISTANT",
    title: "Meet Vijetha Holo Tutor",
    copy: "Ask by voice or text. The tutor stays focused on the selected entrance exam and explains concepts at Class VI level.",
    online: "AI connected",
    guided: "Guided syllabus mode",
    listening: "Listening…",
    thinking: "Preparing an explanation…",
    placeholder: "Ask about a topic, question, test, or study plan…",
    send: "Send message",
    mic: "Use microphone",
    stopMic: "Stop listening",
    soundOn: "Voice replies on",
    soundOff: "Voice replies off",
    disclosure: "AI tutor · Answers can make mistakes. Teachers should review important guidance.",
    intro: "Hello! I am your Vijetha Holo Tutor. Ask me about the syllabus, a difficult concept, or how to prepare for your next test.",
    suggestions: ["Explain today's syllabus", "Give me a 5-question warm-up", "Help me plan my study time"],
    microphoneUnsupported: "Voice input is not supported in this browser. You can continue by typing.",
    error: "I could not reach the tutor service. Please try again, or ask a syllabus question in guided mode.",
    you: "You",
    tutor: "Holo Tutor",
    privacy: "Do not share passwords, phone numbers, addresses, or other private information.",
  },
  hi: {
    kicker: "इंटरैक्टिव लर्निंग असिस्टेंट",
    title: "विजेता होलो ट्यूटर से मिलिए",
    copy: "आवाज़ या टेक्स्ट से पूछें। ट्यूटर चुनी गई प्रवेश परीक्षा पर केंद्रित रहता है और कक्षा VI के स्तर पर समझाता है।",
    online: "AI जुड़ा है",
    guided: "निर्देशित पाठ्यक्रम मोड",
    listening: "सुन रहा है…",
    thinking: "व्याख्या तैयार की जा रही है…",
    placeholder: "किसी विषय, प्रश्न, टेस्ट या अध्ययन योजना के बारे में पूछें…",
    send: "संदेश भेजें",
    mic: "माइक्रोफ़ोन का उपयोग करें",
    stopMic: "सुनना बंद करें",
    soundOn: "आवाज़ में उत्तर चालू",
    soundOff: "आवाज़ में उत्तर बंद",
    disclosure: "AI ट्यूटर · उत्तरों में गलती हो सकती है। महत्वपूर्ण मार्गदर्शन शिक्षक से जाँचें।",
    intro: "नमस्ते! मैं आपका विजेता होलो ट्यूटर हूँ। पाठ्यक्रम, कठिन अवधारणा या अगले टेस्ट की तैयारी के बारे में पूछिए।",
    suggestions: ["आज का पाठ्यक्रम समझाइए", "5 प्रश्नों का अभ्यास दीजिए", "मेरी पढ़ाई की योजना बनाइए"],
    microphoneUnsupported: "इस ब्राउज़र में आवाज़ इनपुट उपलब्ध नहीं है। आप टाइप करके पूछ सकते हैं।",
    error: "ट्यूटर सेवा से संपर्क नहीं हो सका। फिर प्रयास करें या निर्देशित मोड में पाठ्यक्रम का प्रश्न पूछें।",
    you: "आप",
    tutor: "होलो ट्यूटर",
    privacy: "पासवर्ड, फोन नंबर, पता या अन्य निजी जानकारी साझा न करें।",
  },
  te: {
    kicker: "ఇంటరాక్టివ్ లెర్నింగ్ అసిస్టెంట్",
    title: "విజేత హోలో ట్యూటర్‌ను కలవండి",
    copy: "వాయిస్ లేదా టెక్స్ట్ ద్వారా అడగండి. ట్యూటర్ ఎంచుకున్న ప్రవేశ పరీక్షపై దృష్టి పెట్టి, ఆరవ తరగతి స్థాయిలో వివరిస్తుంది.",
    online: "AI అనుసంధానమైంది",
    guided: "మార్గదర్శక సిలబస్ మోడ్",
    listening: "వింటోంది…",
    thinking: "వివరణ సిద్ధమవుతోంది…",
    placeholder: "అంశం, ప్రశ్న, టెస్ట్ లేదా చదువు ప్రణాళిక గురించి అడగండి…",
    send: "సందేశం పంపండి",
    mic: "మైక్రోఫోన్ ఉపయోగించండి",
    stopMic: "వినడం ఆపండి",
    soundOn: "వాయిస్ సమాధానాలు ఆన్",
    soundOff: "వాయిస్ సమాధానాలు ఆఫ్",
    disclosure: "AI ట్యూటర్ · సమాధానాల్లో పొరపాట్లు ఉండవచ్చు. ముఖ్యమైన సూచనలను ఉపాధ్యాయులు పరిశీలించాలి.",
    intro: "నమస్తే! నేను మీ విజేత హోలో ట్యూటర్‌ను. సిలబస్, కష్టమైన భావన లేదా మీ తదుపరి టెస్ట్ సిద్ధత గురించి అడగండి.",
    suggestions: ["ఈరోజు సిలబస్ వివరించండి", "5 ప్రశ్నల వార్మప్ ఇవ్వండి", "నా చదువు సమయాన్ని ప్లాన్ చేయండి"],
    microphoneUnsupported: "ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ అందుబాటులో లేదు. టైప్ చేసి కొనసాగించవచ్చు.",
    error: "ట్యూటర్ సేవను చేరుకోలేకపోయాను. మళ్లీ ప్రయత్నించండి లేదా మార్గదర్శక మోడ్‌లో సిలబస్ ప్రశ్న అడగండి.",
    you: "మీరు",
    tutor: "హోలో ట్యూటర్",
    privacy: "పాస్‌వర్డ్‌లు, ఫోన్ నంబర్లు, చిరునామాలు లేదా ఇతర వ్యక్తిగత సమాచారాన్ని పంచుకోవద్దు.",
  },
};

const SPEECH_LOCALES = { en: "en-IN", hi: "hi-IN", te: "te-IN" };

function HologramAvatar({ state }) {
  return (
    <div className={`holo-stage ${state}`} role="img" aria-label="Animated Vijetha hologram tutor">
      <div className="holo-grid" aria-hidden="true" />
      <div className="holo-beam" aria-hidden="true" />
      <div className="holo-rings" aria-hidden="true">
        <i /><i /><i />
      </div>
      <div className="holo-avatar" aria-hidden="true">
        <div className="holo-head">
          <span className="holo-eye left" />
          <span className="holo-eye right" />
          <span className="holo-smile" />
        </div>
        <div className="holo-neck" />
        <div className="holo-body">
          <span className="holo-core"><Sparkles size={22} /></span>
        </div>
      </div>
      <div className="holo-scanlines" aria-hidden="true" />
      <div className="holo-state-label">
        <span /> {state === "listening" ? "VOICE LINK" : state === "thinking" ? "PROCESSING" : "READY"}
      </div>
    </div>
  );
}

function speakReply(text, locale) {
  if (!("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LOCALES[locale] || SPEECH_LOCALES.en;
  utterance.rate = 0.96;
  utterance.pitch = 1.03;
  window.speechSynthesis.speak(utterance);
}

export function HologramTutorPage({ course, user }) {
  const { locale } = useI18n();
  const copy = COPY[locale] || COPY.en;
  const [messages, setMessages] = useState(() => [{ role: "assistant", content: copy.intro }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [aiConnected, setAiConnected] = useState(false);
  const [notice, setNotice] = useState("");
  const recognitionRef = useRef(null);
  const transcriptRef = useRef(null);

  const avatarState = listening ? "listening" : busy ? "thinking" : "ready";
  const topics = useMemo(
    () => course.blueprint.flatMap((section) => section.topics.map(([topic]) => topic)).slice(0, 8),
    [course],
  );

  useEffect(() => {
    setMessages([{ role: "assistant", content: copy.intro }]);
    setDraft("");
    setNotice("");
    setAiConnected(false);
  }, [copy.intro, course.key]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [busy, messages]);

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel?.();
  }, []);

  const submitMessage = async (value = draft) => {
    const question = String(value || "").trim();
    if (!question || busy) return;
    const nextMessages = [...messages, { role: "user", content: question }];
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
          history: messages.slice(-6),
        }),
      });
      const reply = String(payload.reply || copy.error);
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
      setAiConnected(Boolean(payload.aiConnected));
      if (voiceReplies) speakReply(reply, locale);
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
    recognition.onstart = () => { setListening(true); setNotice(""); };
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      setDraft(text);
    };
    recognition.onerror = () => setNotice(copy.microphoneUnsupported);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <section className="hologram-page" aria-labelledby="hologram-title">
      <header className="hologram-heading">
        <div>
          <span><Sparkles size={15} /> {copy.kicker}</span>
          <h1 id="hologram-title">{copy.title}</h1>
          <p>{copy.copy}</p>
        </div>
        <div className={`hologram-mode ${aiConnected ? "online" : "guided"}`}>
          {aiConnected ? <Sparkles size={16} /> : <BookOpen size={16} />}
          <span><b>{aiConnected ? copy.online : copy.guided}</b><small>{course.shortName} · {course.className}</small></span>
        </div>
      </header>

      <div className="hologram-layout">
        <aside className="hologram-visual-panel">
          <HologramAvatar state={avatarState} />
          <div className="hologram-identity">
            <span>VIJETHA LEARNING SYSTEM</span>
            <h2>Holo Tutor</h2>
            <p>{listening ? copy.listening : busy ? copy.thinking : `${course.shortName} · ${user.name.split(" ")[0]}`}</p>
          </div>
          <div className="hologram-topic-cloud">
            {topics.map((topic) => <span key={topic}>{topic}</span>)}
          </div>
        </aside>

        <div className="hologram-chat-panel">
          <div className="hologram-chat-topbar">
            <div><Bot size={18} /><span><b>{copy.tutor}</b><small>{course.name}</small></span></div>
            <button
              type="button"
              className={voiceReplies ? "active" : ""}
              aria-label={voiceReplies ? copy.soundOn : copy.soundOff}
              title={voiceReplies ? copy.soundOn : copy.soundOff}
              onClick={() => {
                setVoiceReplies((enabled) => !enabled);
                window.speechSynthesis?.cancel?.();
              }}
            >
              {voiceReplies ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
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
              {copy.suggestions.map((suggestion) => (
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
      </div>
    </section>
  );
}
