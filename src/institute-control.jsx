import { useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Check,
  ClipboardCheck,
  FileUp,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useI18n } from "./i18n.jsx";

const STORAGE_KEY = "vijetha-institute-control-v1";
const LEVELS = ["Easy", "Medium", "Challenging"];

export const DEFAULT_INSTITUTE_CONTROL = {
  policies: {
    maxBatches: 12,
    teacherCanCreateExams: true,
    teacherCanUploadQuestions: true,
    teacherCanPrint: false,
    studentCanPrint: false,
    feedbackMode: "after-submit",
  },
  teachers: [
    { id: "teacher-priya", name: "Priya Sharma", email: "priya@vijetha.in", status: "approved" },
    { id: "teacher-ravi", name: "Ravi Verma", email: "ravi@vijetha.in", status: "approved" },
    { id: "teacher-anita", name: "Anita Rao", email: "anita@vijetha.in", status: "approved" },
  ],
  exams: [],
  questionUploads: [],
  prepaidBalance: 0,
  ledger: [],
  audit: [],
};

function initialControlState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_INSTITUTE_CONTROL;
    const parsed = JSON.parse(saved);
    return {
      ...DEFAULT_INSTITUTE_CONTROL,
      ...parsed,
      policies: { ...DEFAULT_INSTITUTE_CONTROL.policies, ...(parsed.policies || {}) },
    };
  } catch {
    return DEFAULT_INSTITUTE_CONTROL;
  }
}

export function useInstituteControlState() {
  const [control, setControlState] = useState(initialControlState);
  const setControl = (next) => {
    setControlState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      return value;
    });
  };
  return [control, setControl];
}

export function isPrincipalRole(user) {
  return ["administrator", "principal"].includes(String(user?.role || "").toLowerCase());
}

export function canPrintPapers(user, control) {
  if (isPrincipalRole(user)) return true;
  if (user?.role === "teacher") return Boolean(control?.policies?.teacherCanPrint);
  return Boolean(control?.policies?.studentCanPrint);
}

function eventId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStem(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\u0900-\u097f\u0c00-\u0c7f]+/g, " ").trim();
}

function parseCsvLine(line) {
  const output = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      output.push(value.trim());
      value = "";
    } else value += char;
  }
  output.push(value.trim());
  return output;
}

function parseQuestionFile(name, content) {
  let questions;
  if (name.toLowerCase().endsWith(".json")) {
    const payload = JSON.parse(content);
    questions = Array.isArray(payload) ? payload : payload.questions;
  } else {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new Error("The CSV must include a header and at least one question.");
    const headers = parseCsvLine(lines[0]).map((item) => item.toLowerCase().replace(/\s+/g, ""));
    questions = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
      return {
        stem: row.question || row.stem,
        options: [row.optiona, row.optionb, row.optionc, row.optiond],
        answer: row.answer,
        difficulty: row.difficulty,
      };
    });
  }
  if (!Array.isArray(questions) || !questions.length) throw new Error("No questions were found in this file.");
  const seen = new Set();
  const normalized = questions.map((question, index) => {
    const stem = String(question.stem || question.question || question.text || "").trim();
    const options = Array.isArray(question.options)
      ? question.options.map((item) => String(item?.text || item?.label || item || "").trim())
      : [question.optionA, question.optionB, question.optionC, question.optionD].map((item) => String(item || "").trim());
    const answer = String(question.answer || question.correctOption || "").trim().toUpperCase();
    const difficulty = `${String(question.difficulty || "Medium").slice(0, 1).toUpperCase()}${String(question.difficulty || "Medium").slice(1).toLowerCase()}`;
    const key = normalizeStem(stem);
    if (stem.length < 8) throw new Error(`Question ${index + 1} is too short.`);
    if (seen.has(key)) throw new Error(`Question ${index + 1} duplicates another question in this file.`);
    if (options.length !== 4 || options.some((option) => !option)) throw new Error(`Question ${index + 1} must contain four options.`);
    if (new Set(options.map(normalizeStem)).size !== 4) throw new Error(`Question ${index + 1} contains duplicate options.`);
    if (!["A", "B", "C", "D"].includes(answer)) throw new Error(`Question ${index + 1} must use answer A, B, C, or D.`);
    if (!LEVELS.includes(difficulty)) throw new Error(`Question ${index + 1} has an invalid difficulty.`);
    seen.add(key);
    return { id: eventId("custom-question"), stem, options, answer, difficulty };
  });
  return normalized;
}

const COPY = {
  en: {
    kicker: "PRINCIPAL ADMIN CONTROL",
    title: "Institute control centre",
    copy: "Approve access, control exam delivery, manage prepaid credits, and keep every batch under principal oversight.",
    access: "Access & exam policy",
    exams: "Batch exams",
    upload: "Teacher question uploads",
    prepaid: "Prepaid credits",
  },
  hi: {
    kicker: "प्रधानाचार्य प्रशासन नियंत्रण",
    title: "संस्थान नियंत्रण केंद्र",
    copy: "अनुमति स्वीकृत करें, परीक्षा संचालन नियंत्रित करें, प्रीपेड क्रेडिट संभालें और हर बैच को प्रधानाचार्य की निगरानी में रखें।",
    access: "प्रवेश और परीक्षा नीति",
    exams: "बैच परीक्षाएँ",
    upload: "शिक्षक प्रश्न अपलोड",
    prepaid: "प्रीपेड क्रेडिट",
  },
  te: {
    kicker: "ప్రిన్సిపల్ అడ్మిన్ నియంత్రణ",
    title: "సంస్థ నియంత్రణ కేంద్రం",
    copy: "యాక్సెస్‌ను ఆమోదించండి, పరీక్ష నిర్వహణను నియంత్రించండి, ప్రీపెయిడ్ క్రెడిట్లను నిర్వహించి ప్రతి బ్యాచ్‌ను ప్రిన్సిపల్ పర్యవేక్షణలో ఉంచండి.",
    access: "యాక్సెస్ & పరీక్ష విధానం",
    exams: "బ్యాచ్ పరీక్షలు",
    upload: "ఉపాధ్యాయ ప్రశ్నల అప్లోడ్లు",
    prepaid: "ప్రీపెయిడ్ క్రెడిట్లు",
  },
};

function PolicySwitch({ checked, label, detail, onChange }) {
  return (
    <label className="control-policy-row">
      <span><strong>{label}</strong><small>{detail}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function PrincipalControlPage({ user, course, batches, students, control, setControl, onOpenPdfUpload, onOpenBatchExams }) {
  const { locale } = useI18n();
  const copy = COPY[locale] || COPY.en;
  const principal = isPrincipalRole(user);
  const [activeTab, setActiveTab] = useState("policy");
  const [creditAmount, setCreditAmount] = useState(1000);
  const [message, setMessage] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);

  const existingQuestionKeys = useMemo(
    () => new Set(control.questionUploads.flatMap((upload) => upload.questions || []).map((question) => normalizeStem(question.stem))),
    [control.questionUploads],
  );

  const commit = (mutate, auditMessage) => setControl((current) => {
    const next = mutate(current);
    return {
      ...next,
      audit: [{ id: eventId("audit"), message: auditMessage, by: user.name, at: new Date().toISOString() }, ...(next.audit || [])].slice(0, 50),
    };
  });
  const setPolicy = (key, value) => commit(
    (current) => ({ ...current, policies: { ...current.policies, [key]: value } }),
    `${key} changed to ${String(value)}`,
  );
  const addCredit = (event) => {
    event.preventDefault();
    const amount = Math.round(Number(creditAmount));
    if (!principal || !Number.isFinite(amount) || amount <= 0) return;
    commit((current) => ({
      ...current,
      prepaidBalance: current.prepaidBalance + amount,
      ledger: [{ id: eventId("credit"), type: "credit", amount, note: "Principal prepaid top-up", at: new Date().toISOString() }, ...current.ledger],
    }), `Added ₹${amount.toLocaleString("en-IN")} prepaid credit`);
    setMessage("Prepaid credit recorded. Connect a payment gateway before accepting online money.");
  };
  const uploadQuestions = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadBusy(true);
    setMessage("");
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Question files must be 2 MB or smaller.");
      const questions = parseQuestionFile(file.name, await file.text());
      if (questions.length > 500) throw new Error("Upload no more than 500 questions at a time.");
      const duplicate = questions.find((question) => existingQuestionKeys.has(normalizeStem(question.stem)));
      if (duplicate) throw new Error(`“${duplicate.stem.slice(0, 55)}” already exists in an earlier upload.`);
      const levelCounts = Object.fromEntries(LEVELS.map((level) => [level, questions.filter((question) => question.difficulty === level).length]));
      const upload = { id: eventId("upload"), name: file.name, teacher: user.name, questions, levelCounts, status: principal ? "approved" : "pending", uploadedAt: new Date().toISOString() };
      commit((current) => ({ ...current, questionUploads: [upload, ...current.questionUploads] }), `Validated ${questions.length} questions from ${file.name}`);
      setMessage(`${questions.length} questions passed structure, answer, option, and duplicate checks.`);
    } catch (error) {
      setMessage(error.message || "This question file could not be validated.");
    } finally {
      setUploadBusy(false);
    }
  };

  if (!principal && user.role !== "teacher") return null;
  return (
    <>
      <section className="page-heading control-heading">
        <div>
          <div className="eyebrow"><span className="pulse" /> {copy.kicker}</div>
          <h1>{copy.title}</h1>
          <p>{copy.copy}</p>
        </div>
        <div className="control-balance"><Banknote size={18} /><span>Prepaid balance</span><strong>₹{control.prepaidBalance.toLocaleString("en-IN")}</strong></div>
      </section>
      <section className="control-summary-grid">
        <article><ShieldCheck /><span>Principal control</span><strong>{principal ? "Active" : "Teacher access"}</strong></article>
        <article><Users /><span>Batches</span><strong>{batches.length} / {control.policies.maxBatches}</strong></article>
        <article><ClipboardCheck /><span>Batch paper rule</span><strong>20 / 20 / 20</strong></article>
        <article><FileUp /><span>Validated uploads</span><strong>{control.questionUploads.reduce((sum, item) => sum + item.questions.length, 0)}</strong></article>
      </section>
      <div className="control-tabs" role="tablist">
        {[["policy", copy.access], ["exams", copy.exams], ["uploads", copy.upload], ["payments", copy.prepaid]].map(([id, label]) => (
          <button type="button" key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>
      {message ? <div className="control-notice" role="status"><Check size={16} />{message}</div> : null}

      {activeTab === "policy" ? (
        <div className="control-two-column">
          <section className="panel control-panel">
            <div className="panel-heading"><div><p className="section-kicker">ROLE-BASED ACCESS</p><h2>Exam and document permissions</h2></div><LockKeyhole size={20} /></div>
            <PolicySwitch checked={control.policies.teacherCanCreateExams} label="Teachers can create batch exams" detail="Every exam remains visible to the principal." onChange={(value) => setPolicy("teacherCanCreateExams", value)} />
            <PolicySwitch checked={control.policies.teacherCanUploadQuestions} label="Teachers can upload questions" detail="Uploads are validated and can require principal approval." onChange={(value) => setPolicy("teacherCanUploadQuestions", value)} />
            <PolicySwitch checked={control.policies.teacherCanPrint} label="Teachers can print or download" detail="Off by default; principal always retains access." onChange={(value) => setPolicy("teacherCanPrint", value)} />
            <PolicySwitch checked={control.policies.studentCanPrint} label="Students can print or download" detail="Off by default for protected exam delivery." onChange={(value) => setPolicy("studentCanPrint", value)} />
            <div className="control-rule"><ShieldCheck size={18} /><span><strong>Answer feedback: after final submission</strong><small>Students can change a selected answer before submission, but cannot see whether it is correct.</small></span></div>
          </section>
          <section className="panel control-panel">
            <div className="panel-heading"><div><p className="section-kicker">STAFF ACCESS</p><h2>Approved teachers</h2></div><Users size={20} /></div>
            {control.teachers.map((teacher) => (
              <div className="control-person" key={teacher.id}><span>{teacher.name.slice(0, 2).toUpperCase()}</span><div><strong>{teacher.name}</strong><small>{teacher.email}</small></div><button type="button" disabled={!principal} onClick={() => commit((current) => ({ ...current, teachers: current.teachers.map((item) => item.id === teacher.id ? { ...item, status: item.status === "approved" ? "suspended" : "approved" } : item) }), `${teacher.name} access updated`)}>{teacher.status}</button></div>
            ))}
          </section>
        </div>
      ) : null}

      {activeTab === "exams" ? (
        <div className="control-two-column">
          <section className="panel control-panel control-form">
            <div className="panel-heading"><div><p className="section-kicker">DEDICATED DELIVERY MODULE</p><h2>Generate a real batch exam</h2></div><ClipboardCheck size={20} /></div>
            <div className="exam-mix"><span><b>20</b> Easy</span><span><b>20</b> Medium</span><span><b>20</b> Challenging</span></div>
            <p>The separate Batch Exams module selects all 60 questions from the validated bank, assigns the selected batch, and checks difficulty, subject balance, and duplicates before saving.</p>
            <button className="button primary" type="button" onClick={onOpenBatchExams} disabled={!onOpenBatchExams || (!principal && !control.policies.teacherCanCreateExams)}><ClipboardCheck size={16} /> Open Batch Exams</button>
          </section>
          <section className="panel control-panel">
            <div className="panel-heading"><div><p className="section-kicker">MANDATORY VALIDATION</p><h2>Every generated paper checks</h2></div><ShieldCheck size={20} /></div>
            <div className="control-rule"><Check size={18} /><span><strong>Exactly 20 / 20 / 20</strong><small>No difficulty group can be short or exceed its allocation.</small></span></div>
            <div className="control-rule"><Check size={18} /><span><strong>Official subject proportions</strong><small>The 60-question paper preserves the selected course’s syllabus balance.</small></span></div>
            <div className="control-rule"><Check size={18} /><span><strong>Zero question reuse</strong><small>Question IDs and prompt fingerprints are checked against earlier batch papers.</small></span></div>
            <div className="control-rule"><Check size={18} /><span><strong>Answers hidden</strong><small>Students cannot check correctness before final submission.</small></span></div>
          </section>
        </div>
      ) : null}

      {activeTab === "uploads" ? (
        <div className="control-two-column">
          <section className="panel control-panel upload-dropzone">
            <FileUp size={32} />
            <h2>Upload a structured question paper</h2>
            <p>Import validated question data with JSON or CSV, or upload an original PDF test paper and assign it securely to students.</p>
            <label className="button primary"><input type="file" accept=".json,.csv,application/json,text/csv" onChange={uploadQuestions} disabled={uploadBusy || (!principal && !control.policies.teacherCanUploadQuestions)} />{uploadBusy ? "Validating…" : "Choose JSON / CSV"}</label>
            <button type="button" className="button secondary" onClick={onOpenPdfUpload} disabled={!onOpenPdfUpload || (!principal && !control.policies.teacherCanUploadQuestions)}><FileUp size={16} /> Upload PDF test paper</button>
            <a className="button secondary" href="/question-upload-template.csv" download>Download CSV template</a>
            <small>Structured files receive question-level duplicate checks. PDF files are securely stored in MongoDB and assigned only to selected students.</small>
          </section>
          <section className="panel control-panel">
            <div className="panel-heading"><div><p className="section-kicker">VALIDATION REGISTER</p><h2>Question uploads</h2></div><ShieldCheck size={20} /></div>
            {control.questionUploads.length ? control.questionUploads.map((upload) => <article className="control-upload" key={upload.id}><div><strong>{upload.name}</strong><small>{upload.teacher} · {new Date(upload.uploadedAt).toLocaleString()}</small></div><span>{upload.questions.length} valid</span><b>{upload.status}</b></article>) : <div className="control-empty"><FileUp size={24} /><strong>No teacher uploads yet</strong><span>Validated uploads will appear here for principal review.</span></div>}
          </section>
        </div>
      ) : null}

      {activeTab === "payments" ? (
        <div className="control-two-column">
          <form className="panel control-panel control-form" onSubmit={addCredit}>
            <div className="panel-heading"><div><p className="section-kicker">ADMIN-MANAGED LEDGER</p><h2>Add prepaid credit</h2></div><Banknote size={20} /></div>
            <div className="gateway-status"><AlertCircle size={17} /><span><strong>Online gateway not connected</strong><small>This ledger is operational for manual credits. Connect Stripe or the institute’s chosen Indian payment provider before live charging.</small></span></div>
            <label>Credit amount (₹)<input type="number" min="1" step="1" value={creditAmount} onChange={(event) => setCreditAmount(event.target.value)} /></label>
            <button type="submit" className="button primary" disabled={!principal}><Plus size={16} /> Record credit</button>
          </form>
          <section className="panel control-panel">
            <div className="panel-heading"><div><p className="section-kicker">TRANSACTIONS</p><h2>Prepaid ledger</h2></div><strong>₹{control.prepaidBalance.toLocaleString("en-IN")}</strong></div>
            {control.ledger.length ? control.ledger.map((entry) => <div className="ledger-row" key={entry.id}><span>+ ₹{entry.amount.toLocaleString("en-IN")}</span><div><strong>{entry.note}</strong><small>{new Date(entry.at).toLocaleString()}</small></div></div>) : <div className="control-empty"><Banknote size={24} /><strong>No credit transactions</strong><span>Only the principal can add or adjust prepaid credit.</span></div>}
          </section>
        </div>
      ) : null}
    </>
  );
}
