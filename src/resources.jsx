import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import { API_BASE_URL, PUBLIC_APP_URL, authRequest, rawAuthRequest } from './api-client.js';
import { LanguageSelector, useI18n } from './i18n.jsx';

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const RESOURCE_COPY = {
  en: {
    kicker: 'INSTITUTE RESOURCES', title: 'Notes & test papers',
    subtitle: 'Upload learning material and make it visible only to the students you assign.',
    upload: 'Upload resource', newResource: 'New resource', editResource: 'Edit resource',
    resourceTitle: 'Resource title', description: 'Description', type: 'Resource type', note: 'Study notes', test: 'Test paper',
    file: 'File', assignments: 'Assign students', selectAll: 'Select every student', clear: 'Clear selection',
    save: 'Upload and assign', saveChanges: 'Save assignments', cancel: 'Cancel', loading: 'Loading resources…',
    empty: 'No notes or tests uploaded yet', emptyCopy: 'Upload the first resource and assign it to one or more students.',
    needsStudents: 'Add students before uploading a resource.', openStudents: 'Open students', assigned: 'Assigned students',
    download: 'Download', edit: 'Edit', remove: 'Delete', share: 'Copy student link', shareHint: 'Choose an assigned student',
    copied: 'Student access link copied.', created: 'Uploaded', max: 'PDF, image, text, Word, or PowerPoint · maximum 3 MB',
    deleteConfirm: 'Delete this resource and its uploaded file?', allSecure: 'Assignments are protected by institute ownership and revocable student links.',
    loadError: 'Resources could not be loaded', retry: 'Try again', noAssigned: 'No assigned resources yet',
    studentTitle: 'Your notes & tests', studentCopy: 'Download the materials assigned to you by Vijetha Institute.',
    invalidLink: 'This student link is invalid or has been replaced.', back: 'Vijetha Institute',
  },
  hi: {
    kicker: 'संस्थान सामग्री', title: 'नोट्स और टेस्ट पेपर',
    subtitle: 'अध्ययन सामग्री अपलोड करें और केवल चुने गए विद्यार्थियों को दिखाएँ।',
    upload: 'सामग्री अपलोड करें', newResource: 'नई सामग्री', editResource: 'सामग्री संपादित करें',
    resourceTitle: 'सामग्री का शीर्षक', description: 'विवरण', type: 'सामग्री का प्रकार', note: 'अध्ययन नोट्स', test: 'टेस्ट पेपर',
    file: 'फ़ाइल', assignments: 'विद्यार्थी चुनें', selectAll: 'सभी विद्यार्थी चुनें', clear: 'चयन हटाएँ',
    save: 'अपलोड करके सौंपें', saveChanges: 'असाइनमेंट सहेजें', cancel: 'रद्द करें', loading: 'सामग्री लोड हो रही है…',
    empty: 'अभी कोई नोट्स या टेस्ट अपलोड नहीं है', emptyCopy: 'पहली सामग्री अपलोड करके एक या अधिक विद्यार्थियों को सौंपें।',
    needsStudents: 'सामग्री अपलोड करने से पहले विद्यार्थी जोड़ें।', openStudents: 'विद्यार्थी खोलें', assigned: 'चुने गए विद्यार्थी',
    download: 'डाउनलोड', edit: 'संपादित करें', remove: 'हटाएँ', share: 'विद्यार्थी लिंक कॉपी करें', shareHint: 'चुना हुआ विद्यार्थी',
    copied: 'विद्यार्थी एक्सेस लिंक कॉपी हो गया।', created: 'अपलोड', max: 'PDF, चित्र, टेक्स्ट, Word या PowerPoint · अधिकतम 3 MB',
    deleteConfirm: 'क्या यह सामग्री और इसकी फ़ाइल हटानी है?', allSecure: 'असाइनमेंट संस्थान की सुरक्षा और बदले जा सकने वाले विद्यार्थी लिंक से सुरक्षित हैं।',
    loadError: 'सामग्री लोड नहीं हो सकी', retry: 'फिर कोशिश करें', noAssigned: 'अभी कोई सामग्री नहीं सौंपी गई है',
    studentTitle: 'आपके नोट्स और टेस्ट', studentCopy: 'विजेता संस्थान द्वारा आपको सौंपी गई सामग्री डाउनलोड करें।',
    invalidLink: 'यह विद्यार्थी लिंक अमान्य है या बदल दिया गया है।', back: 'विजेता संस्थान',
  },
  te: {
    kicker: 'సంస్థ వనరులు', title: 'నోట్స్ మరియు టెస్ట్ పేపర్లు',
    subtitle: 'అధ్యయన సామగ్రిని అప్‌లోడ్ చేసి ఎంచుకున్న విద్యార్థులకు మాత్రమే చూపించండి.',
    upload: 'వనరును అప్‌లోడ్ చేయండి', newResource: 'కొత్త వనరు', editResource: 'వనరును సవరించండి',
    resourceTitle: 'వనరు శీర్షిక', description: 'వివరణ', type: 'వనరు రకం', note: 'స్టడీ నోట్స్', test: 'టెస్ట్ పేపర్',
    file: 'ఫైల్', assignments: 'విద్యార్థులను కేటాయించండి', selectAll: 'అందరినీ ఎంచుకోండి', clear: 'ఎంపికను తొలగించండి',
    save: 'అప్‌లోడ్ చేసి కేటాయించండి', saveChanges: 'కేటాయింపులను సేవ్ చేయండి', cancel: 'రద్దు', loading: 'వనరులు లోడ్ అవుతున్నాయి…',
    empty: 'ఇంకా నోట్స్ లేదా టెస్టులు అప్‌లోడ్ కాలేదు', emptyCopy: 'మొదటి వనరును అప్‌లోడ్ చేసి ఒకరు లేదా ఎక్కువ మంది విద్యార్థులకు కేటాయించండి.',
    needsStudents: 'వనరును అప్‌లోడ్ చేసే ముందు విద్యార్థులను జోడించండి.', openStudents: 'విద్యార్థులను తెరవండి', assigned: 'కేటాయించిన విద్యార్థులు',
    download: 'డౌన్‌లోడ్', edit: 'సవరించు', remove: 'తొలగించు', share: 'విద్యార్థి లింక్ కాపీ', shareHint: 'కేటాయించిన విద్యార్థి',
    copied: 'విద్యార్థి యాక్సెస్ లింక్ కాపీ అయింది.', created: 'అప్‌లోడ్', max: 'PDF, చిత్రం, టెక్స్ట్, Word లేదా PowerPoint · గరిష్టం 3 MB',
    deleteConfirm: 'ఈ వనరును మరియు ఫైల్‌ను తొలగించాలా?', allSecure: 'కేటాయింపులు సంస్థ యాజమాన్యం మరియు మార్చగల విద్యార్థి లింకులతో రక్షించబడ్డాయి.',
    loadError: 'వనరులు లోడ్ కాలేదు', retry: 'మళ్లీ ప్రయత్నించండి', noAssigned: 'ఇంకా వనరులు కేటాయించలేదు',
    studentTitle: 'మీ నోట్స్ మరియు టెస్టులు', studentCopy: 'విజేత ఇన్‌స్టిట్యూట్ మీకు కేటాయించిన సామగ్రిని డౌన్‌లోడ్ చేయండి.',
    invalidLink: 'ఈ విద్యార్థి లింక్ చెల్లదు లేదా మార్చబడింది.', back: 'విజేత ఇన్‌స్టిట్యూట్',
  },
};

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The selected file could not be read.'));
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.readAsDataURL(file);
  });
}

function fileMimeType(file) {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ({
    pdf: 'application/pdf', txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })[extension] || 'application/octet-stream';
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function demoRows(course, students) {
  if (!students.length) return [];
  const content = `Vijetha Institute\n${course.shortName} revision notes\n\nThis demo file shows how assigned notes and test papers are delivered to students.`;
  return [{
    id: `demo-${course.key}`,
    course: course.key,
    type: 'note',
    title: `${course.shortName} weekly revision notes`,
    description: 'Key concepts and practice guidance for this week.',
    fileName: `${course.shortName}-revision-notes.txt`,
    mimeType: 'text/plain',
    size: new Blob([content]).size,
    studentIds: students.slice(0, 2).map((student) => student.id),
    students: students.slice(0, 2).map(({ id, name, batch }) => ({ id, name, batch })),
    createdByName: 'Vijetha teacher',
    createdAt: new Date().toISOString(),
    demoContent: content,
  }];
}

export function ResourcesPage({ course, students, demo, onOpenStudents, openUploadRequest = 0 }) {
  const { locale } = useI18n();
  const copy = RESOURCE_COPY[locale] || RESOURCE_COPY.en;
  const emptyForm = () => ({ type: 'note', title: '', description: '', studentIds: [] });
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [shareStudents, setShareStudents] = useState({});
  const [sharedUrl, setSharedUrl] = useState('');
  const fileRef = useRef(null);

  const load = async () => {
    setStatus('loading');
    setError('');
    if (demo) {
      setRows(demoRows(course, students));
      setStatus('ready');
      return;
    }
    try {
      const payload = await authRequest(`/api/resources?course=${encodeURIComponent(course.key)}`, { method: 'GET' });
      setRows(payload.resources || []);
      setStatus('ready');
    } catch (requestError) {
      setStatus('error');
      setError(requestError.message || copy.loadError);
    }
  };

  useEffect(() => {
    setFormOpen(false);
    setEditingId('');
    setNotice('');
    setSharedUrl('');
    load();
  }, [course.key, demo, students.length]);

  useEffect(() => {
    if (!openUploadRequest || !students.length) return;
    setForm({ ...emptyForm(), type: 'test' });
    setEditingId('');
    setFile(null);
    setError('');
    setFormOpen(true);
  }, [openUploadRequest, students.length]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingId('');
    setFile(null);
    setError('');
    setForm(emptyForm());
    if (fileRef.current) fileRef.current.value = '';
  };

  const openEdit = (resource) => {
    setEditingId(resource.id);
    setForm({ type: resource.type, title: resource.title, description: resource.description, studentIds: [...resource.studentIds] });
    setFile(null);
    setError('');
    setFormOpen(true);
  };

  const saveResource = async (event) => {
    event.preventDefault();
    if (!editingId && !file) { setError('Choose a file to upload.'); return; }
    if (!form.studentIds.length) { setError('Assign this resource to at least one student.'); return; }
    if (file && file.size > MAX_FILE_BYTES) { setError('Files must be 3 MB or smaller.'); return; }
    setSaving(true);
    setError('');
    try {
      if (demo) {
        const assigned = students.filter((student) => form.studentIds.includes(student.id));
        const demoResource = {
          id: editingId || `demo-${Date.now()}`,
          course: course.key,
          ...form,
          fileName: editingId ? rows.find((row) => row.id === editingId).fileName : file.name,
          mimeType: editingId ? rows.find((row) => row.id === editingId).mimeType : file.type,
          size: editingId ? rows.find((row) => row.id === editingId).size : file.size,
          students: assigned.map(({ id, name, batch }) => ({ id, name, batch })),
          createdByName: 'Vijetha teacher',
          createdAt: editingId ? rows.find((row) => row.id === editingId).createdAt : new Date().toISOString(),
          demoBlob: editingId ? rows.find((row) => row.id === editingId).demoBlob : file,
        };
        setRows((current) => editingId ? current.map((row) => row.id === editingId ? demoResource : row) : [demoResource, ...current]);
      } else {
        const body = { ...form, course: course.key };
        if (!editingId) body.file = { fileName: file.name, mimeType: fileMimeType(file), dataBase64: await fileToBase64(file) };
        const payload = await authRequest(editingId ? `/api/resources?id=${encodeURIComponent(editingId)}` : '/api/resources', {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify(body),
        });
        setRows((current) => editingId ? current.map((row) => row.id === editingId ? payload.resource : row) : [payload.resource, ...current]);
      }
      closeForm();
    } catch (requestError) {
      setError(requestError.message || 'The resource could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const removeResource = async (resource) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    setError('');
    try {
      if (!demo) await authRequest(`/api/resources?id=${encodeURIComponent(resource.id)}`, { method: 'DELETE' });
      setRows((current) => current.filter((row) => row.id !== resource.id));
    } catch (requestError) {
      setError(requestError.message || 'The resource could not be deleted.');
    }
  };

  const downloadResource = async (resource) => {
    setError('');
    try {
      if (demo) {
        downloadBlob(resource.demoBlob || new Blob([resource.demoContent || 'Demo resource'], { type: resource.mimeType }), resource.fileName);
        return;
      }
      const response = await rawAuthRequest(`/api/resources?download=${encodeURIComponent(resource.id)}`, { method: 'GET' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'The file could not be downloaded.');
      }
      downloadBlob(await response.blob(), resource.fileName);
    } catch (requestError) {
      setError(requestError.message || 'The file could not be downloaded.');
    }
  };

  const shareStudentAccess = async (resource) => {
    const studentId = shareStudents[resource.id] || resource.studentIds[0];
    if (!studentId) return;
    if (demo) {
      setNotice('Student links are generated after secure sign-in.');
      return;
    }
    try {
      const payload = await authRequest('/api/resources?action=student-access', { method: 'POST', body: JSON.stringify({ studentId }) });
      const url = `${PUBLIC_APP_URL}/#studentAccess=${encodeURIComponent(`${payload.studentId}.${payload.token}`)}`;
      setSharedUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      setNotice(copy.copied);
    } catch (requestError) {
      setError(requestError.message || 'The student link could not be created.');
    }
  };

  const selectedCount = form.studentIds.length;
  const everyStudentSelected = students.length > 0 && selectedCount === students.length;
  const assignedTotal = useMemo(() => new Set(rows.flatMap((resource) => resource.studentIds)).size, [rows]);

  return (
    <>
      <section className="page-heading resource-heading">
        <div>
          <div className="eyebrow"><span className="pulse" /> {copy.kicker}</div>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button primary" disabled={!students.length} onClick={() => { setForm(emptyForm()); setEditingId(''); setError(''); setFormOpen(true); }}>
            <UploadCloud size={17} /> {copy.upload}
          </button>
        </div>
      </section>

      <section className="resource-metrics" aria-label="Resource summary">
        <div><FileText size={19} /><span><b>{rows.length}</b> {copy.title}</span></div>
        <div><Users size={19} /><span><b>{assignedTotal}</b> {copy.assigned}</span></div>
        <div><ShieldCheck size={19} /><span>{copy.allSecure}</span></div>
      </section>

      {!students.length ? (
        <section className="panel resource-empty"><Users size={30} /><h2>{copy.needsStudents}</h2><button type="button" className="button secondary" onClick={onOpenStudents}>{copy.openStudents}</button></section>
      ) : null}

      {formOpen ? (
        <section className="panel resource-form-panel">
          <div className="panel-heading compact-heading">
            <div><span>{editingId ? copy.editResource : copy.newResource}</span><h2>{editingId ? form.title : copy.upload}</h2></div>
            <button type="button" className="icon-button" aria-label={copy.cancel} onClick={closeForm}><X size={18} /></button>
          </div>
          <form className="resource-form" onSubmit={saveResource}>
            <div className="resource-form-grid">
              <label>{copy.resourceTitle}<input required minLength={3} maxLength={120} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
              <label>{copy.type}<select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}><option value="note">{copy.note}</option><option value="test">{copy.test}</option></select></label>
              <label className="form-span">{copy.description}<textarea rows="3" maxLength={500} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
              {!editingId ? <label className="form-span resource-file-field">{copy.file}<input ref={fileRef} required type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.pptx" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>{copy.max}</small></label> : null}
            </div>
            <fieldset className="student-assignment-fieldset">
              <legend>{copy.assignments} <b>{selectedCount}</b></legend>
              <div className="assignment-toolbar"><button type="button" onClick={() => setForm((current) => ({ ...current, studentIds: everyStudentSelected ? [] : students.map((student) => student.id) }))}>{everyStudentSelected ? copy.clear : copy.selectAll}</button></div>
              <div className="assignment-grid">
                {students.map((student) => <label key={student.id}><input type="checkbox" checked={form.studentIds.includes(student.id)} onChange={(event) => setForm((current) => ({ ...current, studentIds: event.target.checked ? [...current.studentIds, student.id] : current.studentIds.filter((id) => id !== student.id) }))} /><span><b>{student.name}</b><small>{student.batch}</small></span></label>)}
              </div>
            </fieldset>
            {error ? <div className="auth-alert error" role="alert"><AlertCircle size={16} /> {error}</div> : null}
            <div className="form-actions"><button type="button" className="button secondary" onClick={closeForm}>{copy.cancel}</button><button type="submit" className="button primary" disabled={saving}>{saving ? <RefreshCw className="spin" size={16} /> : <Check size={16} />}{saving ? copy.loading : editingId ? copy.saveChanges : copy.save}</button></div>
          </form>
        </section>
      ) : null}

      {error && !formOpen ? <div className="auth-alert error resource-alert" role="alert"><AlertCircle size={16} /> {error}</div> : null}
      {notice ? <div className="auth-alert success resource-alert" role="status"><Check size={16} /><span>{notice}{sharedUrl ? <input readOnly value={sharedUrl} aria-label="Student access link" onFocus={(event) => event.target.select()} /> : null}</span></div> : null}

      {status === 'loading' ? (
        <section className="panel resource-empty"><RefreshCw className="spin" size={28} /><h2>{copy.loading}</h2></section>
      ) : status === 'error' ? (
        <section className="panel resource-empty"><AlertCircle size={30} /><h2>{copy.loadError}</h2><p>{error}</p><button type="button" className="button secondary" onClick={load}>{copy.retry}</button></section>
      ) : rows.length ? (
        <section className="resource-grid">
          {rows.map((resource) => (
            <article className="resource-card" key={resource.id}>
              <div className={`resource-type-icon ${resource.type}`} aria-hidden="true">{resource.type === 'test' ? <ClipboardCheck size={23} /> : <BookOpen size={23} />}</div>
              <div className="resource-card-copy"><span>{resource.type === 'test' ? copy.test : copy.note}</span><h2>{resource.title}</h2><p>{resource.description || resource.fileName}</p><small>{resource.fileName} · {formatBytes(resource.size)} · {copy.created} {new Intl.DateTimeFormat(locale === 'te' ? 'te-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' }).format(new Date(resource.createdAt))}</small></div>
              <div className="resource-students"><strong>{copy.assigned}</strong><div>{resource.students.map((student) => <span key={student.id}>{student.name}</span>)}</div></div>
              <div className="resource-actions">
                <button type="button" onClick={() => downloadResource(resource)}><Download size={15} /> {copy.download}</button>
                <button type="button" onClick={() => openEdit(resource)}><Pencil size={15} /> {copy.edit}</button>
                <button type="button" className="danger" onClick={() => removeResource(resource)}><Trash2 size={15} /> {copy.remove}</button>
              </div>
              <div className="resource-share">
                <label><span>{copy.shareHint}</span><select value={shareStudents[resource.id] || resource.studentIds[0] || ''} onChange={(event) => setShareStudents((current) => ({ ...current, [resource.id]: event.target.value }))}>{resource.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
                <button type="button" onClick={() => shareStudentAccess(resource)}><Link2 size={15} /> {copy.share}</button>
              </div>
            </article>
          ))}
        </section>
      ) : students.length ? (
        <section className="panel resource-empty"><UploadCloud size={30} /><h2>{copy.empty}</h2><p>{copy.emptyCopy}</p><button type="button" className="button primary" onClick={() => setFormOpen(true)}>{copy.upload}</button></section>
      ) : null}
    </>
  );
}

export function StudentResourcesPortal({ accessCode }) {
  const { locale } = useI18n();
  const copy = RESOURCE_COPY[locale] || RESOURCE_COPY.en;
  const separator = accessCode.indexOf('.');
  const studentId = separator > 0 ? accessCode.slice(0, separator) : '';
  const token = separator > 0 ? accessCode.slice(separator + 1) : '';
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!studentId || !token) { setError(copy.invalidLink); return; }
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/resources?student=${encodeURIComponent(studentId)}&token=${encodeURIComponent(token)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || copy.invalidLink);
        setPayload(body);
      })
      .catch((requestError) => { if (requestError.name !== 'AbortError') setError(requestError.message || copy.invalidLink); });
    return () => controller.abort();
  }, [studentId, token, locale]);

  return (
    <main className="student-resource-portal">
      <header><a href={PUBLIC_APP_URL}><span className="student-resource-logo">V</span><strong>{copy.back}</strong></a><LanguageSelector compact /></header>
      <section className="student-resource-hero"><span><ShieldCheck size={15} /> PRIVATE STUDENT LIBRARY</span><h1>{copy.studentTitle}</h1><p>{copy.studentCopy}</p>{payload?.student ? <div><b>{payload.student.name}</b><small>{payload.student.batch}</small></div> : null}</section>
      {error ? <section className="student-resource-state error"><AlertCircle size={28} /><h2>{copy.invalidLink}</h2><p>{error}</p></section> : !payload ? <section className="student-resource-state"><RefreshCw className="spin" size={28} /><h2>{copy.loading}</h2></section> : payload.resources.length ? <section className="student-resource-list">{payload.resources.map((resource) => <article key={resource.id}><div className={`resource-type-icon ${resource.type}`}>{resource.type === 'test' ? <ClipboardCheck size={22} /> : <BookOpen size={22} />}</div><div><span>{resource.type === 'test' ? copy.test : copy.note}</span><h2>{resource.title}</h2><p>{resource.description}</p><small>{resource.fileName} · {formatBytes(resource.size)}</small></div><a href={`${API_BASE_URL}/api/resources?student=${encodeURIComponent(studentId)}&token=${encodeURIComponent(token)}&download=${encodeURIComponent(resource.id)}`} target="_blank" rel="noreferrer"><Download size={16} /> {copy.download}<ExternalLink size={13} /></a></article>)}</section> : <section className="student-resource-state"><FileText size={30} /><h2>{copy.noAssigned}</h2></section>}
    </main>
  );
}
