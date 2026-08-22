import { Component, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Clock,
  Database,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogIn,
  Mail,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import "./styles.css";
import "./runner.css";
import "./portal-pages.css";
import {
  ARITHMETIC_SECTION_PLAN,
  JNVST_BLUEPRINT,
  JNVST_STANDARD,
  LANGUAGE_SKILLS,
  MAT_SECTION_PLAN,
} from "../syllabus.js";

const INITIAL_STUDENTS = [
  {
    id: 1,
    initials: "AN",
    name: "Aarav Nair",
    batch: "JNVST Morning A",
    progress: 86,
    state: "On track",
    tone: "green",
    guardian: "Meera Nair",
    last: "Today, 10:42",
  },
  {
    id: 2,
    initials: "SK",
    name: "Saanvi Kumar",
    batch: "JNVST Morning A",
    progress: 72,
    state: "On track",
    tone: "green",
    guardian: "Raj Kumar",
    last: "Today, 09:18",
  },
  {
    id: 3,
    initials: "JL",
    name: "Jiya Lal",
    batch: "JNVST Evening B",
    progress: 48,
    state: "At risk",
    tone: "red",
    guardian: "Kiran Lal",
    last: "Aug 18",
  },
  {
    id: 4,
    initials: "RM",
    name: "Rehan Malik",
    batch: "JNVST Weekend",
    progress: 64,
    state: "Needs review",
    tone: "amber",
    guardian: "Amina Malik",
    last: "Yesterday",
  },
];

const BATCHES = [
  {
    name: "JNVST Morning A",
    mentor: "Priya Sharma",
    students: 32,
    schedule: "Mon–Fri · 7:00 AM",
    next: "MAT · Pattern Completion",
  },
  {
    name: "JNVST Evening B",
    mentor: "Ravi Verma",
    students: 28,
    schedule: "Mon–Fri · 5:30 PM",
    next: "EVS · Water Cycle",
  },
  {
    name: "JNVST Weekend",
    mentor: "Anita Rao",
    students: 24,
    schedule: "Sat–Sun · 9:00 AM",
    next: "Arithmetic · Fractions",
  },
];

const RANKS = [
  ["Saanvi Kumar", "92.50", "1"],
  ["Aarav Nair", "88.75", "2"],
  ["Rehan Malik", "76.25", "3"],
  ["Jiya Lal", "63.75", "4"],
];

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:5174" : "");
const EXPECTED_LEVELS = ["Easy", "Medium", "Challenging"];

function optionLabel(option) {
  if (option == null) return "";
  if (typeof option !== "object") return String(option);
  if (option.text != null) return String(option.text);
  if (option.label != null) return String(option.label);
  if (option.figure)
    return `${option.figure.shape || "Figure"}${option.figure.mark && option.figure.mark !== "none" ? ` with ${option.figure.mark}` : ""}`;
  return String(option.id || "Option");
}

function normalizeQuestion(question) {
  const sourceOptions = Array.isArray(question.options) ? question.options : [];
  const options = sourceOptions.map((option, index) => ({
    id:
      typeof option === "object" && option?.id
        ? option.id
        : String.fromCharCode(65 + index),
    label: optionLabel(option),
    figure: typeof option === "object" ? option.figure || null : null,
  }));
  const answer = question.correctOption || question.answer || "";
  return {
    ...question,
    text: question.stem || question.text || "Question text unavailable",
    options,
    answer,
  };
}

function normalizeFullCatalog(tests) {
  return tests.map((test, index) => ({
    ...test,
    number: test.number || index + 1,
    level: `${test.level?.[0]?.toUpperCase() || ""}${test.level?.slice(1) || ""}`,
    questions: Array.isArray(test.questions)
      ? test.questions.map(normalizeQuestion)
      : [],
  }));
}

function validateFullCatalog(tests) {
  if (tests.length !== 30)
    throw new Error(
      `Testing returned ${tests.length} papers; 30 are required.`,
    );
  for (const level of EXPECTED_LEVELS) {
    const count = tests.filter((test) => test.level === level).length;
    if (count !== 10)
      throw new Error(
        `Testing returned ${count} ${level} papers; 10 are required.`,
      );
  }
  for (const test of tests) {
    if (test.questions.length !== 80)
      throw new Error(
        `${test.id} contains ${test.questions.length} questions; 80 are required.`,
      );
    for (const section of JNVST_BLUEPRINT) {
      const count = test.questions.filter(
        (question) => question.subject === section.subject,
      ).length;
      if (count !== 20)
        throw new Error(
          `${test.id} has ${count} ${section.subject} questions; 20 are required.`,
        );
    }
  }
}

const NAV_ITEMS = [
  ["Dashboard", LayoutDashboard],
  ["Students", Users],
  ["Classes", CalendarDays],
  ["Mock Tests", ClipboardCheck],
  ["Progress", BarChart3],
  ["Parents", MessageSquare],
  ["Syllabus", BookOpen],
];

function App() {
  const [stage, setStage] = useState("landing");
  const [active, setActive] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [studentRows, setStudentRows] = useState(INITIAL_STUDENTS);
  const [fullTests, setFullTests] = useState([]);
  const [aggregation, setAggregation] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState("loading");
  const [catalogError, setCatalogError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [dataSource, setDataSource] = useState("Connecting to Testing");

  useEffect(() => {
    const controller = new AbortController();
    const loadCatalog = async () => {
      setCatalogStatus("loading");
      setCatalogError("");
      try {
        const [catalogResponse, aggregationResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/full-test-catalog`, {
            signal: controller.signal,
          }),
          fetch(`${API_BASE_URL}/api/question-aggregation`, {
            signal: controller.signal,
          }),
        ]);
        const catalogPayload = await catalogResponse.json();
        const aggregationPayload = await aggregationResponse.json();
        if (!catalogResponse.ok)
          throw new Error(
            catalogPayload.error ||
              "The full-test catalog could not be loaded.",
          );
        if (!aggregationResponse.ok)
          throw new Error(
            aggregationPayload.error ||
              "Question-bank aggregation could not be loaded.",
          );
        const tests = normalizeFullCatalog(catalogPayload.tests || []);
        validateFullCatalog(tests);
        setFullTests(tests);
        setAggregation(aggregationPayload.aggregation || []);
        setDataSource(catalogPayload.source || "Testing.jnvst_questions");
        setCatalogStatus("ready");
      } catch (error) {
        if (error.name === "AbortError") return;
        setFullTests([]);
        setAggregation([]);
        setDataSource("Testing unavailable");
        setCatalogError(
          error.message || "Unable to connect to the MongoDB question bank.",
        );
        setCatalogStatus("error");
      }
    };
    loadCatalog();
    return () => controller.abort();
  }, [reloadKey]);

  const openStudio = (testId = null) => {
    setStudioOpen(true);
    setSelectedTest(testId);
  };
  const retryCatalog = () => setReloadKey((key) => key + 1);

  if (stage === "landing")
    return <LandingPage onLogin={() => setStage("login")} />;
  if (stage === "login")
    return (
      <LoginPage
        onBack={() => setStage("landing")}
        onLogin={() => setStage("portal")}
      />
    );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={17} />
          </div>
          <span>
            vijetha<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="workspace-switcher">
          <div className="institute-avatar">VI</div>
          <div>
            <strong>Vijetha Institute</strong>
            <small>Admin workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <p className="nav-label">Workspace</p>
        <nav>
          {NAV_ITEMS.map(([label, Icon]) => (
            <button
              type="button"
              key={label}
              className={active === label ? "nav-item active" : "nav-item"}
              onClick={() => {
                setActive(label);
                setMobileOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Mock Tests" && <span className="nav-badge">30</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="integrity">
            <ShieldCheck size={16} />
            <div>
              <strong>Syllabus integrity</strong>
              <span>JNVST 2027 locked</span>
            </div>
            <Check size={15} />
          </div>
          <button type="button" className="nav-item">
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            className="profile profile-button"
            onClick={() => setStage("landing")}
          >
            <div className="avatar coral">AK</div>
            <div>
              <strong>Amara Khan</strong>
              <small>Sign out</small>
            </div>
            <LogIn size={17} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Vijetha Institute</span>
            <span>/</span>
            <strong>{active}</strong>
          </div>
          <div className="top-actions">
            <label className="search">
              <Search size={16} />
              <input
                aria-label="Search workspace"
                placeholder="Search anything"
              />
              <kbd>⌘ K</kbd>
            </label>
            <button
              type="button"
              className="icon-button notification"
              aria-label="View notifications"
            >
              <Bell size={18} />
              <i />
            </button>
            <div className="avatar coral">AK</div>
          </div>
        </header>
        <div className="page-wrap portal-page-wrap">
          {active === "Dashboard" && (
            <DashboardPage
              students={studentRows}
              fullTests={fullTests}
              aggregation={aggregation}
              catalogStatus={catalogStatus}
              dataSource={dataSource}
              onNavigate={setActive}
              onOpenTests={() => openStudio()}
            />
          )}
          {active === "Students" && (
            <StudentsPage students={studentRows} setStudents={setStudentRows} />
          )}
          {active === "Classes" && <ClassesPage />}
          {active === "Mock Tests" && (
            <MockTestsPage
              tests={fullTests}
              status={catalogStatus}
              error={catalogError}
              dataSource={dataSource}
              onRetry={retryCatalog}
              onOpen={openStudio}
            />
          )}
          {active === "Progress" && <ProgressPage students={studentRows} />}
          {active === "Parents" && <ParentsPage students={studentRows} />}
          {active === "Syllabus" && <SyllabusPage />}
        </div>
      </main>

      {studioOpen && (
        <TestStudioBoundary onClose={() => setStudioOpen(false)}>
          <TestStudio
            testCatalog={fullTests}
            selectedTest={selectedTest}
            setSelectedTest={setSelectedTest}
            status={catalogStatus}
            error={catalogError}
            onRetry={retryCatalog}
            close={() => setStudioOpen(false)}
          />
        </TestStudioBoundary>
      )}
    </div>
  );
}

class TestStudioBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="catalog-overlay" role="alert">
        <section className="catalog-panel">
          <div className="catalog-state error-state">
            <AlertCircle size={28} />
            <h3>The test runner encountered an error</h3>
            <p>{this.state.error.message}</p>
            <button
              type="button"
              className="button primary"
              onClick={this.props.onClose}
            >
              Return to dashboard
            </button>
          </div>
        </section>
      </div>
    );
  }
}

function LandingPage({ onLogin }) {
  return (
    <main className="public-shell">
      <nav className="public-nav">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={17} />
          </div>
          <span>
            vijetha<span className="brand-dot">.</span>
          </span>
        </div>
        <div>
          <a href="#standard">JNVST standard</a>
          <a href="#features">Modules</a>
          <button type="button" className="button primary" onClick={onLogin}>
            Institute login <ArrowRight size={16} />
          </button>
        </div>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-pill">
            <ShieldCheck size={15} /> Supplied JNVST Class 6 syllabus preserved
          </span>
          <h1>One beautiful workspace for serious JNVST preparation.</h1>
          <p>
            Manage students and classes, deliver 30 syllabus-aligned full tests,
            follow progress, and keep parents informed—from one focused
            institute portal.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="button primary large"
              onClick={onLogin}
            >
              Open demo workspace <ArrowRight size={18} />
            </button>
            <a className="button secondary large" href="#standard">
              View exam standard
            </a>
          </div>
          <div className="hero-proof">
            <span>
              <strong>30</strong> full tests
            </span>
            <span>
              <strong>2,400</strong> unique questions
            </span>
            <span>
              <strong>80</strong> questions each
            </span>
          </div>
        </div>
        <div className="hero-preview" role="img" aria-label="Portal dashboard preview">
          <div className="preview-top">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-body">
            <div className="preview-side" />
            <div className="preview-content">
              <small>JNVST 2027 CONTROL ROOM</small>
              <h2>Preparation at a glance</h2>
              <div className="preview-metrics">
                <i />
                <i />
                <i />
              </div>
              <div className="preview-chart">
                <b />
                <b />
                <b />
                <b />
                <b />
                <b />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="public-standard" id="standard">
        <p>EXACT EXAM BLUEPRINT</p>
        <h2>Built around the syllabus you supplied.</h2>
        <div>
          {JNVST_BLUEPRINT.map((section) => (
            <article key={section.key}>
              <span>{section.section}</span>
              <h3>{section.subject}</h3>
              <strong>
                {section.questionCount} questions · {section.marks} marks
              </strong>
              <p>{section.durationMinutes} minutes</p>
            </article>
          ))}
        </div>
      </section>
      <section className="feature-strip" id="features">
        {[
          ["Students", Users],
          ["Classes", CalendarDays],
          ["Mock tests", ClipboardCheck],
          ["Progress", BarChart3],
          ["Parents", MessageSquare],
          ["Syllabus", BookOpen],
        ].map(([label, Icon]) => (
          <div key={label}>
            <Icon size={20} />
            <strong>{label}</strong>
          </div>
        ))}
      </section>
    </main>
  );
}

function LoginPage({ onBack, onLogin }) {
  return (
    <main className="login-shell">
      <button type="button" className="login-back" onClick={onBack}>
        <ArrowLeft size={16} /> Back to website
      </button>
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault();
          onLogin();
        }}
      >
        <div className="brand login-brand">
          <div className="brand-mark">
            <Sparkles size={17} />
          </div>
          <span>
            vijetha<span className="brand-dot">.</span>
          </span>
        </div>
        <p className="section-kicker">INSTITUTE WORKSPACE</p>
        <h1>Welcome back.</h1>
        <p>Use the demo details below to enter the JNVST preparation portal.</p>
        <label>
          Email
          <input type="email" defaultValue="admin@vijetha.in" required />
        </label>
        <label>
          Password
          <input type="password" defaultValue="jnvst2027" required />
        </label>
        <button type="submit" className="button primary large">
          Sign in to workspace <ArrowRight size={17} />
        </button>
        <small>Demo access only · no credentials are stored</small>
      </form>
    </main>
  );
}

function PageHeading({ kicker, title, copy, children }) {
  return (
    <section className="page-heading">
      <div>
        <div className="eyebrow">
          <span className="pulse" /> {kicker}
        </div>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {children ? <div className="heading-actions">{children}</div> : null}
    </section>
  );
}

function DashboardPage({
  students,
  fullTests,
  aggregation,
  catalogStatus,
  dataSource,
  onNavigate,
  onOpenTests,
}) {
  return (
    <>
      <PageHeading
        kicker="JNVST CLASS 6 · 2027 PREPARATION"
        title="Good morning, Amara."
        copy="Here is what needs your attention across Vijetha Institute."
      >
        <button
          type="button"
          className="button secondary"
          onClick={() => window.print()}
        >
          <Printer size={16} /> Print overview
        </button>
        <button type="button" className="button primary" onClick={onOpenTests}>
          <CircleHelp size={16} /> Open full tests
        </button>
      </PageHeading>
      <section className="metric-grid">
        <Metric
          icon={Users}
          label="Active students"
          value={students.length}
          change="3 batches"
          note="in preparation"
          color="teal"
        />
        <Metric
          icon={BookOpen}
          label="JNVST syllabus"
          value="100%"
          change="2027"
          note="supplied topic map"
          color="coral"
        />
        <Metric
          icon={ClipboardCheck}
          label="Full tests"
          value={catalogStatus === "ready" ? fullTests.length : "—"}
          change="10 / level"
          note="80 questions each"
          color="gold"
        />
        <Metric
          icon={Zap}
          label="Validated questions"
          value={catalogStatus === "ready" ? "2,400" : "—"}
          change="Testing DB"
          note="unique content"
          color="ink"
        />
      </section>
      <div className="portal-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">STUDENT PULSE</p>
              <h2>Progress overview</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigate("Students")}
            >
              Manage students <ArrowUpRight size={15} />
            </button>
          </div>
          <StudentTable students={students} />
        </section>
        <section className="panel testing-card">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">TESTING DATABASE</p>
              <h2>Validated full-test library</h2>
            </div>
            <Database size={20} />
          </div>
          <p className="panel-copy">
            {catalogStatus === "ready"
              ? `Live from ${dataSource}.`
              : "Connect the Testing database to load the catalog."}{" "}
            Every paper follows 20 MAT + 20 EVS + 20 Arithmetic + 20 Language.
          </p>
          <div className="level-grid">
            <Level
              name="Easy"
              count={
                fullTests.filter((test) => test.level === "Easy").length || "—"
              }
              range="80 questions · 100 marks"
              color="mint"
            />
            <Level
              name="Medium"
              count={
                fullTests.filter((test) => test.level === "Medium").length ||
                "—"
              }
              range="80 questions · 100 marks"
              color="peach"
            />
            <Level
              name="Challenging"
              count={
                fullTests.filter((test) => test.level === "Challenging")
                  .length || "—"
              }
              range="80 questions · 100 marks"
              color="lemon"
            />
          </div>
          <div className="library-footer">
            <div className="set-label">
              <span>Questions loaded</span>
              <b>
                {aggregation.reduce(
                  (total, item) => total + item.questionCount,
                  0,
                ) || "—"}
              </b>
            </div>
            <div className="integrity-inline">
              <ShieldCheck size={15} /> Syllabus structure locked
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function StudentTable({ students, actions }) {
  return (
    <div className="student-table">
      <div className="table-head">
        <span>Student</span>
        <span>Batch</span>
        <span>Completion</span>
        <span>Status</span>
        <span>Last active</span>
        <span />
      </div>
      {students.map((student) => (
        <div className="student-row" key={student.id}>
          <div className="student-name">
            <div className="avatar">{student.initials}</div>
            <strong>{student.name}</strong>
          </div>
          <span className="muted">{student.batch}</span>
          <div className="completion">
            <div className="progress-track">
              <span style={{ width: `${student.progress}%` }} />
            </div>
            <b>{student.progress}%</b>
          </div>
          <span className={`status ${student.tone}`}>{student.state}</span>
          <span className="muted last-active">{student.last}</span>
          {actions ? actions(student) : <MoreHorizontal size={17} />}
        </div>
      ))}
    </div>
  );
}

function StudentsPage({ students, setStudents }) {
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const saveStudent = (event) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (editingId)
      setStudents((rows) =>
        rows.map((row) =>
          row.id === editingId
            ? {
                ...row,
                name: clean,
                initials: clean
                  .split(/\s+/)
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase(),
              }
            : row,
        ),
      );
    else
      setStudents((rows) => [
        ...rows,
        {
          id: Date.now(),
          name: clean,
          initials: clean
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
          batch: "JNVST Morning A",
          progress: 0,
          state: "New",
          tone: "amber",
          guardian: "Not added",
          last: "Just now",
        },
      ]);
    setName("");
    setEditingId(null);
  };
  return (
    <>
      <PageHeading
        kicker="STUDENT MANAGEMENT"
        title="Students"
        copy="Add, update, and monitor every JNVST learner."
      >
        <form className="inline-form" onSubmit={saveStudent}>
          <label className="sr-only" htmlFor="student-name">
            Student name
          </label>
          <input
            id="student-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Student name"
          />
          <button type="submit" className="button primary">
            <UserPlus size={16} /> {editingId ? "Save student" : "Add student"}
          </button>
        </form>
      </PageHeading>
      <section className="panel">
        <StudentTable
          students={students}
          actions={(student) => (
            <div className="row-actions">
              <button
                type="button"
                aria-label={`Edit ${student.name}`}
                onClick={() => {
                  setEditingId(student.id);
                  setName(student.name);
                }}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                aria-label={`Remove ${student.name}`}
                onClick={() =>
                  setStudents((rows) =>
                    rows.filter((row) => row.id !== student.id),
                  )
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        />
      </section>
    </>
  );
}

function ClassesPage() {
  return (
    <>
      <PageHeading
        kicker="BATCHES & SCHEDULE"
        title="Classes"
        copy="Keep teaching plans connected to the unchanged JNVST syllabus."
      >
        <button type="button" className="button primary">
          <Plus size={16} /> Create batch
        </button>
      </PageHeading>
      <div className="batch-grid">
        {BATCHES.map((batch) => (
          <article className="panel batch-card" key={batch.name}>
            <div className="batch-icon">
              <GraduationCap size={20} />
            </div>
            <span>{batch.students} students</span>
            <h2>{batch.name}</h2>
            <p>{batch.mentor}</p>
            <dl>
              <div>
                <dt>Schedule</dt>
                <dd>{batch.schedule}</dd>
              </div>
              <div>
                <dt>Next lesson</dt>
                <dd>{batch.next}</dd>
              </div>
            </dl>
            <button type="button" className="button secondary">
              View class <ArrowRight size={15} />
            </button>
          </article>
        ))}
      </div>
      <section className="panel weekly-plan">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">THIS WEEK</p>
            <h2>Class schedule</h2>
          </div>
        </div>
        {BATCHES.map((batch, index) => (
          <div className="schedule-row" key={batch.name}>
            <time>{["MON 07:00", "WED 17:30", "SAT 09:00"][index]}</time>
            <strong>{batch.next}</strong>
            <span>{batch.name}</span>
            <b>{batch.mentor}</b>
          </div>
        ))}
      </section>
    </>
  );
}

function MockTestsPage({ tests, status, error, dataSource, onRetry, onOpen }) {
  const groups = EXPECTED_LEVELS.map((level) => ({
    level,
    tests: tests.filter((test) => test.level === level),
  }));
  return (
    <>
      <PageHeading
        kicker="30 FULL PRACTICE PAPERS"
        title="Mock tests"
        copy="Ten Easy, ten Medium, and ten Challenging papers—each with the standard 80-question blueprint."
      >
        <button
          type="button"
          className="button secondary"
          onClick={() => window.print()}
        >
          <Printer size={16} /> Print list
        </button>
        <button
          type="button"
          className="button primary"
          disabled={status !== "ready"}
          onClick={() => onOpen()}
        >
          <ClipboardCheck size={16} /> Open test library
        </button>
      </PageHeading>
      {status === "error" ? (
        <section className="panel inline-error">
          <AlertCircle size={20} />
          <div>
            <strong>Testing database unavailable</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="button secondary" onClick={onRetry}>
            <RefreshCw size={15} /> Retry
          </button>
        </section>
      ) : null}
      <div className="mock-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">SYLLABUS-ALIGNED CATALOG</p>
              <h2>Difficulty collections</h2>
            </div>
            <span className="source-chip">
              <Database size={14} /> {dataSource}
            </span>
          </div>
          <div className="mock-groups">
            {groups.map((group) => (
              <article
                key={group.level}
                className={`mock-group ${group.level.toLowerCase()}`}
              >
                <div>
                  <span>{group.level.toUpperCase()}</span>
                  <h3>{group.tests.length || 10} full tests</h3>
                  <p>800 questions · 1,000 marks total</p>
                </div>
                <button
                  type="button"
                  disabled={!group.tests.length}
                  onClick={() => onOpen(group.tests[0]?.id)}
                >
                  Start first test <ArrowRight size={15} />
                </button>
              </article>
            ))}
          </div>
        </section>
        <section className="panel rank-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">LATEST RESULT</p>
              <h2>Rank list</h2>
            </div>
            <Award size={20} />
          </div>
          {RANKS.map(([name, marks, rank]) => (
            <div className="rank-row" key={name}>
              <b>{rank}</b>
              <span>{name}</span>
              <strong>{marks} / 100</strong>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function ProgressPage({ students }) {
  const average = Math.round(
    students.reduce((sum, student) => sum + student.progress, 0) /
      Math.max(1, students.length),
  );
  return (
    <>
      <PageHeading
        kicker="LEARNING ANALYTICS"
        title="Progress"
        copy="See performance by student and identify who needs help next."
      />
      <section className="metric-grid compact">
        <Metric
          icon={Activity}
          label="Average completion"
          value={`${average}%`}
          change="+6%"
          note="this month"
          color="teal"
        />
        <Metric
          icon={Award}
          label="Average mock score"
          value="78.4"
          change="+4.2"
          note="last 30 days"
          color="gold"
        />
        <Metric
          icon={AlertCircle}
          label="Needs attention"
          value={students.filter((student) => student.progress < 65).length}
          change="Priority"
          note="follow-up list"
          color="coral"
        />
        <Metric
          icon={Clock}
          label="Study time"
          value="18.6h"
          change="per learner"
          note="this month"
          color="ink"
        />
      </section>
      <div className="progress-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">SUBJECT PERFORMANCE</p>
              <h2>Average score</h2>
            </div>
          </div>
          <div className="subject-chart">
            {[
              ["Mental Ability", 82],
              ["Environmental Studies", 76],
              ["Arithmetic", 71],
              ["Language", 85],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <div>
                  <i style={{ width: `${value}%` }} />
                </div>
                <b>{value}%</b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel attention-list">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">ATTENTION LIST</p>
              <h2>Students to support</h2>
            </div>
          </div>
          {students
            .filter((student) => student.progress < 75)
            .map((student) => (
              <div key={student.id}>
                <div className="avatar">{student.initials}</div>
                <span>
                  <strong>{student.name}</strong>
                  <small>{student.batch}</small>
                </span>
                <b>{student.progress}%</b>
              </div>
            ))}
        </section>
      </div>
    </>
  );
}

function ParentsPage({ students }) {
  const [recipient, setRecipient] = useState("All parents");
  const [message, setMessage] = useState(
    "This week we are revising the JNVST Mental Ability pattern-completion section.",
  );
  const [sent, setSent] = useState([]);
  const sendMessage = (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    setSent((rows) => [
      { id: Date.now(), recipient, message: message.trim() },
      ...rows,
    ]);
    setMessage("");
  };
  return (
    <>
      <PageHeading
        kicker="PARENT COMMUNICATION"
        title="Parents"
        copy="Share preparation updates without leaving the institute workspace."
      />
      <div className="parent-layout">
        <form className="panel message-composer" onSubmit={sendMessage}>
          <div className="panel-heading">
            <div>
              <p className="section-kicker">NEW MESSAGE</p>
              <h2>Send an update</h2>
            </div>
            <Mail size={20} />
          </div>
          <label>
            Recipients
            <select
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
            >
              <option>All parents</option>
              {students.map((student) => (
                <option key={student.id}>
                  {student.guardian} · {student.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Message
            <textarea
              rows="6"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
          <button type="submit" className="button primary">
            <Send size={16} /> Send update
          </button>
        </form>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">COMMUNICATION LOG</p>
              <h2>Recent messages</h2>
            </div>
          </div>
          {sent.length ? (
            sent.map((item) => (
              <article className="message-row" key={item.id}>
                <MessageSquare size={17} />
                <div>
                  <strong>{item.recipient}</strong>
                  <p>{item.message}</p>
                  <time>Sent just now</time>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-panel">
              <MessageSquare size={24} />
              <p>Sent messages will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function SyllabusPage() {
  return (
    <>
      <PageHeading
        kicker="SUPPLIED DOCUMENT · UNCHANGED"
        title="JNVST Class 6 syllabus"
        copy="The application uses the same 2027 syllabus and exam structure; this screen makes every mapped component visible."
      />
      <section className="standard-banner">
        <div>
          <strong>{JNVST_STANDARD.questionsPerPaper}</strong>
          <span>questions</span>
        </div>
        <div>
          <strong>{JNVST_STANDARD.marksPerPaper}</strong>
          <span>marks</span>
        </div>
        <div>
          <strong>{JNVST_STANDARD.durationMinutes}</strong>
          <span>minutes</span>
        </div>
        <div>
          <strong>+{JNVST_STANDARD.marksPerCorrectAnswer}</strong>
          <span>correct answer</span>
        </div>
        <div>
          <strong>0</strong>
          <span>negative marking</span>
        </div>
        <div>
          <strong>OMR</strong>
          <span>offline mode</span>
        </div>
      </section>
      <div className="syllabus-grid">
        {JNVST_BLUEPRINT.map((section) => (
          <article className="panel syllabus-card" key={section.key}>
            <div className="syllabus-card-head">
              <span>{section.section}</span>
              <b>
                {section.questionCount} Q · {section.marks} marks ·{" "}
                {section.durationMinutes} min
              </b>
            </div>
            <h2>{section.subject}</h2>
            <div className="topic-chips">
              {section.topics.map(([topic]) => (
                <span key={topic}>{topic}</span>
              ))}
            </div>
            {section.key === "mental" ? (
              <p>
                Five parts × four questions:{" "}
                {MAT_SECTION_PLAN.map((item) => item.subtopic).join(" · ")}
              </p>
            ) : null}
            {section.key === "arithmetic" ? (
              <p>
                Detailed coverage:{" "}
                {ARITHMETIC_SECTION_PLAN.map((item) => item.subtopic).join(
                  " · ",
                )}
              </p>
            ) : null}
            {section.key === "language" ? (
              <p>
                Four passages × five questions: {LANGUAGE_SKILLS.join(" · ")}
              </p>
            ) : null}
            {section.key === "evs" ? (
              <p>
                15 standalone questions + one study passage with five questions;
                20 distinct topics per paper.
              </p>
            ) : null}
          </article>
        ))}
      </div>
      <section className="panel rule-panel">
        <ShieldCheck size={22} />
        <div>
          <h2>Exam rules retained</h2>
          <p>
            Section 1 qualifying mark: 14 · Arithmetic: 7 · Language: 7 ·
            Divyang candidates: 40 additional minutes · No negative marking.
          </p>
        </div>
      </section>
    </>
  );
}

function Metric({ icon: Icon, label, value, change, note, color }) {
  return (
    <div className={`metric-card ${color}`}>
      <div className="metric-icon">
        <Icon size={18} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <div>
        <em>{change}</em>
        <small>{note}</small>
      </div>
    </div>
  );
}
function Level({ name, count, range, color }) {
  return (
    <button className={`level-card ${color}`}>
      <div className="level-orbit">
        <strong>{count}</strong>
        <small>tests</small>
      </div>
      <div>
        <h3>{name}</h3>
        <p>{range}</p>
      </div>
      <ArrowUpRight size={17} />
    </button>
  );
}
function ActivityItem({ icon: Icon, title, detail, time }) {
  return (
    <div className="activity-item">
      <div className="activity-icon">
        <Icon size={16} />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <time>{time}</time>
    </div>
  );
}
function TimelineItem({ day, title, meta }) {
  return (
    <div className="timeline-item">
      <span>{day}</span>
      <div>
        <strong>{title}</strong>
        <p>{meta}</p>
      </div>
    </div>
  );
}

function FigureGraphic({ figure, size = 46 }) {
  const shape = figure?.shape || "circle";
  const rotation = Number(figure?.rotation || 0);
  const fill = figure?.fill === "light" ? "#d9eee8" : "none";
  const common = {
    fill,
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinejoin: "round",
  };
  const markCount = Math.min(24, Number(figure?.count || 0));
  const markGlyph =
    figure?.mark === "cross" ? "×" : figure?.mark === "line" ? "—" : "•";
  return (
    <svg
      className="figure-graphic"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={shape}
    >
      <g transform={`rotate(${rotation} 32 32)`}>
        {shape === "circle" ? (
          <circle cx="32" cy="32" r="18" {...common} />
        ) : null}
        {shape === "triangle" ? (
          <polygon points="32,10 55,51 9,51" {...common} />
        ) : null}
        {shape === "square" ? (
          <rect x="13" y="13" width="38" height="38" rx="2" {...common} />
        ) : null}
        {shape === "pentagon" ? (
          <polygon points="32,8 56,26 47,55 17,55 8,26" {...common} />
        ) : null}
        {shape === "hexagon" ? (
          <polygon points="18,8 46,8 59,32 46,56 18,56 5,32" {...common} />
        ) : null}
        {shape === "arrow" ? (
          <path d="M8 25h29V14l19 18-19 18V39H8Z" {...common} />
        ) : null}
      </g>
      {String(figure?.mark || "").includes("dot-left") ? (
        <circle cx="9" cy="32" r="3" fill="currentColor" />
      ) : null}
      {String(figure?.mark || "").includes("dot-right") ? (
        <circle cx="55" cy="32" r="3" fill="currentColor" />
      ) : null}
      {String(figure?.mark || "").includes("dot-top") ? (
        <circle cx="32" cy="8" r="3" fill="currentColor" />
      ) : null}
      {figure?.cornerMark === "dot-left" ? (
        <circle cx="10" cy="32" r="2.5" fill="currentColor" />
      ) : null}
      {figure?.cornerMark === "dot-right" ? (
        <circle cx="54" cy="32" r="2.5" fill="currentColor" />
      ) : null}
      {figure?.cornerMark === "dot-top" ? (
        <circle cx="32" cy="10" r="2.5" fill="currentColor" />
      ) : null}
      {figure?.cornerMark === "dot-bottom" ? (
        <circle cx="32" cy="54" r="2.5" fill="currentColor" />
      ) : null}
      {markCount > 0 ? (
        <text
          x="32"
          y="36"
          textAnchor="middle"
          fontSize={
            markCount > 16 ? 4.5 : markCount > 10 ? 6 : markCount > 7 ? 8 : 10
          }
          fontWeight="700"
          fill="currentColor"
        >
          {markGlyph.repeat(markCount)}
        </text>
      ) : null}
      {!markCount && figure?.mark === "dot" ? (
        <circle cx="32" cy="32" r="3" fill="currentColor" />
      ) : null}
      {!markCount && figure?.mark === "line" ? (
        <path d="M20 32h24" stroke="currentColor" strokeWidth="2.5" />
      ) : null}
      {!markCount && figure?.mark === "cross" ? (
        <path
          d="M24 24l16 16m0-16L24 40"
          stroke="currentColor"
          strokeWidth="2.5"
        />
      ) : null}
    </svg>
  );
}

function QuestionStimulus({ stimulus }) {
  if (stimulus.kind === "sequence")
    return (
      <div className="visual-stimulus sequence-stimulus">
        {stimulus.items.map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
        <b>?</b>
      </div>
    );
  if (stimulus.kind === "figure-sequence")
    return (
      <div className="visual-stimulus sequence-stimulus">
        {stimulus.items.map((figure, index) => (
          <FigureGraphic key={`${figure.shape}-${index}`} figure={figure} />
        ))}
        <b>?</b>
      </div>
    );
  if (stimulus.kind === "table")
    return (
      <div className="visual-stimulus data-stimulus">
        {stimulus.rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
    );
  if (stimulus.kind === "bar") {
    const maximum = Math.max(...stimulus.rows.map(([, value]) => value));
    return (
      <div className="visual-stimulus stimulus-chart" aria-label="Bar diagram">
        {stimulus.rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <i style={{ height: `${Math.round((value / maximum) * 100)}%` }} />
            <b>{value}</b>
          </div>
        ))}
      </div>
    );
  }
  if (stimulus.kind === "pictograph")
    return (
      <div
        className="visual-stimulus pictograph"
        aria-label={`Pictograph: one symbol represents ${stimulus.key} items`}
      >
        <strong>★ = {stimulus.key} items</strong>
        {stimulus.rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <b>{"★".repeat(value)}</b>
          </div>
        ))}
      </div>
    );
  return (
    <div className={`visual-stimulus single-stimulus ${stimulus.kind}`}>
      <FigureGraphic figure={stimulus.figure} size={62} />
      {stimulus.kind === "mirror" ? (
        <span className="mirror-line">MIRROR</span>
      ) : null}
      {stimulus.kind === "water" ? (
        <span className="water-line">WATER</span>
      ) : null}
    </div>
  );
}

function TestStudio({
  testCatalog,
  selectedTest,
  setSelectedTest,
  status,
  error,
  onRetry,
  close,
}) {
  const [levelFilter, setLevelFilter] = useState("All levels");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(new Set());
  const [bookmarked, setBookmarked] = useState(new Set());
  const [remainingSeconds, setRemainingSeconds] = useState(7200);
  const [submitted, setSubmitted] = useState(false);
  const testMap = useMemo(
    () => new Map(testCatalog.map((item) => [item.id, item])),
    [testCatalog],
  );
  const visibleTests = useMemo(
    () =>
      testCatalog.filter(
        (test) => levelFilter === "All levels" || test.level === levelFilter,
      ),
    [levelFilter, testCatalog],
  );
  const test = testMap.get(selectedTest);
  const question = test?.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const score = test
    ? test.questions.filter((item) => answers[item.questionId] === item.answer)
        .length
    : 0;
  const coverage = useMemo(
    () =>
      test
        ? Object.fromEntries(
            JNVST_BLUEPRINT.map((section) => [
              section.subject,
              new Set(
                test.questions
                  .filter((item) => item.subject === section.subject)
                  .flatMap((item) => item.coverageTopics || [item.topic]),
              ).size,
            ]),
          )
        : {},
    [test],
  );

  useEffect(() => {
    setCurrentIndex(0);
    setAnswers({});
    setChecked(new Set());
    setBookmarked(new Set());
    setRemainingSeconds(7200);
    setSubmitted(false);
  }, [selectedTest]);

  useEffect(() => {
    if (!test || submitted) return undefined;
    const timer = window.setInterval(
      () =>
        setRemainingSeconds((seconds) => {
          if (seconds <= 1) {
            setSubmitted(true);
            return 0;
          }
          return seconds - 1;
        }),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [submitted, test]);

  const openTest = (testId) => {
    setSelectedTest(testId);
  };

  const goTo = (index) => setCurrentIndex(Math.max(0, Math.min(79, index)));
  const formatTime = (seconds) =>
    `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const chooseOption = (optionId) => {
    if (!question || submitted) return;
    setAnswers((current) => ({ ...current, [question.questionId]: optionId }));
    setChecked((current) => {
      const next = new Set(current);
      next.delete(question.questionId);
      return next;
    });
  };
  const toggleChecked = () => {
    if (!question || !answers[question.questionId]) return;
    setChecked((current) => {
      const next = new Set(current);
      next.has(question.questionId)
        ? next.delete(question.questionId)
        : next.add(question.questionId);
      return next;
    });
  };
  const toggleBookmark = () =>
    question &&
    setBookmarked((current) => {
      const next = new Set(current);
      next.has(question.questionId)
        ? next.delete(question.questionId)
        : next.add(question.questionId);
      return next;
    });
  const revealAnswer =
    submitted || (question && checked.has(question.questionId));

  return (
    <div
      className={`catalog-overlay ${test ? "runner-mode" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="JNVST full practice tests"
    >
      <section className={`catalog-panel ${test ? "runner-panel" : ""}`}>
        <div className="catalog-header">
          <div>
            <p className="section-kicker">JNVST CLASS 6 · 2027</p>
            <h2>
              {test
                ? `${test.id} · ${test.level}`
                : "30 new full practice tests"}
            </h2>
            <p>
              {test
                ? `${test.subject} · 80 questions · 100 marks · 2 hours`
                : "10 Easy · 10 Medium · 10 Challenging · Testing database"}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={close}
            aria-label="Close test studio"
          >
            <X size={19} />
          </button>
        </div>

        {status === "loading" && testCatalog.length === 0 ? (
          <div className="catalog-state">
            <RefreshCw className="spin" size={25} />
            <h3>Loading the Testing database</h3>
            <p>Reading the authored and validated JNVST question module.</p>
          </div>
        ) : status === "error" ? (
          <div className="catalog-state error-state">
            <AlertCircle size={28} />
            <h3>Testing database could not be loaded</h3>
            <p>{error}</p>
            <button type="button" className="button primary" onClick={onRetry}>
              <RefreshCw size={15} /> Retry Testing
            </button>
          </div>
        ) : test && question ? (
          <div className="exam-runner">
            <aside className="exam-sidebar">
              <button
                type="button"
                className="runner-back"
                onClick={() => setSelectedTest(null)}
              >
                <ArrowLeft size={16} /> Back to library
              </button>
              <span className="runner-kicker">
                {test.level.toUpperCase()} FULL TEST
              </span>
              <h2>{test.title}</h2>
              <div className="coverage-proof">
                <ShieldCheck size={17} />
                <span>
                  Syllabus coverage: MAT {coverage["Mental Ability"]}/6 · EVS{" "}
                  {coverage["Environmental Studies"]}/20 · Arithmetic{" "}
                  {coverage.Arithmetic}/9 · Language {coverage.Language}/5
                </span>
              </div>
              <button
                type="button"
                className="runner-utility"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print complete paper
              </button>
              <button
                type="button"
                className="runner-utility accent"
                onClick={() => window.print()}
              >
                <FileText size={16} /> Save complete paper as PDF
              </button>
              <div className="runner-progress-meta">
                <span>
                  <b>{answeredCount}</b> answered
                </span>
                <time>{formatTime(remainingSeconds)}</time>
              </div>
              <div className="runner-progress">
                <span style={{ width: `${(answeredCount / 80) * 100}%` }} />
              </div>
              <div className="runner-sections">
                {JNVST_BLUEPRINT.map((section) => {
                  const first = test.questions.findIndex(
                    (item) => item.subject === section.subject,
                  );
                  return (
                    <button
                      type="button"
                      className={
                        question.subject === section.subject ? "active" : ""
                      }
                      key={section.key}
                      onClick={() => goTo(first)}
                    >
                      <span>{section.subject}</span>
                      <b>20</b>
                    </button>
                  );
                })}
              </div>
              <div
                className="question-palette"
                aria-label="Question navigation"
              >
                {test.questions.map((item, index) => (
                  <button
                    type="button"
                    aria-label={`Question ${index + 1}`}
                    className={`${index === currentIndex ? "current" : ""} ${answers[item.questionId] ? "answered" : "unanswered"} ${bookmarked.has(item.questionId) ? "bookmarked" : ""}`}
                    key={item.questionId}
                    onClick={() => goTo(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <div className="palette-legend">
                <span>
                  <i className="answered" /> Attempted
                </span>
                <span>
                  <i className="unanswered" /> Not attempted
                </span>
                <span>
                  <i className="current" /> Current
                </span>
              </div>
            </aside>
            <main className="exam-stage">
              <header className="runner-heading">
                <div>
                  <span>{question.subject.toUpperCase()}</span>
                  <h2>{question.topic}</h2>
                </div>
                <button
                  type="button"
                  className="submit-test"
                  onClick={() => setSubmitted(true)}
                >
                  {submitted ? "Test submitted" : "Submit test"}
                </button>
                <button
                  type="button"
                  className="runner-close"
                  onClick={close}
                  aria-label="Close test"
                >
                  <X size={19} />
                </button>
              </header>
              {submitted ? (
                <div className="result-strip">
                  <Check size={19} />
                  <div>
                    <strong>
                      {score} correct · {answeredCount} attempted
                    </strong>
                    <p>
                      Your current score is {score * 1.25} / 100 marks. Select
                      any palette number to review its answer.
                    </p>
                  </div>
                </div>
              ) : null}
              <article className="runner-question-card">
                <div className="runner-question-meta">
                  <span>QUESTION {currentIndex + 1} / 80</span>
                  <i>{test.level}</i>
                </div>
                {question.syllabusSubtopics?.length ? (
                  <p className="runner-syllabus-tag">
                    Syllabus skill · {question.syllabusSubtopics.join(", ")}
                  </p>
                ) : null}
                {question.passageId ? (
                  <div className="runner-passage">
                    <span>
                      {question.subject === "Language"
                        ? "READING PASSAGE"
                        : "EVS STUDY NOTES"}
                    </span>
                    <p>{question.passage}</p>
                  </div>
                ) : null}
                <h1>{question.text}</h1>
                {question.stimulus ? (
                  <QuestionStimulus stimulus={question.stimulus} />
                ) : null}
                <div className="runner-options">
                  {question.options.map((option) => {
                    const selected = answers[question.questionId] === option.id;
                    const correct =
                      revealAnswer && option.id === question.answer;
                    const incorrect =
                      revealAnswer && selected && option.id !== question.answer;
                    return (
                      <button
                        type="button"
                        disabled={submitted}
                        className={`${selected ? "selected" : ""} ${correct ? "correct" : ""} ${incorrect ? "incorrect" : ""}`}
                        key={option.id}
                        onClick={() => chooseOption(option.id)}
                      >
                        <span>{option.id}</span>
                        {option.figure ? (
                          <FigureGraphic figure={option.figure} size={64} />
                        ) : (
                          <strong>{option.label}</strong>
                        )}
                        {correct ? <Check size={18} /> : null}
                      </button>
                    );
                  })}
                </div>
                {revealAnswer ? (
                  <div className="runner-explanation">
                    <strong>Answer {question.answer}</strong>
                    <p>{question.explanation}</p>
                  </div>
                ) : null}
              </article>
              <footer className="runner-footer">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => goTo(currentIndex - 1)}
                >
                  <ArrowLeft size={19} /> Previous
                </button>
                <button
                  type="button"
                  className={bookmarked.has(question.questionId) ? "saved" : ""}
                  onClick={toggleBookmark}
                >
                  <Bookmark size={19} />{" "}
                  {bookmarked.has(question.questionId)
                    ? "Bookmarked"
                    : "Bookmark"}
                </button>
                <span />
                <button
                  type="button"
                  disabled={!answers[question.questionId]}
                  onClick={toggleChecked}
                >
                  {revealAnswer && !submitted ? "Hide answer" : "Check answer"}
                </button>
                <button
                  type="button"
                  className="next"
                  disabled={currentIndex === 79}
                  onClick={() => goTo(currentIndex + 1)}
                >
                  Next <ArrowRight size={19} />
                </button>
              </footer>
            </main>
            <div className="runner-print-bank" aria-hidden="true">
              {test.questions.map((item) => (
                <article key={`print-${item.questionId}`}>
                  <h3>
                    {item.questionNumber}. {item.text}
                  </h3>
                  {item.passageId ? <p>{item.passage}</p> : null}
                  <ol type="A">
                    {item.options.map((option) => (
                      <li key={option.id}>{option.label}</li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="exam-blueprint-banner">
              <ShieldCheck size={18} />
              <div>
                <strong>New validated Testing module</strong>
                <p>
                  Every paper contains newly authored questions: 20 Mental
                  Ability + 20 EVS + 20 Arithmetic + 20 Language.
                </p>
              </div>
            </div>
            <div className="catalog-toolbar">
              <div className="catalog-count">
                <strong>{visibleTests.length}</strong> full tests shown
              </div>
              <select
                aria-label="Filter tests by difficulty"
                value={levelFilter}
                onChange={(event) => setLevelFilter(event.target.value)}
              >
                <option>All levels</option>
                <option>Easy</option>
                <option>Medium</option>
                <option>Challenging</option>
              </select>
              <button
                type="button"
                className="button primary small"
                onClick={() => window.print()}
              >
                <Printer size={15} /> Print test list
              </button>
            </div>
            <div className="test-grid">
              {visibleTests.map((item) => (
                <button
                  type="button"
                  className={`test-tile ${item.level.toLowerCase()}`}
                  key={item.id}
                  onClick={() => openTest(item.id)}
                >
                  <div>
                    <span className="test-number">
                      {item.level.toUpperCase()} TEST{" "}
                      {String(item.categoryNumber || item.number).padStart(
                        2,
                        "0",
                      )}
                    </span>
                    <h3>{item.level}</h3>
                    <p>
                      80 questions · 100 marks · {item.topics?.length || 0}{" "}
                      topics
                    </p>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default App;

createRoot(document.getElementById("root")).render(<App />);
