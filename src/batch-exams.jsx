import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ClipboardCheck,
  Clock,
  Eye,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { BATCH_EXAM_LEVELS, composeBatchExam } from '../batch-exam-engine.js';
import { API_BASE_URL, authRequest } from './api-client.js';

const STORAGE_KEY = 'vijetha-batch-exams-v1';
const LEVEL_LABELS = { easy: 'Easy', medium: 'Medium', challenging: 'Challenging' };

function loadDemoExams(courseKey) {
  try {
    const rows = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(rows) ? rows.filter((exam) => exam.course === courseKey) : [];
  } catch { return []; }
}

function saveDemoExams(courseKey, courseRows) {
  let rows = [];
  try { rows = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]'); } catch { rows = []; }
  const otherCourses = Array.isArray(rows) ? rows.filter((exam) => exam.course !== courseKey) : [];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...otherCourses, ...courseRows].slice(-60)));
}

function questionText(question) {
  return String(question.stem || question.text || 'Question text unavailable');
}

function optionText(option) {
  if (typeof option === 'string') return option;
  if (option?.figure) {
    const figure = option.figure;
    const details = [figure.shape, figure.direction, figure.mark && figure.mark !== 'none' ? figure.mark : '', figure.markCount ? `${figure.markCount} marks` : ''].filter(Boolean);
    return details.join(' · ') || 'Figure option';
  }
  return String(option?.text || option?.label || option?.id || 'Figure option');
}

function BatchQuestionStimulus({ stimulus }) {
  if (!stimulus) return null;
  if (['sequence', 'figure-sequence'].includes(stimulus.kind)) {
    return <div className="batch-question-stimulus"><b>Pattern</b><div>{(stimulus.items || []).map((item, index) => <span key={index}>{typeof item === 'object' ? [item.shape, item.direction, item.mark, item.markCount ? `${item.markCount} marks` : ''].filter(Boolean).join(' · ') : String(item)}</span>)}<strong>?</strong></div></div>;
  }
  if (['table', 'bar', 'pictograph'].includes(stimulus.kind)) {
    return <div className="batch-question-stimulus"><b>{stimulus.kind === 'table' ? 'Data table' : stimulus.kind === 'bar' ? 'Bar diagram' : `Pictograph · 1 symbol = ${stimulus.key}`}</b><div>{(stimulus.rows || []).map(([label, value]) => <span key={label}>{label}: {value}</span>)}</div></div>;
  }
  const figure = stimulus.figure || {};
  return <div className="batch-question-stimulus"><b>{stimulus.kind || 'Figure'}</b><div><span>{[figure.shape, figure.direction, figure.mark, figure.markCount ? `${figure.markCount} marks` : ''].filter(Boolean).join(' · ') || 'Visual figure'}</span></div></div>;
}

async function fetchSourceTest(courseKey, testId) {
  const paths = [`${API_BASE_URL}/api/full-test?course=${encodeURIComponent(courseKey)}&id=${encodeURIComponent(testId)}`];
  let lastError;
  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.test?.questions?.length) return payload.test;
      lastError = new Error(payload.error || `Could not load ${testId}.`);
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error(`Could not load ${testId}.`);
}

export function BatchExamsPage({ course, batches, students, tests, user, demo, canCreate = false }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [form, setForm] = useState({ title: 'Batch selection test', batch: batches[0]?.name || '', startsAt: '' });

  const load = async () => {
    setStatus('loading');
    setError('');
    try {
      const exams = demo
        ? loadDemoExams(course.key)
        : (await authRequest(`/api/batch-exams?course=${encodeURIComponent(course.key)}`, { method: 'GET' })).exams || [];
      setRows(exams);
      setStatus('ready');
    } catch (requestError) {
      setError(requestError.message || 'Batch exams could not be loaded.');
      setStatus('error');
    }
  };

  useEffect(() => {
    setForm({ title: 'Batch selection test', batch: batches[0]?.name || '', startsAt: '' });
    setPreview(null);
    load();
  }, [course.key, demo]);

  const studentsInBatch = useMemo(
    () => students.filter((student) => student.batch === form.batch),
    [form.batch, students],
  );
  const totals = useMemo(() => ({
    questions: rows.reduce((sum, exam) => sum + Number(exam.questionCount || 0), 0),
    students: new Set(rows.flatMap((exam) => exam.assignedStudentIds || [])).size || rows.reduce((sum, exam) => Math.max(sum, Number(exam.assignedStudentCount || 0)), 0),
  }), [rows]);

  const createDemoExam = async () => {
    const paperIndex = rows.length % 10;
    const sourceTests = BATCH_EXAM_LEVELS.map((level) => {
      const candidates = tests.filter((test) => String(test.level).toLowerCase() === level).sort((first, second) => first.number - second.number);
      if (!candidates.length) throw new Error(`No validated ${LEVEL_LABELS[level]} source paper is available.`);
      return candidates[paperIndex % candidates.length];
    });
    const loaded = await Promise.all(sourceTests.map((test) => fetchSourceTest(course.key, test.id)));
    const composed = composeBatchExam({
      courseKey: course.key,
      questions: loaded.flatMap((test) => test.questions),
      seed: `${course.key}:${form.batch}:${Date.now()}`,
      excludedQuestionIds: rows.flatMap((exam) => exam.questions || []).map((question) => question.questionId),
    });
    return {
      id: `demo-batch-exam-${Date.now()}`,
      ...composed,
      title: form.title.trim(),
      batch: form.batch,
      teacher: user.name,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      status: form.startsAt ? 'scheduled' : 'draft',
      assignedStudentCount: studentsInBatch.length,
      assignedStudentIds: studentsInBatch.map((student) => student.id),
      createdAt: new Date().toISOString(),
    };
  };

  const createExam = async (event) => {
    event.preventDefault();
    if (!studentsInBatch.length) { setError('Add at least one student to this batch before generating its exam.'); return; }
    setGenerating(true);
    setError('');
    setNotice('');
    try {
      const exam = demo
        ? await createDemoExam()
        : (await authRequest('/api/batch-exams', {
          method: 'POST',
          body: JSON.stringify({ ...form, course: course.key }),
        })).exam;
      const next = [exam, ...rows];
      setRows(next);
      if (demo) saveDemoExams(course.key, next);
      setNotice(`${exam.title} is ready with exactly 20 Easy, 20 Medium, and 20 Challenging questions.`);
    } catch (requestError) {
      setError(requestError.message || 'The 20/20/20 paper could not be generated.');
    } finally { setGenerating(false); }
  };

  const openPreview = async (exam) => {
    setPreviewLoading(true);
    setError('');
    try {
      if (demo) setPreview(exam);
      else {
        const payload = await authRequest(`/api/batch-exams?course=${encodeURIComponent(course.key)}&id=${encodeURIComponent(exam.id)}`, { method: 'GET' });
        setPreview(payload.exams?.[0] || null);
      }
    } catch (requestError) { setError(requestError.message || 'The paper preview could not be loaded.'); }
    finally { setPreviewLoading(false); }
  };

  const removeExam = async (exam) => {
    if (!window.confirm(`Delete “${exam.title}”?`)) return;
    try {
      if (!demo) await authRequest(`/api/batch-exams?id=${encodeURIComponent(exam.id)}`, { method: 'DELETE' });
      const next = rows.filter((row) => row.id !== exam.id);
      setRows(next);
      if (demo) saveDemoExams(course.key, next);
      if (preview?.id === exam.id) setPreview(null);
    } catch (requestError) { setError(requestError.message || 'The batch exam could not be deleted.'); }
  };

  return (
    <>
      <section className="page-heading batch-exam-heading">
        <div><div className="eyebrow"><span className="pulse" /> BATCH EXAM DELIVERY</div><h1>20 / 20 / 20 batch exams</h1><p>Generate a real 60-question paper for one batch from the validated {course.shortName} question bank.</p></div>
        <div className="batch-exam-assurance"><ShieldCheck size={19} /><span><b>No answer reveal</b><small>Answers remain hidden until final submission.</small></span></div>
      </section>

      <section className="control-summary-grid batch-exam-metrics">
        <article><ClipboardCheck /><span>Generated exams</span><strong>{rows.length}</strong></article>
        <article><Check /><span>Questions composed</span><strong>{totals.questions}</strong></article>
        <article><Users /><span>Students covered</span><strong>{totals.students}</strong></article>
        <article><ShieldCheck /><span>Difficulty rule</span><strong>20 · 20 · 20</strong></article>
      </section>

      {notice ? <div className="control-notice" role="status"><Check size={16} />{notice}</div> : null}
      {error ? <div className="control-notice error" role="alert"><AlertCircle size={16} />{error}</div> : null}

      <div className="control-two-column batch-exam-layout">
        <form className="panel control-panel control-form batch-exam-form" onSubmit={createExam}>
          <div className="panel-heading"><div><p className="section-kicker">VALIDATED PAPER BUILDER</p><h2>Generate and assign</h2></div><ClipboardCheck size={20} /></div>
          <div className="exam-mix"><span><b>20</b> Easy</span><span><b>20</b> Medium</span><span><b>20</b> Challenging</span></div>
          <label>Exam title<input required minLength="3" maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>Batch<select required value={form.batch} onChange={(event) => setForm({ ...form, batch: event.target.value })}><option value="">Choose batch</option>{batches.map((batch) => <option key={batch.name}>{batch.name}</option>)}</select></label>
          <div className="batch-assignment-count"><Users size={16} /><span><b>{studentsInBatch.length}</b> students will receive this exam</span></div>
          <label>Start time<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
          <button type="submit" className="button primary" disabled={!canCreate || generating || !form.batch || !studentsInBatch.length}>{generating ? <RefreshCw className="spin" size={16} /> : <ClipboardCheck size={16} />}{!canCreate ? 'Creation disabled by principal' : generating ? 'Selecting and validating 60 questions…' : 'Generate 20 / 20 / 20 exam'}</button>
          <small className="batch-exam-rule-note">Every generated paper is checked for exact difficulty counts, official subject proportions, duplicate prompts, and reuse across earlier batch papers.</small>
        </form>

        <section className="panel control-panel batch-exam-register">
          <div className="panel-heading"><div><p className="section-kicker">DELIVERY REGISTER</p><h2>Generated batch papers</h2></div><Clock size={20} /></div>
          {status === 'loading' ? <div className="control-empty"><RefreshCw className="spin" size={24} /><strong>Loading batch exams…</strong></div> : status === 'error' ? <div className="control-empty"><AlertCircle size={24} /><strong>Batch exams unavailable</strong><button type="button" className="button secondary" onClick={load}>Try again</button></div> : rows.length ? rows.map((exam) => (
            <article className="batch-exam-card" key={exam.id}>
              <div><span>{exam.status}</span><h3>{exam.title}</h3><p>{exam.batch} · {exam.teacher}</p><small>{exam.assignedStudentCount} students · {exam.questionCount} questions</small></div>
              <div className="batch-exam-counts"><b>20<span>Easy</span></b><b>20<span>Medium</span></b><b>20<span>Challenging</span></b></div>
              <div className="batch-exam-actions"><button type="button" onClick={() => openPreview(exam)} disabled={previewLoading}><Eye size={15} /> Preview</button>{['administrator', 'principal'].includes(user.role) ? <button type="button" className="danger" onClick={() => removeExam(exam)}><Trash2 size={15} /> Delete</button> : null}</div>
            </article>
          )) : <div className="control-empty"><ClipboardCheck size={25} /><strong>No generated batch papers</strong><span>Create the first validated 20/20/20 exam.</span></div>}
        </section>
      </div>

      {preview ? <div className="batch-exam-modal" role="dialog" aria-modal="true" aria-label={`${preview.title} preview`}><section><header><div><span>60-QUESTION SECURE PREVIEW</span><h2>{preview.title}</h2><p>{preview.batch} · 20 Easy + 20 Medium + 20 Challenging</p></div><button type="button" aria-label="Close preview" onClick={() => setPreview(null)}><X size={20} /></button></header><div className="batch-exam-question-list">{preview.questions?.map((question, index) => <article key={question.questionId || index} data-question-id={question.questionId}><div><b>{index + 1}</b><span>{LEVEL_LABELS[String(question.difficulty).toLowerCase()]}</span><small>{question.subject}</small></div>{question.passage ? <div className="batch-question-passage"><b>READING PASSAGE</b><p>{question.passage}</p></div> : null}<h3>{questionText(question)}</h3><BatchQuestionStimulus stimulus={question.stimulus} /><ol type="A">{(question.options || []).map((option, optionIndex) => <li key={option?.id || optionIndex}>{optionText(option)}</li>)}</ol></article>)}</div></section></div> : null}
    </>
  );
}
