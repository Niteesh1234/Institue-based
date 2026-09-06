import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  ChevronRight,
  FileImage,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  MessageCircle,
  PlayCircle,
  RotateCcw,
  ScanText,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { authRequest } from "./api-client.js";
import "./test-imports.css";

const MAX_FILE_BYTES = 3 * 1024 * 1024;

function fileIcon(mimeType, size = 19) {
  if (mimeType === "text/csv" || mimeType?.includes("spreadsheetml")) return <FileSpreadsheet size={size} />;
  if (mimeType?.startsWith("image/")) return <FileImage size={size} />;
  return <FileText size={size} />;
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.readAsDataURL(file);
  });
}

function statusLabel(value) {
  return value === "ready" ? "Ready" : value === "review" ? "Needs review" : "Extracted";
}

async function compactTutorImage(image) {
  if (!image?.dataBase64 || !image.mimeType?.startsWith("image/")) return null;
  if (image.dataBase64.length <= 700000) return { mimeType: image.mimeType, dataBase64: image.dataBase64 };
  return new Promise((resolve) => {
    const source = new Image();
    source.onload = () => {
      const render = (maxWidth, quality) => {
        const scale = Math.min(1, maxWidth / source.naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
        canvas.getContext("2d", { alpha: false }).drawImage(source, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/webp", quality);
        return { mimeType: "image/webp", dataBase64: dataUrl.split(",")[1] || "" };
      };
      const first = render(1000, 0.76);
      const result = first.dataBase64.length <= 700000 ? first : render(650, 0.62);
      resolve(result.dataBase64.length <= 700000 ? result : null);
    };
    source.onerror = () => resolve(null);
    source.src = `data:${image.mimeType};base64,${image.dataBase64}`;
  });
}

function QuestionTutor({ question, course, locale, studentMode, submitted, selectedAnswer }) {
  const displayNumber = question.sourceNumber || question.number;
  const hintOnly = studentMode && !submitted;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [aiConnected, setAiConnected] = useState(false);
  const [tutorMode, setTutorMode] = useState("ready");
  const diagramRef = useRef(undefined);
  const transcriptRef = useRef(null);

  useEffect(() => {
    setMessages([]);
    setDraft("");
    setNotice("");
    setTutorMode("ready");
    diagramRef.current = undefined;
  }, [question.number, question.stem, hintOnly]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [busy, messages]);

  const suggestions = hintOnly
    ? ["Give me one hint", "Explain the concept", "What should I notice in the diagram?"]
    : ["Explain the answer step by step", "Why are the other options wrong?", "Give me a similar practice question"];

  const askTutor = async (value = draft) => {
    const message = String(value || "").trim();
    if (!message || busy) return;
    const nextMessages = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    setDraft("");
    setNotice("");
    setBusy(true);
    try {
      if (diagramRef.current === undefined) diagramRef.current = question.hasVisual ? await compactTutorImage(question.questionImage) : null;
      const payload = await authRequest("/api/ai-tutor", {
        method: "POST",
        body: JSON.stringify({
          message,
          locale,
          course: course.key,
          history: messages.slice(-8),
          questionContext: {
            number: String(displayNumber),
            subject: question.subject || course.shortName,
            stem: question.stem,
            options: question.options,
            selectedOption: selectedAnswer,
            answer: hintOnly ? "" : question.answer,
            hintOnly,
            hasVisual: question.hasVisual,
            image: diagramRef.current,
          },
        }),
      });
      setMessages((current) => [...current, { role: "assistant", content: String(payload.reply || "The tutor did not return an explanation.") }]);
      setAiConnected(Boolean(payload.aiConnected));
      setTutorMode(payload.mode || "guided");
      if (!payload.aiConnected) setNotice("Guided explanation shown. Full AI tutoring activates when the institute connects its AI provider.");
    } catch (requestError) {
      setMessages((current) => [...current, { role: "assistant", content: "I could not prepare this explanation. Please try again." }]);
      setNotice(requestError.message || "The question tutor is temporarily unavailable.");
      setAiConnected(false);
      setTutorMode("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`question-tutor${open ? " open" : ""}`}>
      <button type="button" className="question-tutor-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span><MessageCircle size={16} /><b>Ask AI Tutor</b><small>{hintOnly ? "Hints only during the test" : "Detailed question explanation"}</small></span>
        <Sparkles size={16} />
      </button>
      {open ? (
        <div className="question-tutor-body">
          <div className="question-tutor-status"><Bot size={15} /><span><b>Question {displayNumber} Tutor</b><small>{aiConnected ? "AI connected" : tutorMode === "guided" ? "Guided fallback mode" : hintOnly ? "Answer-safe hint mode" : "Ready to explain"}</small></span></div>
          <div className="question-tutor-transcript" ref={transcriptRef} aria-live="polite">
            {!messages.length ? <p className="question-tutor-intro">{hintOnly ? "Ask what to try next. I will guide you without revealing the final option before submission." : "Ask about the method, correct answer, diagram, or why an option is incorrect."}</p> : null}
            {messages.map((item, index) => (
              <article className={item.role} key={`${item.role}-${index}`}><b>{item.role === "assistant" ? "AI Tutor" : "Student"}</b><p>{item.content}</p></article>
            ))}
            {busy ? <article className="assistant thinking"><b>AI Tutor</b><p>Reading the question and preparing a clear explanation…</p></article> : null}
          </div>
          {!messages.length ? <div className="question-tutor-suggestions">{suggestions.map((suggestion) => <button type="button" onClick={() => askTutor(suggestion)} key={suggestion}>{suggestion}</button>)}</div> : null}
          {notice ? <p className="question-tutor-notice" role="status">{notice}</p> : null}
          <form className="question-tutor-composer" onSubmit={(event) => { event.preventDefault(); askTutor(); }}>
            <input aria-label={`Ask the AI tutor about question ${displayNumber}`} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1200} placeholder={hintOnly ? "Ask for a hint or concept explanation…" : "Ask for a detailed explanation…"} />
            <button type="submit" aria-label="Send question to AI tutor" disabled={!draft.trim() || busy}><Send size={16} /></button>
          </form>
          <footer>AI explanations can make mistakes. Check important answers with your teacher.</footer>
        </div>
      ) : null}
    </section>
  );
}

function QuestionPreview({ question, course, locale = "en", sourcePages = [], studentMode = false, selectedAnswer = "", submitted = false, onSelect }) {
  const displayNumber = question.sourceNumber || question.number;
  const sourcePage = sourcePages.find((page) => page.pageNumber === question.sourcePage);
  const image = question.questionImage;
  const optionClass = (option) => {
    if (!studentMode) return question.answer === option.id ? "answer" : "";
    if (!submitted) return selectedAnswer === option.id ? "selected" : "";
    if (question.answer === option.id) return "answer";
    if (selectedAnswer === option.id && question.answer && selectedAnswer !== question.answer) return "incorrect";
    return selectedAnswer === option.id ? "selected" : "";
  };
  return (
    <article className={`import-question-card${studentMode ? " student-mode" : ""}`}>
      <header>
        <span>QUESTION {displayNumber}{question.sourcePage ? ` · PAGE ${question.sourcePage}` : ""}</span>
        <div>
          <small>{question.extractionConfidence || "Review"} confidence</small>
          {!studentMode || submitted ? (question.answer ? <b>Answer {question.answer}</b> : <b className="needs-review">Answer key unavailable</b>) : <b className="student-answer-hidden">Answer hidden</b>}
        </div>
      </header>
      <h3>{question.stem}</h3>
      {image ? (
        question.hasVisual ? (
          <figure className="import-question-figure visual">
            <img src={`data:${image.mimeType};base64,${image.dataBase64}`} width={image.width} height={image.height} loading="lazy" alt={`Extracted diagram and visual options for question ${displayNumber}`} />
            <figcaption>Original diagram and graphical choices from page {image.pageNumber}{image.cropConfidence ? ` · ${image.cropConfidence} crop` : ""}</figcaption>
          </figure>
        ) : (
          <details className="import-question-crop">
            <summary><FileImage size={14} />Check exact question crop</summary>
            <img src={`data:${image.mimeType};base64,${image.dataBase64}`} width={image.width} height={image.height} loading="lazy" alt={`Original cropped question ${displayNumber}`} />
          </details>
        )
      ) : null}
      {question.options?.length ? (
        <div className={`import-options${studentMode ? " selectable" : ""}`} role={studentMode ? "radiogroup" : undefined} aria-label={studentMode ? `Answer question ${displayNumber}` : undefined}>
          {question.options.map((option) => (
            studentMode ? (
              <button type="button" role="radio" aria-checked={selectedAnswer === option.id} className={optionClass(option)} key={`${question.number}-${option.id}`} disabled={submitted} onClick={() => onSelect?.(option.id)}>
                <b>{option.id}</b><span>{option.isVisual ? `Choose visual option ${option.id} shown in the diagram` : option.label}</span>
              </button>
            ) : (
              <span className={optionClass(option)} key={`${question.number}-${option.id}`}>
                <b>{option.id}</b>{option.isVisual ? `Visual option ${option.id} — shown in the extracted figure` : option.label}
              </span>
            )
          ))}
        </div>
      ) : <p className="import-question-warning">No options were detected. Review the source formatting.</p>}
      {sourcePage ? (
        <details className="import-question-source">
          <summary><FileImage size={14} />View original page {sourcePage.pageNumber} with diagrams</summary>
          <img
            src={`data:${sourcePage.mimeType};base64,${sourcePage.dataBase64}`}
            width={sourcePage.width}
            height={sourcePage.height}
            loading="lazy"
            alt={`Original uploaded source page ${sourcePage.pageNumber} for question ${displayNumber}`}
          />
        </details>
      ) : null}
      <QuestionTutor question={question} course={course} locale={locale} studentMode={studentMode} submitted={submitted} selectedAnswer={selectedAnswer} />
    </article>
  );
}

export function TestImportsPage({ course, user, demo = false, canUpload = false, canManage = false }) {
  const fileRef = useRef(null);
  const [imports, setImports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(demo ? "ready" : "loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [ocrLanguage, setOcrLanguage] = useState("eng");
  const [extractionMode, setExtractionMode] = useState("accurate");
  const [search, setSearch] = useState("");
  const [studentMode, setStudentMode] = useState(false);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [studentSubmitted, setStudentSubmitted] = useState(false);

  useEffect(() => {
    if (demo) {
      setImports([]);
      setSelected(null);
      setStatus("ready");
      return undefined;
    }
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    authRequest(`/api/test-imports?course=${encodeURIComponent(course.key)}`, { method: "GET", signal: controller.signal })
      .then((payload) => {
        const rows = payload.imports || [];
        setImports(rows);
        setSelected(null);
        setStatus("ready");
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        setStatus("error");
        setError(requestError.message || "Imported tests could not be loaded.");
      });
    return () => controller.abort();
  }, [course.key, demo]);

  const filteredImports = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return imports;
    return imports.filter((item) => `${item.title} ${item.fileName} ${item.createdByName}`.toLowerCase().includes(query));
  }, [imports, search]);

  const totals = useMemo(() => ({
    questions: imports.reduce((sum, item) => sum + Number(item.questionCount || 0), 0),
    review: imports.filter((item) => item.status === "review").length,
  }), [imports]);

  const studentResult = useMemo(() => {
    const questions = selected?.questions || [];
    const answered = questions.filter((question) => studentAnswers[question.number]).length;
    const scorable = questions.filter((question) => question.answer).length;
    const correct = questions.filter((question) => question.answer && studentAnswers[question.number] === question.answer).length;
    return { answered, scorable, correct, total: questions.length };
  }, [selected, studentAnswers]);

  useEffect(() => {
    setStudentMode(false);
    setStudentAnswers({});
    setStudentSubmitted(false);
  }, [selected?.id]);

  const openImport = async (item) => {
    if (item.questions) {
      setSelected(item);
      return;
    }
    setDetailBusy(true);
    setError("");
    try {
      const payload = await authRequest(`/api/test-imports?course=${encodeURIComponent(course.key)}&id=${encodeURIComponent(item.id)}`, { method: "GET" });
      const detailed = payload.imports?.[0];
      setSelected(detailed || null);
      if (detailed) setImports((current) => current.map((row) => row.id === detailed.id ? { ...row, ...detailed } : row));
    } catch (requestError) {
      setError(requestError.message || "The extracted questions could not be loaded.");
    } finally {
      setDetailBusy(false);
    }
  };

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    setError("");
    if (file.size > MAX_FILE_BYTES) {
      setError("Choose a file no larger than 3 MB.");
      return;
    }
    setBusy(true);
    try {
      const payload = await authRequest(demo ? "/api/test-imports?action=preview" : "/api/test-imports", {
        method: "POST",
        body: JSON.stringify({
          course: course.key,
          title: title.trim() || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
          ocrLanguage,
          extractionMode,
          file: {
            fileName: file.name,
            mimeType: file.type,
            dataBase64: await fileAsBase64(file),
          },
        }),
      });
      const imported = payload.testImport;
      setImports((current) => [imported, ...current.filter((item) => item.id !== imported.id)]);
      setSelected(imported);
      setTitle("");
      setMessage(`${imported.questionCount} question${imported.questionCount === 1 ? "" : "s"} extracted from ${file.name}.${imported.reprocessed ? " The previous incomplete extraction was updated." : ""}${demo ? " This demo preview is not saved." : ""}`);
    } catch (requestError) {
      setError(requestError.message || "The test paper could not be extracted.");
    } finally {
      setBusy(false);
    }
  };

  const deleteImport = async () => {
    if (!selected || demo || !canManage) return;
    if (!window.confirm(`Delete “${selected.title}” and its extracted questions?`)) return;
    setBusy(true);
    setError("");
    try {
      await authRequest(`/api/test-imports?id=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
      setImports((current) => current.filter((item) => item.id !== selected.id));
      setSelected(null);
      setMessage("The imported test was deleted.");
    } catch (requestError) {
      setError(requestError.message || "The imported test could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="test-import-page">
      <section className="page-heading import-page-heading">
        <div>
          <p className="section-kicker">QUESTION EXTRACTION</p>
          <h1>Test Import Studio</h1>
          <p>Convert examiner or principal PDFs, scanned images, and CSV files into a reviewable question interface.</p>
        </div>
        <div className="import-heading-badge"><ScanText size={21} /><span>Separate collection</span><strong>test_imports_Vijetha</strong></div>
      </section>

      <section className="import-metrics" aria-label="Test import summary">
        <article><FileText /><span>Imported tests</span><strong>{imports.length}</strong></article>
        <article><ScanText /><span>Extracted questions</span><strong>{totals.questions}</strong></article>
        <article><ShieldCheck /><span>Needs review</span><strong>{totals.review}</strong></article>
      </section>

      {message ? <div className="import-notice success"><Check size={17} />{message}</div> : null}
      {error ? <div className="import-notice error"><AlertCircle size={17} />{error}</div> : null}

      <section className="import-upload-panel panel">
        <div className="import-upload-copy">
          <span className="import-upload-icon"><UploadCloud size={25} /></span>
          <div><h2>Upload a test paper</h2><p>PDF text and diagrams are captured by question; scanned pages use OCR. Excel/CSV rows and embedded worksheet images become structured questions.</p></div>
        </div>
        <div className="import-upload-fields">
          <label><span>Test title <small>optional</small></span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder={`${course.shortName} weekly test`} /></label>
          <label><span>Document language</span><select value={ocrLanguage} onChange={(event) => setOcrLanguage(event.target.value)}><option value="eng">English</option><option value="hin">Hindi</option><option value="tel">Telugu</option></select></label>
          <label><span>Extraction mode</span><select value={extractionMode} onChange={(event) => setExtractionMode(event.target.value)}><option value="accurate">Maximum accuracy</option><option value="fast">Quick text scan</option></select></label>
          <button type="button" className="button primary import-file-button" disabled={busy || !canUpload} onClick={() => fileRef.current?.click()}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <UploadCloud size={17} />}{busy ? "Extracting…" : "Choose PDF, Excel, image, or CSV"}
          </button>
          <input ref={fileRef} className="visually-hidden" type="file" accept=".pdf,.xlsx,.csv,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/jpeg,image/png,image/webp" onChange={uploadFile} disabled={busy || !canUpload} />
        </div>
        <footer><span>Maximum 3 MB · up to 500 questions</span><span>Maximum accuracy checks every PDF page</span><span>{demo ? "Live extraction · not saved" : `${user.name} · ${course.shortName}`}</span></footer>
        <div className="import-samples">
          <b>Try a sample:</b>
          <a href="/test-import-samples/sample-test-paper.pdf" download>Text PDF</a>
          <a href="/test-import-samples/sample-scanned-test-paper.pdf" download>Scanned PDF</a>
          <a href="/test-import-samples/sample-complex-test-paper.pdf" download>Complex 8-question PDF</a>
          <a href="/test-import-samples/sample-visual-question.pdf" download>Visual diagram PDF</a>
          <a href="/test-import-samples/sample-test-paper.png" download>PNG image</a>
          <a href="/test-import-samples/sample-test-paper.csv" download>CSV</a>
          <a href="/test-import-samples/sample-visual-questions.xlsx" download>Excel with images</a>
        </div>
      </section>

      <section className="import-workspace">
        <aside className="panel import-library">
          <div className="panel-heading"><div><p className="section-kicker">IMPORT LIBRARY</p><h2>Extracted tests</h2></div><span>{filteredImports.length}</span></div>
          <label className="import-search"><Search size={15} /><input aria-label="Search imported tests" placeholder="Search test or file" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <div className="import-list">
            {status === "loading" ? <div className="import-empty"><LoaderCircle className="spin" /><span>Loading imports…</span></div> : null}
            {status === "error" ? <div className="import-empty"><AlertCircle /><strong>Collection unavailable</strong><span>{error}</span></div> : null}
            {status === "ready" && !filteredImports.length ? <div className="import-empty"><ScanText /><strong>No extracted tests yet</strong><span>Upload the first paper above.</span></div> : null}
            {filteredImports.map((item) => (
              <button type="button" className={selected?.id === item.id ? "active" : ""} key={item.id} onClick={() => openImport(item)}>
                <span className="import-file-kind">{fileIcon(item.mimeType)}</span>
                <div><strong>{item.title}</strong><small>{item.questionCount} questions · {item.extractionMethod}</small><em>{item.fileName}</em></div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </aside>

        <div className="panel import-preview">
          {detailBusy ? <div className="import-empty"><LoaderCircle className="spin" /><span>Loading extracted questions…</span></div> : null}
          {!detailBusy && !selected ? <div className="import-empty"><ScanText size={34} /><strong>Select an imported test</strong><span>Its extracted questions and source text will appear here.</span></div> : null}
          {!detailBusy && selected ? (
            <>
              <header className="import-preview-header">
                <div className="import-source-icon">{fileIcon(selected.mimeType, 22)}</div>
                <div><p>{selected.fileName} · {formatBytes(selected.size)}</p><h2>{selected.title}</h2><span>{selected.questionCount} questions · {selected.extractionMethod}{selected.totalPages ? ` · ${selected.totalPages} page${selected.totalPages === 1 ? "" : "s"}` : ""}</span></div>
                <b className={`import-status ${selected.status}`}>{statusLabel(selected.status)}</b>
                {canManage && !demo ? <button type="button" className="icon-button import-delete" aria-label="Delete imported test" onClick={deleteImport} disabled={busy}><Trash2 size={17} /></button> : null}
              </header>
              <div className="import-view-switch">
                <div><strong>{studentMode ? "Student test preview" : "Extraction review"}</strong><span>{studentMode ? "Answers stay hidden while the student selects options." : "Check extracted text, option labels, and original diagram crops."}</span></div>
                <button type="button" className="button secondary" onClick={() => { setStudentMode((value) => !value); setStudentAnswers({}); setStudentSubmitted(false); }}>
                  {studentMode ? <RotateCcw size={15} /> : <PlayCircle size={15} />}{studentMode ? "Back to review" : "Try as student"}
                </button>
              </div>
              {selected.warnings?.length ? <div className="import-warning-list">{selected.warnings.map((warning) => <span key={warning}><AlertCircle size={14} />{warning}</span>)}</div> : null}
              <div className="import-extraction-audit">
                <span><b>{selected.questionCount}</b> questions found</span>
                <span><b>{selected.questions?.filter((question) => question.options?.length >= 2).length || 0}</b> with options</span>
                <span><b>{selected.sourcePages?.length || 0}</b> source pages retained</span>
              </div>
              <div className="import-question-list">{selected.questions?.map((question, index) => <QuestionPreview question={question} course={course} locale={(selected.ocrLanguage || ocrLanguage) === "hin" ? "hi" : (selected.ocrLanguage || ocrLanguage) === "tel" ? "te" : "en"} sourcePages={selected.sourcePages} studentMode={studentMode} selectedAnswer={studentAnswers[question.number] || ""} submitted={studentSubmitted} onSelect={(answer) => setStudentAnswers((current) => ({ ...current, [question.number]: answer }))} key={`${selected.id}-${question.sourcePage || 0}-${question.sourceNumber || question.number}-${index}`} />)}</div>
              {studentMode ? (
                <div className="import-test-submit">
                  <div><strong>{studentResult.answered} of {studentResult.total} answered</strong><span>{studentSubmitted ? (studentResult.scorable ? `${studentResult.correct} of ${studentResult.scorable} answer-key questions correct` : "Responses submitted; this paper has no answer key for automatic scoring.") : "Review selections before submitting the preview test."}</span></div>
                  <button type="button" className="button primary" disabled={!studentResult.answered || studentSubmitted} onClick={() => setStudentSubmitted(true)}><Check size={16} />{studentSubmitted ? "Submitted" : "Submit test"}</button>
                </div>
              ) : null}
              <details className="import-raw-text"><summary>View raw extracted text</summary><pre>{selected.rawText}</pre></details>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
