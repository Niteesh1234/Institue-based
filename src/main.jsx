import { Component, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
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
  FileUp,
  GraduationCap,
  LayoutDashboard,
  LogIn,
  Mail,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shuffle,
  ShieldCheck,
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
import { EXAM_COURSES, getExamCourse } from "../exam-courses.js";
import { I18nProvider, LanguageSelector, useI18n } from "./i18n.jsx";
import {
  API_BASE_URL,
  IS_NATIVE_APP,
  authRequest,
  clearNativeSession,
} from "./api-client.js";
import { ResourcesPage, StudentResourcesPortal } from "./resources.jsx";
import { BatchExamsPage } from "./batch-exams.jsx";
import { createExamSet, EXAM_SET_CODES } from "../exam-set-engine.js";
import { HologramTutorPage } from "./hologram-tutor.jsx";
import {
  canPrintPapers,
  isPrincipalRole,
  PrincipalControlPage,
  useInstituteControlState,
} from "./institute-control.jsx";

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

const DEMO_STUDENTS = [
  { id: "demo-aarav", name: "Aarav Nair", initials: "AN", guardian: "Meera Nair", batch: "JNVST Morning A", progress: 86, state: "On track", tone: "green", last: "Today, 10:42" },
  { id: "demo-saanvi", name: "Saanvi Kumar", initials: "SK", guardian: "Rohan Kumar", batch: "JNVST Morning A", progress: 72, state: "On track", tone: "green", last: "Today, 09:18" },
  { id: "demo-jiya", name: "Jiya Lal", initials: "JL", guardian: "Mohan Lal", batch: "JNVST Evening B", progress: 48, state: "At risk", tone: "red", last: "Aug 18" },
  { id: "demo-rehan", name: "Rehan Malik", initials: "RM", guardian: "Sana Malik", batch: "JNVST Weekend", progress: 64, state: "Needs review", tone: "amber", last: "Yesterday" },
];

const STATIC_BANK_URL = `${import.meta.env.BASE_URL}generated`;
const EXPECTED_LEVELS = ["Easy", "Medium", "Challenging"];
const QUESTION_DATA_TIMEOUT_MS = 7000;
const BATCH_STORAGE_KEY = "vijetha-batches-v1";

function initialBatches() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(BATCH_STORAGE_KEY) || "null");
    return Array.isArray(saved) && saved.length ? saved.slice(0, 12) : BATCHES;
  } catch {
    return BATCHES;
  }
}

async function fetchQuestionResponse(url, signal) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = window.setTimeout(
    () => controller.abort(new Error("Question data request timed out.")),
    QUESTION_DATA_TIMEOUT_MS,
  );

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) {
      throw new Error(`Timed out while loading ${url}.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}

async function fetchQuestionData(staticPath, apiPath, signal) {
  let lastError;
  for (const url of [staticPath, `${API_BASE_URL}${apiPath}`]) {
    try {
      const response = await fetchQuestionResponse(url, signal);
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;
      lastError = new Error(payload.error || `Request failed with status ${response.status}.`);
    } catch (error) {
      if (error.name === "AbortError") throw error;
      lastError = error;
    }
  }
  throw lastError || new Error("Question data could not be loaded.");
}

async function openExternalLink(event, url) {
  if (!IS_NATIVE_APP) return;
  event.preventDefault();
  await Browser.open({ url });
}

function userInitials(name = "Vijetha User") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "VU";
}

function roleLabel(role) {
  return ["administrator", "principal"].includes(role)
    ? "Principal administrator"
    : role === "student"
      ? "Student"
      : "Institute teacher";
}

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

function parseStudentCsv(content, defaultBatch) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("The CSV must contain a header and at least one student.");
  const readRow = (line) => {
    const cells = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { cells.push(value.trim()); value = ""; }
      else value += char;
    }
    cells.push(value.trim());
    return cells;
  };
  const headers = readRow(lines[0]).map((item) => item.toLowerCase().replace(/[^a-z]/g, ""));
  const rows = lines.slice(1).map((line, index) => {
    const values = readRow(line);
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column] || ""]));
    const student = {
      name: row.name || row.studentname,
      email: row.email || row.studentemail || "",
      phone: row.phone || row.studentphone || "",
      guardian: row.guardian || row.guardianname || "Parent / Guardian",
      guardianEmail: row.guardianemail || "",
      guardianPhone: row.guardianphone || "",
      batch: row.batch || defaultBatch,
      progress: Number(row.progress || 0),
    };
    if (!student.name || student.name.length < 2) throw new Error(`Row ${index + 2} needs a valid student name.`);
    if (!student.batch) throw new Error(`Row ${index + 2} needs a batch.`);
    return student;
  });
  const names = rows.map((row) => row.name.toLowerCase().replace(/\s+/g, " ").trim());
  if (new Set(names).size !== names.length) throw new Error("The CSV contains duplicate student names.");
  return rows;
}

function validateFullCatalog(tests, course) {
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
    if (test.questionCount !== course.standard.questionsPerPaper)
      throw new Error(
        `${test.id} declares ${test.questionCount} questions; ${course.standard.questionsPerPaper} are required.`,
      );
    for (const section of course.blueprint) {
      const count = test.sectionCounts?.[section.subject] || 0;
      if (count !== section.questionCount)
        throw new Error(
          `${test.id} has ${count} ${section.subject} questions; ${section.questionCount} are required.`,
        );
    }
  }
}

const NAV_ITEMS = [
  ["Dashboard", LayoutDashboard],
  ["AI Holo Tutor", GraduationCap],
  ["Students", Users],
  ["Classes", CalendarDays],
  ["Mock Tests", ClipboardCheck],
  ["Batch Exams", ShieldCheck],
  ["Resources", FileText],
  ["Progress", BarChart3],
  ["Parents", MessageSquare],
  ["Syllabus", BookOpen],
];

const NAV_MESSAGE_KEYS = {
  Dashboard: "dashboard",
  "AI Holo Tutor": "aiHoloTutor",
  Students: "students",
  Classes: "classes",
  "Mock Tests": "mockTests",
  "Batch Exams": "batchExams",
  Resources: "resources",
  Progress: "progress",
  Parents: "parents",
  Syllabus: "syllabus",
  Settings: "settings",
  "Principal Control": "principalControl",
};

const LANDING_COPY = {
  en: {
    standards: "Exam standards", modules: "Modules",
    pill: "Three Class VI entrance course libraries",
    title: "One stop place for JNVST, AISSEE, and RMS preparation.",
    copy: "Manage students and classes, deliver 90 syllabus-aligned full tests, follow progress, and keep parents informed—from one focused institute portal.",
    open: "Open secure workspace", view: "View exam standard",
    tests: "full tests", records: "question records", blueprints: "exam blueprints",
    glance: "Preparation at a glance", official: "Each course keeps its own official structure.",
  },
  hi: {
    standards: "परीक्षा मानक", modules: "मॉड्यूल",
    pill: "कक्षा VI की तीन प्रवेश परीक्षा लाइब्रेरी",
    title: "JNVST, AISSEE और RMS की तैयारी के लिए एक ही स्थान।",
    copy: "विद्यार्थियों और कक्षाओं का प्रबंधन करें, 90 पाठ्यक्रम-अनुरूप पूर्ण टेस्ट संचालित करें, प्रगति देखें और अभिभावकों को सूचित रखें।",
    open: "सुरक्षित कार्यक्षेत्र खोलें", view: "परीक्षा मानक देखें",
    tests: "पूर्ण टेस्ट", records: "प्रश्न रिकॉर्ड", blueprints: "परीक्षा प्रारूप",
    glance: "तैयारी एक नज़र में", official: "हर पाठ्यक्रम अपना आधिकारिक प्रारूप बनाए रखता है।",
  },
  te: {
    standards: "పరీక్ష ప్రమాణాలు", modules: "మాడ్యూల్స్",
    pill: "ఆరవ తరగతికి మూడు ప్రవేశ పరీక్ష లైబ్రరీలు",
    title: "JNVST, AISSEE మరియు RMS సిద్ధతకు ఒకే చోట.",
    copy: "విద్యార్థులు, తరగతులను నిర్వహించండి; సిలబస్‌కు అనుగుణమైన 90 పూర్తి టెస్టులు అందించండి; పురోగతిని గమనించి తల్లిదండ్రులకు సమాచారం ఇవ్వండి.",
    open: "సురక్షిత వర్క్‌స్పేస్ తెరవండి", view: "పరీక్ష ప్రమాణాన్ని చూడండి",
    tests: "పూర్తి టెస్టులు", records: "ప్రశ్న రికార్డులు", blueprints: "పరీక్ష నమూనాలు",
    glance: "సిద్ధత ఒక చూపులో", official: "ప్రతి కోర్సు తన అధికారిక నిర్మాణాన్ని కొనసాగిస్తుంది.",
  },
};

function BrandLogo({ className = "" }) {
  return (
    <div className={`brand ${className}`.trim()} role="img" aria-label="Vijetha Institute Platform">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" role="presentation">
          <path d="M6.4 7.8h5.2L16 19.3l4.4-11.5h5.2L18.5 25h-5L6.4 7.8Z" />
          <path className="brand-ascent" d="M20.4 6.4h5.2v5.2" />
        </svg>
      </span>
      <span className="brand-lockup">
        <span className="brand-name">
          vijetha<span className="brand-dot">.</span>
        </span>
        <span className="brand-descriptor">Institute Platform</span>
      </span>
    </div>
  );
}

function App() {
  const { t, subject } = useI18n();
  const [stage, setStage] = useState("landing");
  const [authUser, setAuthUser] = useState(null);
  const [authConfigured, setAuthConfigured] = useState(null);
  const [active, setActive] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [studentRows, setStudentRows] = useState([]);
  const [studentStatus, setStudentStatus] = useState("idle");
  const [studentError, setStudentError] = useState("");
  const [studentReloadKey, setStudentReloadKey] = useState(0);
  const [batchRows, setBatchRows] = useState(initialBatches);
  const [instituteControl, setInstituteControl] = useInstituteControlState();
  const [fullTests, setFullTests] = useState([]);
  const [aggregation, setAggregation] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState("loading");
  const [catalogError, setCatalogError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [dataSource, setDataSource] = useState("Connecting to Testing");
  const [courseKey, setCourseKey] = useState("jnvst");
  const [testLoadStatus, setTestLoadStatus] = useState("idle");
  const [testLoadError, setTestLoadError] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [resourceUploadRequest, setResourceUploadRequest] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const course = getExamCourse(courseKey);
  const currentUser = authUser || { name: "Vijetha User", email: "", role: "teacher" };
  const principalAccess = isPrincipalRole(currentUser);
  const visibleNavItems = principalAccess
    ? [...NAV_ITEMS, ["Principal Control", ShieldCheck]]
    : NAV_ITEMS;
  const printAccess = canPrintPapers(currentUser, instituteControl);
  const studentAccessCode =
    new URLSearchParams(window.location.hash.slice(1)).get("studentAccess") ||
    new URLSearchParams(window.location.search).get("studentAccess");

  useEffect(() => {
    window.localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batchRows.slice(0, 12)));
  }, [batchRows]);

  useEffect(() => {
    if (!IS_NATIVE_APP) return undefined;
    Promise.allSettled([
      StatusBar.setOverlaysWebView({ overlay: false }),
      StatusBar.setBackgroundColor({ color: "#17242a" }),
      StatusBar.setStyle({ style: Style.Light }),
    ]).finally(() => SplashScreen.hide());
    return undefined;
  }, []);

  useEffect(() => {
    if (!IS_NATIVE_APP) return undefined;
    let listener;
    CapacitorApp.addListener("backButton", () => {
      if (studioOpen) {
        setStudioOpen(false);
        setSelectedTest(null);
      } else if (mobileOpen) {
        setMobileOpen(false);
      } else if (stage === "login") {
        setStage("landing");
      } else {
        CapacitorApp.minimizeApp();
      }
    }).then((handle) => { listener = handle; });
    return () => listener?.remove();
  }, [mobileOpen, stage, studioOpen]);

  const searchItems = useMemo(() => {
    const pages = [...visibleNavItems.map(([label]) => label), "Settings"].map(
      (label) => ({ label, detail: "Workspace page", destination: label }),
    );
    const students = studentRows.map((student) => ({
      label: student.name,
      detail: student.batch,
      destination: "Students",
    }));
    const batches = batchRows.map((batch) => ({
      label: batch.name,
      detail: batch.mentor,
      destination: "Classes",
    }));
    const query = searchQuery.trim().toLowerCase();
    if (!query) return pages.slice(0, 5);
    return [...pages, ...students, ...batches]
      .filter((item) =>
        `${item.label} ${item.detail}`.toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [batchRows, searchQuery, studentRows, visibleNavItems]);

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    if (!authUser) return undefined;
    if (authUser.demo) {
      setStudentRows(DEMO_STUDENTS);
      setStudentStatus("ready");
      setStudentError("");
      return undefined;
    }
    const controller = new AbortController();
    setStudentStatus("loading");
    setStudentError("");
    setStudentRows([]);
    authRequest(`/api/students?course=${encodeURIComponent(courseKey)}`, {
      method: "GET",
      signal: controller.signal,
    })
      .then((payload) => {
        setStudentRows(payload.students || []);
        setStudentStatus("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setStudentRows([]);
        setStudentStatus("error");
        setStudentError(error.message || "Students could not be loaded.");
      });
    return () => controller.abort();
  }, [authUser, courseKey, studentReloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    authRequest("/api/auth/session", { method: "GET", signal: controller.signal })
      .then((payload) => {
        setAuthConfigured(Boolean(payload.configured));
        if (payload.authenticated && payload.user) {
          setAuthUser(payload.user);
          setStage("portal");
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") setAuthConfigured(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadCatalog = async () => {
      setCatalogStatus("loading");
      setCatalogError("");
      setFullTests([]);
      setAggregation([]);
      try {
        const [catalogPayload, aggregationPayload] = await Promise.all([
          fetchQuestionData(
            `${STATIC_BANK_URL}/${courseKey}/catalog.json`,
            `/api/full-test-catalog?course=${courseKey}`,
            controller.signal,
          ),
          fetchQuestionData(
            `${STATIC_BANK_URL}/${courseKey}/aggregation.json`,
            `/api/question-aggregation?course=${courseKey}`,
            controller.signal,
          ),
        ]);
        const tests = normalizeFullCatalog(catalogPayload.tests || []);
        validateFullCatalog(tests, course);
        setFullTests(tests);
        setAggregation(aggregationPayload.aggregation || []);
        setDataSource(catalogPayload.source || `Testing.${courseKey}_questions`);
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
  }, [reloadKey, courseKey]);

  const loadTest = async (testId) => {
    if (!testId) return;
    const existing = fullTests.find((item) => item.id === testId);
    if (existing && existing.questions?.length === existing.questionCount) {
      setTestLoadStatus("ready");
      return;
    }
    setTestLoadStatus("loading");
    setTestLoadError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const payload = await fetchQuestionData(
        `${STATIC_BANK_URL}/${courseKey}/tests/${encodeURIComponent(testId)}.json`,
        `/api/full-test?course=${courseKey}&id=${encodeURIComponent(testId)}`,
        controller.signal,
      );
      const loaded = normalizeFullCatalog([payload.test])[0];
      if (!loaded) throw new Error(`${testId} was not found.`);
      if (loaded.questions.length !== course.standard.questionsPerPaper)
        throw new Error(
          `${testId} returned ${loaded.questions.length}/${course.standard.questionsPerPaper} questions.`,
        );
      setFullTests((current) =>
        current.map((item) => (item.id === testId ? loaded : item)),
      );
      setTestLoadStatus("ready");
    } catch (error) {
      setTestLoadStatus("error");
      setTestLoadError(
        error.name === "AbortError"
          ? "The request timed out. Please retry the test."
          : error.message || "Unable to load this full test.",
      );
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const openStudio = (testId = null) => {
    const requestedTestId = typeof testId === "string" ? testId : null;
    setStudioOpen(true);
    setSelectedTest(requestedTestId);
    if (requestedTestId) loadTest(requestedTestId);
  };
  const retryCatalog = () => setReloadKey((key) => key + 1);
  const navigateWorkspace = (destination) => {
    setActive(destination);
    setMobileOpen(false);
    setSearchOpen(false);
    setNotificationOpen(false);
    setAccountOpen(false);
  };
  const changeCourse = (nextCourse) => {
    setCourseKey(nextCourse);
    setSelectedTest(null);
    setStudioOpen(false);
    setFullTests([]);
    setAggregation([]);
    setWorkspaceOpen(false);
  };
  const completeLogin = (user) => {
    setAuthUser(user);
    setAuthConfigured(user?.demo ? false : true);
    setStage("portal");
  };
  const signOut = async () => {
    try { await authRequest("/api/auth/logout", { method: "POST", body: "{}" }); } catch { /* Clear local access even if the session already expired. */ }
    clearNativeSession();
    setAuthUser(null);
    setStudentRows([]);
    setStudentStatus("idle");
    setAccountOpen(false);
    setStudioOpen(false);
    setStage("landing");
  };

  if (studentAccessCode)
    return <StudentResourcesPortal accessCode={studentAccessCode} />;
  if (stage === "landing")
    return <LandingPage onLogin={() => setStage("login")} />;
  if (stage === "login")
    return (
      <LoginPage
        onBack={() => setStage("landing")}
        onLogin={completeLogin}
        configured={authConfigured}
      />
    );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <BrandLogo />
        <div className="workspace-switcher-wrap">
          <button
            type="button"
            className="workspace-switcher"
            aria-expanded={workspaceOpen}
            aria-haspopup="menu"
            onClick={() => setWorkspaceOpen((open) => !open)}
          >
            <div className="institute-avatar">{course.shortName.slice(0, 2)}</div>
            <div>
              <strong>{course.shortName} · {course.className}</strong>
              <small>Vijetha workspace</small>
            </div>
            <ChevronDown size={15} />
          </button>
          {workspaceOpen ? (
            <div className="workspace-menu" role="menu">
              {Object.values(EXAM_COURSES).map((item) => (
                <button
                  type="button"
                  role="menuitem"
                  key={item.key}
                  className={courseKey === item.key ? "active" : ""}
                  onClick={() => changeCourse(item.key)}
                >
                  <b>{item.shortName}</b>
                  <span>{item.standard.questionsPerPaper} {t("questions")}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <p className="nav-label">{t("workspace")}</p>
        <nav>
          {visibleNavItems.map(([label, Icon]) => (
            <button
              type="button"
              key={label}
              className={active === label ? "nav-item active" : "nav-item"}
              onClick={() => {
                navigateWorkspace(label);
              }}
            >
              <Icon size={18} />
              <span>{t(NAV_MESSAGE_KEYS[label])}</span>
              {label === "Mock Tests" && <span className="nav-badge">30</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="integrity">
            <BookOpen size={16} />
            <div>
              <strong>{t("examBlueprint")}</strong>
              <span>{course.shortName} · {course.year} {t("syllabus")}</span>
            </div>
          </div>
          <button
            type="button"
            className={active === "Settings" ? "nav-item active" : "nav-item"}
            onClick={() => navigateWorkspace("Settings")}
          >
            <Settings size={18} />
            <span>{t("settings")}</span>
          </button>
          <button
            type="button"
            className="profile profile-button"
            onClick={signOut}
          >
            <div className="avatar coral">{userInitials(currentUser.name)}</div>
            <div>
              <strong>{currentUser.name}</strong>
              <small>{t("signOut")}</small>
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
            <strong>{t(NAV_MESSAGE_KEYS[active] || active)}</strong>
          </div>
          <div className="top-actions">
            <LanguageSelector compact className="top-language-selector" />
            <div className="top-action-anchor search-anchor">
              <label className="search">
                <Search size={16} />
                <input
                  ref={searchRef}
                  aria-label={t("searchWorkspace")}
                  placeholder={t("searchAnything")}
                  value={searchQuery}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setSearchOpen(false);
                    if (event.key === "Enter" && searchItems[0]) {
                      navigateWorkspace(searchItems[0].destination);
                      setSearchQuery("");
                    }
                  }}
                />
                <kbd>⌘ K</kbd>
              </label>
              {searchOpen ? (
                <div className="top-popover search-results" role="listbox">
                  {searchItems.length ? (
                    searchItems.map((item) => (
                      <button
                        type="button"
                        role="option"
                        key={`${item.destination}-${item.label}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          navigateWorkspace(item.destination);
                          setSearchQuery("");
                        }}
                      >
                        <b>{item.label}</b>
                        <span>{item.detail}</span>
                      </button>
                    ))
                  ) : (
                    <p>No matching page, student, or class.</p>
                  )}
                </div>
              ) : null}
            </div>
            <div className="top-action-anchor">
              <button
                type="button"
                className="icon-button notification"
                aria-label="View notifications"
                aria-expanded={notificationOpen}
                onClick={() => {
                  setNotificationOpen((open) => !open);
                  setAccountOpen(false);
                }}
              >
                <Bell size={18} />
                <i />
              </button>
              {notificationOpen ? (
                <div className="top-popover notification-panel" role="status">
                  <strong>Notifications</strong>
                  <p>30 {course.shortName} full tests are ready.</p>
                  <p>{studentRows.filter((student) => student.progress < 70).length} students need a progress follow-up.</p>
                  <button type="button" onClick={() => navigateWorkspace("Progress")}>Open progress</button>
                </div>
              ) : null}
            </div>
            <div className="top-action-anchor">
              <button
                type="button"
                className="avatar coral account-trigger"
                aria-label="Open account menu"
                aria-expanded={accountOpen}
                onClick={() => {
                  setAccountOpen((open) => !open);
                  setNotificationOpen(false);
                }}
              >
                {userInitials(currentUser.name)}
              </button>
              {accountOpen ? (
                <div className="top-popover account-panel" role="menu">
                  <strong>{currentUser.name}</strong>
                  <span>{roleLabel(currentUser.role)} · {currentUser.email}</span>
                  <button type="button" role="menuitem" onClick={() => navigateWorkspace("Settings")}>Workspace settings</button>
                  <button type="button" role="menuitem" onClick={signOut}>Sign out</button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div className="page-wrap portal-page-wrap">
          <CourseTabs activeCourse={courseKey} onChange={changeCourse} />
          {active === "Dashboard" && (
            <DashboardPage
              course={course}
              students={studentRows}
              fullTests={fullTests}
              aggregation={aggregation}
              catalogStatus={catalogStatus}
              dataSource={dataSource}
              user={currentUser}
              onNavigate={navigateWorkspace}
              onOpenTests={openStudio}
            />
          )}
          {active === "AI Holo Tutor" && (
            <HologramTutorPage course={course} user={currentUser} />
          )}
          {active === "Students" && (
            <StudentsPage
              students={studentRows}
              setStudents={setStudentRows}
              status={studentStatus}
              error={studentError}
              onRetry={() => setStudentReloadKey((key) => key + 1)}
              course={course}
              batches={batchRows}
              demo={Boolean(currentUser.demo)}
            />
          )}
          {active === "Classes" && (
            <ClassesPage
              batches={batchRows}
              setBatches={setBatchRows}
              canManage={principalAccess}
              maxBatches={instituteControl.policies.maxBatches}
            />
          )}
          {active === "Mock Tests" && (
            <MockTestsPage
              course={course}
              tests={fullTests}
              status={catalogStatus}
              error={catalogError}
              dataSource={dataSource}
              onRetry={retryCatalog}
              onOpen={openStudio}
              canPrint={printAccess}
            />
          )}
          {active === "Batch Exams" && (
            <BatchExamsPage
              course={course}
              batches={batchRows}
              students={studentRows}
              tests={fullTests}
              user={currentUser}
              demo={Boolean(currentUser.demo)}
            />
          )}
          {active === "Resources" && (
            <ResourcesPage
              course={course}
              students={studentRows}
              demo={Boolean(currentUser.demo)}
              openUploadRequest={resourceUploadRequest}
              onOpenStudents={() => navigateWorkspace("Students")}
            />
          )}
          {active === "Progress" && <ProgressPage students={studentRows} />}
          {active === "Parents" && <ParentsPage students={studentRows} />}
          {active === "Syllabus" && <SyllabusPage course={course} />}
          {active === "Principal Control" && (
            <PrincipalControlPage
              user={currentUser}
              course={course}
              batches={batchRows}
              students={studentRows}
              control={instituteControl}
              setControl={setInstituteControl}
              onOpenBatchExams={() => navigateWorkspace("Batch Exams")}
              onOpenPdfUpload={() => {
                setResourceUploadRequest(Date.now());
                navigateWorkspace("Resources");
              }}
            />
          )}
          {active === "Settings" && (
            <SettingsPage course={course} onCourseChange={changeCourse} />
          )}
        </div>
      </main>

      {studioOpen && (
        <TestStudioBoundary onClose={() => setStudioOpen(false)}>
          <TestStudio
            course={course}
            testCatalog={fullTests}
            selectedTest={selectedTest}
            setSelectedTest={setSelectedTest}
            status={catalogStatus}
            error={catalogError}
            onRetry={retryCatalog}
            onLoadTest={loadTest}
            testLoadStatus={testLoadStatus}
            testLoadError={testLoadError}
            close={() => setStudioOpen(false)}
            canPrint={printAccess}
          />
        </TestStudioBoundary>
      )}
    </div>
  );
}

function CourseTabs({ activeCourse, onChange }) {
  const { t } = useI18n();
  return (
    <section className="course-tabs" aria-label="Entrance exam courses">
      <div>
        <span>{t("courseLibrary").toUpperCase()}</span>
        <strong>{t("chooseExam")}</strong>
      </div>
      {Object.values(EXAM_COURSES).map((item) => (
        <button
          type="button"
          key={item.key}
          className={activeCourse === item.key ? "active" : ""}
          onClick={() => onChange(item.key)}
        >
          <b>{item.shortName}</b>
          <small>{item.className} · {item.standard.questionsPerPaper} {t("questions")}</small>
        </button>
      ))}
    </section>
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
  const { locale, t } = useI18n();
  const copy = LANDING_COPY[locale] || LANDING_COPY.en;
  return (
    <main className="public-shell">
      <nav className="public-nav">
        <BrandLogo />
        <div>
          <LanguageSelector compact className="public-language-selector" />
          <a href="#standard">{copy.standards}</a>
          <a href="#features">{copy.modules}</a>
          <button
            type="button"
            className="button primary"
            onClick={onLogin}
            aria-label={t("instituteLogin")}
          >
            <span>{t("instituteLogin")}</span> <ArrowRight size={16} />
          </button>
        </div>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-pill">
            <ShieldCheck size={15} /> {copy.pill}
          </span>
          <h1>{copy.title}</h1>
          <p>{copy.copy}</p>
          <div className="hero-actions">
            <button
              type="button"
              className="button primary large"
              onClick={onLogin}
            >
              {copy.open} <ArrowRight size={18} />
            </button>
            <a className="button secondary large" href="#standard">
              {copy.view}
            </a>
          </div>
          <div className="hero-proof">
            <span>
              <strong>90</strong> {copy.tests}
            </span>
            <span>
              <strong>12,150</strong> {copy.records}
            </span>
            <span>
              <strong>3</strong> {copy.blueprints}
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
              <small>MULTI-EXAM CONTROL ROOM</small>
              <h2>{copy.glance}</h2>
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
      <section className="admissions-feature" aria-labelledby="admissions-title">
        <div className="admissions-feature-copy">
          <span>{t("admissionsOpen")}</span>
          <h2 id="admissions-title">{t("admissionsCopy")}</h2>
          <div>
            <a className="button primary large" href="tel:+919701817953">
              <Phone size={17} /> {t("callAdmissions")}
            </a>
            <a className="button secondary large" href="https://www.sreevijetha.com" target="_blank" rel="noreferrer" onClick={(event) => openExternalLink(event, "https://www.sreevijetha.com")}>
              {t("visitSchool")} <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
        <a className="admissions-banner" href="https://www.sreevijetha.com" target="_blank" rel="noreferrer" onClick={(event) => openExternalLink(event, "https://www.sreevijetha.com")}>
          <img
            src="/vijetha-admissions-banner.jpg"
            alt={t("admissionsBannerAlt")}
            width="1536"
            height="1024"
            loading="lazy"
            decoding="async"
          />
        </a>
      </section>
      <section className="public-standard" id="standard">
        <p>{copy.blueprints.toUpperCase()}</p>
        <h2>{copy.official}</h2>
        <div>
          {Object.values(EXAM_COURSES).map((item) => (
            <article key={item.key}>
              <span>{item.className} · {item.year}</span>
              <h3>{item.shortName}</h3>
              <strong>
                {item.standard.questionsPerPaper} {t("questions")} · {item.standard.marksPerPaper} {t("marks")}
              </strong>
              <p>{item.standard.durationMinutes} {t("minutes")} · 30 {copy.tests}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="feature-strip" id="features">
        {[
          ["students", Users],
          ["classes", CalendarDays],
          ["mockTests", ClipboardCheck],
          ["progress", BarChart3],
          ["parents", MessageSquare],
          ["syllabus", BookOpen],
        ].map(([key, Icon]) => (
          <div key={key}>
            <Icon size={20} />
            <strong>{t(key)}</strong>
          </div>
        ))}
      </section>
    </main>
  );
}

function LoginPage({ onBack, onLogin, configured }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const resetMessages = () => { setError(""); setNotice(""); };
  const changeMode = (nextMode) => {
    resetMessages();
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setMode(nextMode);
  };
  const headings = {
    login: ["Welcome back.", "Sign in with your verified Vijetha account."],
    register: ["Create your account.", "Your email must be verified before workspace access is granted."],
    verify: ["Verify your email.", `Enter the six-digit code sent to ${email}.`],
    forgot: ["Reset your password.", "Enter your verified email to receive a reset code."],
    reset: ["Choose a new password.", `Enter the code sent to ${email}, then create a new password.`],
  };
  const [title, copy] = headings[mode];

  const submit = async (event) => {
    event.preventDefault();
    resetMessages();
    if (["register", "reset"].includes(mode) && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const payload = await authRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
        onLogin(payload.user);
      } else if (mode === "register") {
        const payload = await authRequest("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
        setNotice(payload.message);
        setMode("verify");
        setPassword("");
        setConfirmPassword("");
      } else if (mode === "verify") {
        const payload = await authRequest("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ email, code, purpose: "verify-email" }) });
        onLogin(payload.user);
      } else if (mode === "forgot") {
        const payload = await authRequest("/api/auth/request-otp", { method: "POST", body: JSON.stringify({ email, purpose: "reset-password" }) });
        setNotice(payload.message);
        setMode("reset");
      } else if (mode === "reset") {
        const payload = await authRequest("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ email, code, purpose: "reset-password", newPassword: password }) });
        onLogin(payload.user);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    resetMessages();
    setBusy(true);
    try {
      const payload = await authRequest("/api/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email, purpose: mode === "reset" ? "reset-password" : "verify-email" }),
      });
      setNotice(payload.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-shell">
      <button type="button" className="login-back" onClick={onBack}>
        <ArrowLeft size={16} /> {t("backToWebsite")}
      </button>
      <form
        className="login-card"
        onSubmit={submit}
      >
        <BrandLogo className="login-brand" />
        <LanguageSelector className="login-language-selector" />
        <p className="section-kicker">{t("secureWorkspace").toUpperCase()}</p>
        <h1>{mode === "login" ? t("welcomeBack") : title}</h1>
        <p>{mode === "login" ? t("welcomeCopy") : copy}</p>
        {mode === "register" ? (
          <label>
            Full name
            <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength="2" maxLength="80" required />
          </label>
        ) : null}
        {!["verify", "reset"].includes(mode) ? (
          <label>
            {t("email")}
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength="254" required />
          </label>
        ) : (
          <div className="auth-email-chip"><Mail size={15} /> {email}</div>
        )}
        {["login", "register", "reset"].includes(mode) ? (
          <label>
            {mode === "reset" ? "New password" : t("password")}
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength="10"
              maxLength="128"
              required
            />
            {mode !== "login" ? <em>10+ characters with uppercase, lowercase, and a number.</em> : null}
          </label>
        ) : null}
        {["register", "reset"].includes(mode) ? (
          <label>
            Confirm password
            <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength="10" maxLength="128" required />
          </label>
        ) : null}
        {["verify", "reset"].includes(mode) ? (
          <label>
            Six-digit email code
            <input className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
          </label>
        ) : null}
        {error ? <div className="auth-alert error" role="alert"><AlertCircle size={17} /><span>{error}</span></div> : null}
        {notice ? <div className="auth-alert success" role="status"><Check size={17} /><span>{notice}</span></div> : null}
        <button type="submit" className="button primary large" disabled={busy || configured === false}>
          {busy ? <RefreshCw className="spin" size={17} /> : mode === "register" ? <UserPlus size={17} /> : mode === "verify" ? <ShieldCheck size={17} /> : <LogIn size={17} />}
          {busy ? "Please wait" : mode === "login" ? t("signInSecurely") : mode === "register" ? t("createAccount") : mode === "verify" ? "Verify and continue" : mode === "forgot" ? "Send reset code" : "Reset password"}
        </button>
        {configured === false ? (
          <button
            type="button"
            className="button demo-access-button"
            onClick={() => onLogin({ id: "public-demo", name: "Amara Khan", email: "demo@vijetha.in", role: "administrator", demo: true })}
          >
            <ArrowRight size={17} /> {t("continueDemo")}
          </button>
        ) : null}
        {["verify", "reset"].includes(mode) ? <button type="button" className="auth-text-button" onClick={resendCode} disabled={busy}>Resend email code</button> : null}
        {mode === "login" ? (
          <div className="auth-links">
            <button type="button" onClick={() => changeMode("forgot")}>{t("forgotPassword")}</button>
            <button type="button" onClick={() => changeMode("register")}>{t("createAccount")}</button>
          </div>
        ) : (
          <button type="button" className="auth-text-button" onClick={() => changeMode("login")}>Back to sign in</button>
        )}
        <small><ShieldCheck size={13} /> {t("securityNotice")}</small>
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
  course,
  user,
  students,
  fullTests,
  aggregation,
  catalogStatus,
  dataSource,
  onNavigate,
  onOpenTests,
}) {
  const { t, subject } = useI18n();
  return (
    <>
      <PageHeading
        kicker={`${course.shortName} ${course.className.toUpperCase()} · ${course.year} PREPARATION`}
        title={t("goodMorning", { name: user.name.split(" ")[0] })}
        copy={t("attentionCopy")}
      >
        <button
          type="button"
          className="button secondary"
          onClick={() => window.print()}
        >
          <Printer size={16} /> {t("printOverview")}
        </button>
        <button type="button" className="button primary" onClick={() => onOpenTests()}>
          <CircleHelp size={16} /> {t("openFullTests")}
        </button>
      </PageHeading>
      <section className="metric-grid">
        <Metric
          icon={Users}
          label={t("activeStudents")}
          value={students.length}
          change={`3 ${t("batches")}`}
          note={t("inPreparation")}
          color="teal"
        />
        <Metric
          icon={BookOpen}
          label={`${course.shortName} syllabus`}
          value="100%"
          change={String(course.year)}
          note={t("officialTopicMap")}
          color="coral"
        />
        <Metric
          icon={ClipboardCheck}
          label={t("openFullTests")}
          value={catalogStatus === "ready" ? fullTests.length : "—"}
          change={t("perLevel")}
          note={t("questionsEach", { count: course.standard.questionsPerPaper })}
          color="gold"
        />
        <Metric
          icon={Zap}
          label={t("questionRecords")}
          value={catalogStatus === "ready" ? (30 * course.standard.questionsPerPaper).toLocaleString("en-IN") : "—"}
          change={`30 ${t("papers")}`}
          note={t("syllabusAlignedBank")}
          color="ink"
        />
      </section>
      <div className="portal-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">{t("studentPulse").toUpperCase()}</p>
              <h2>{t("progressOverview")}</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigate("Students")}
            >
              {t("manageStudents")} <ArrowUpRight size={15} />
            </button>
          </div>
          <StudentTable
            students={students}
            actions={(student) => (
              <button
                type="button"
                className="row-menu"
                aria-label={`Manage ${student.name}`}
                onClick={() => onNavigate("Students")}
              >
                <MoreHorizontal size={17} />
              </button>
            )}
          />
        </section>
        <section className="panel testing-card">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">{t("testingDatabase").toUpperCase()}</p>
              <h2>{t("fullTestLibrary")}</h2>
            </div>
            <Database size={20} />
          </div>
          <p className="panel-copy">
            {catalogStatus === "ready"
              ? `Live from ${dataSource}.`
              : "Connect the Testing database to load the catalog."}{" "}
            {t("paperContains")} {course.blueprint.map((section) => `${section.questionCount} ${subject(section.subject)}`).join(" + ")}.
          </p>
          <div className="level-grid">
            <Level
              name={t("easy")}
              count={
                fullTests.filter((test) => test.level === "Easy").length || "—"
              }
              range={`${course.standard.questionsPerPaper} ${t("questions")} · ${course.standard.marksPerPaper} ${t("marks")}`}
              color="mint"
              onClick={() =>
                onOpenTests(
                  fullTests.find((test) => test.level === "Easy")?.id,
                )
              }
              disabled={!fullTests.some((test) => test.level === "Easy")}
            />
            <Level
              name={t("medium")}
              count={
                fullTests.filter((test) => test.level === "Medium").length ||
                "—"
              }
              range={`${course.standard.questionsPerPaper} ${t("questions")} · ${course.standard.marksPerPaper} ${t("marks")}`}
              color="peach"
              onClick={() =>
                onOpenTests(
                  fullTests.find((test) => test.level === "Medium")?.id,
                )
              }
              disabled={!fullTests.some((test) => test.level === "Medium")}
            />
            <Level
              name={t("challenging")}
              count={
                fullTests.filter((test) => test.level === "Challenging")
                  .length || "—"
              }
              range={`${course.standard.questionsPerPaper} ${t("questions")} · ${course.standard.marksPerPaper} ${t("marks")}`}
              color="lemon"
              onClick={() =>
                onOpenTests(
                  fullTests.find((test) => test.level === "Challenging")?.id,
                )
              }
              disabled={!fullTests.some(
                (test) => test.level === "Challenging",
              )}
            />
          </div>
          <div className="library-footer">
            <div className="set-label">
              <span>{t("questionsLoaded")}</span>
              <b>
                {aggregation.reduce(
                  (total, item) => total + item.questionCount,
                  0,
                ) || "—"}
              </b>
            </div>
            <div className="integrity-inline">
              <ShieldCheck size={15} /> {t("structureLocked")}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function StudentTable({ students, actions }) {
  const { t } = useI18n();
  const localizedState = (state) => ({
    "On track": t("onTrack"),
    "At risk": t("atRisk"),
    "Needs review": t("needsReview"),
  })[state] || state;
  return (
    <div className={`student-table${actions ? " has-actions" : ""}`}>
      <div className="table-head">
        <span>{t("student")}</span>
        <span>{t("batch")}</span>
        <span>{t("completion")}</span>
        <span>{t("status")}</span>
        <span>{t("lastActive")}</span>
        <span />
      </div>
      {students.map((student) => (
        <div className="student-row" key={student.id}>
          <div className="student-name">
            <div className="avatar">{student.initials}</div>
            <div>
              <strong>{student.name}</strong>
              {student.email || student.phone ? (
                <small>{student.email || student.phone}</small>
              ) : null}
            </div>
          </div>
          <span className="muted">{student.batch}</span>
          <div className="completion">
            <div className="progress-track">
              <span style={{ width: `${student.progress}%` }} />
            </div>
            <b>{student.progress}%</b>
          </div>
          <span className={`status ${student.tone}`}>{localizedState(student.state)}</span>
          <span className="muted last-active">{student.last}</span>
          {actions ? actions(student) : <MoreHorizontal size={17} />}
        </div>
      ))}
    </div>
  );
}

function StudentsPage({
  students,
  setStudents,
  status,
  error,
  onRetry,
  course,
  batches,
  demo,
}) {
  const courseBatches = useMemo(() => {
    const matching = batches
      .map((batch) => batch.name)
      .filter((name) => name.toLowerCase().startsWith(course.shortName.toLowerCase()));
    return matching.length
      ? matching
      : [
          `${course.shortName} Morning A`,
          `${course.shortName} Evening B`,
          `${course.shortName} Weekend`,
        ];
  }, [batches, course.shortName]);
  const newForm = () => ({
    name: "",
    email: "",
    phone: "",
    guardian: "",
    guardianEmail: "",
    guardianPhone: "",
    batch: courseBatches[0],
    progress: 0,
  });
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(newForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef(null);

  useEffect(() => {
    setQuery("");
    setFormOpen(false);
    setEditingId(null);
    setDeleteId(null);
    setForm(newForm());
  }, [course.key]);

  const filteredStudents = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return students;
    return students.filter((student) =>
      [student.name, student.batch, student.guardian, student.email, student.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(clean),
    );
  }, [query, students]);

  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setFormError("");
    setForm(newForm());
  };
  const startEdit = (student) => {
    setEditingId(student.id);
    setForm({
      name: student.name,
      email: student.email || "",
      phone: student.phone || "",
      guardian: student.guardian || "Parent / Guardian",
      guardianEmail: student.guardianEmail || "",
      guardianPhone: student.guardianPhone || "",
      batch: student.batch,
      progress: student.progress,
    });
    setFormError("");
    setDeleteId(null);
    setFormOpen(true);
  };
  const saveStudent = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (demo) {
        const progress = Math.max(0, Math.min(100, Math.round(Number(form.progress) || 0)));
        const demoStudent = {
          ...form,
          progress,
          id: editingId || `demo-student-${Date.now()}`,
          initials: userInitials(form.name),
          state: progress >= 70 ? "On track" : progress >= 50 ? "Needs review" : "At risk",
          tone: progress >= 70 ? "green" : progress >= 50 ? "amber" : "red",
          last: "Just now",
        };
        setStudents((rows) => (
          editingId
            ? rows.map((row) => row.id === editingId ? demoStudent : row)
            : [...rows, demoStudent].sort((a, b) => a.name.localeCompare(b.name))
        ));
        closeForm();
        return;
      }
      const path = editingId
        ? `/api/students?id=${encodeURIComponent(editingId)}`
        : "/api/students";
      const payload = await authRequest(path, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({ ...form, progress: Number(form.progress), course: course.key }),
      });
      setStudents((rows) =>
        editingId
          ? rows.map((row) => (row.id === editingId ? payload.student : row))
          : [...rows, payload.student].sort((a, b) => a.name.localeCompare(b.name)),
      );
      closeForm();
    } catch (requestError) {
      setFormError(requestError.message || "The student could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const removeStudent = async (student) => {
    setDeleting(true);
    setFormError("");
    try {
      if (!demo) {
        await authRequest(`/api/students?id=${encodeURIComponent(student.id)}`, {
          method: "DELETE",
        });
      }
      setStudents((rows) => rows.filter((row) => row.id !== student.id));
      setDeleteId(null);
      if (editingId === student.id) closeForm();
    } catch (requestError) {
      setFormError(requestError.message || "The student could not be removed.");
    } finally {
      setDeleting(false);
    }
  };
  const importStudents = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setFormError("");
    try {
      const rows = parseStudentCsv(await file.text(), courseBatches[0]);
      if (students.length + rows.length > 500) throw new Error("A course roster can contain at most 500 students.");
      if (demo) {
        const imported = rows.map((row, index) => {
          const progress = Math.max(0, Math.min(100, Math.round(Number(row.progress) || 0)));
          return {
            ...row,
            id: `demo-import-${Date.now()}-${index}`,
            initials: userInitials(row.name),
            state: progress >= 70 ? "On track" : progress >= 50 ? "Needs review" : "At risk",
            tone: progress >= 70 ? "green" : progress >= 50 ? "amber" : "red",
            progress,
            last: "Just now",
          };
        });
        setStudents((current) => [...current, ...imported].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const created = [];
        for (const row of rows) {
          const payload = await authRequest("/api/students", {
            method: "POST",
            body: JSON.stringify({ ...row, course: course.key }),
          });
          created.push(payload.student);
        }
        setStudents((current) => [...current, ...created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setFormError(`${rows.length} students imported successfully.`);
    } catch (requestError) {
      setFormError(requestError.message || "The student CSV could not be imported.");
    } finally {
      setImporting(false);
    }
  };
  return (
    <>
      <PageHeading
        kicker="STUDENT MANAGEMENT"
        title="Students"
        copy={`Add, update, and monitor every ${course.shortName} learner.`}
      >
        <div className="student-toolbar">
          <label className="student-search">
            <Search size={16} />
            <span className="sr-only">Search students</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search students"
            />
          </label>
          <button
            type="button"
            className="button primary"
            onClick={() => {
              setEditingId(null);
              setForm(newForm());
              setFormError("");
              setDeleteId(null);
              setFormOpen(true);
            }}
          >
            <UserPlus size={16} /> Add student
          </button>
          <input ref={importRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={importStudents} />
          <button type="button" className="button secondary" disabled={importing} onClick={() => importRef.current?.click()}>
            {importing ? <RefreshCw className="spin" size={16} /> : <FileUp size={16} />} {importing ? "Importing…" : "Import CSV"}
          </button>
          <a className="button secondary roster-template-link" href="/student-import-template.csv" download>CSV template</a>
        </div>
      </PageHeading>
      {formError && !formOpen ? <div className={`control-notice ${formError.includes("successfully") ? "" : "error"}`} role="status">{formError.includes("successfully") ? <Check size={16} /> : <AlertCircle size={16} />}{formError}</div> : null}
      {formOpen ? (
        <section className="panel student-form-panel" aria-label={editingId ? "Edit student" : "Add student"}>
          <div className="panel-heading compact-heading">
            <div>
              <span>{editingId ? "EDIT STUDENT" : "NEW STUDENT"}</span>
              <h2>{editingId ? `Update ${form.name}` : `Add a ${course.shortName} learner`}</h2>
            </div>
            <button type="button" className="icon-button" aria-label="Close student form" onClick={closeForm}>
              <X size={17} />
            </button>
          </div>
          <form className="student-form" onSubmit={saveStudent}>
            <div className="form-grid student-form-grid">
              <label>
                Student name <span>Required</span>
                <input required minLength={2} maxLength={80} value={form.name} onChange={(event) => updateField("name", event.target.value)} />
              </label>
              <label>
                Batch <span>Required</span>
                <select required value={form.batch} onChange={(event) => updateField("batch", event.target.value)}>
                  {!courseBatches.includes(form.batch) && <option value={form.batch}>{form.batch}</option>}
                  {courseBatches.map((batch) => <option key={batch} value={batch}>{batch}</option>)}
                </select>
              </label>
              <label>
                Student email <span>Optional</span>
                <input type="email" maxLength={254} value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="student@example.com" />
              </label>
              <label>
                Student phone <span>Optional</span>
                <input type="tel" maxLength={20} value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+91 98765 43210" />
              </label>
              <label>
                Guardian name <span>Required</span>
                <input required minLength={2} maxLength={80} value={form.guardian} onChange={(event) => updateField("guardian", event.target.value)} />
              </label>
              <label>
                Completion <span>{form.progress}%</span>
                <input type="range" min="0" max="100" value={form.progress} onChange={(event) => updateField("progress", event.target.value)} />
              </label>
              <label>
                Guardian email <span>Optional</span>
                <input type="email" maxLength={254} value={form.guardianEmail} onChange={(event) => updateField("guardianEmail", event.target.value)} placeholder="guardian@example.com" />
              </label>
              <label>
                Guardian phone <span>Optional</span>
                <input type="tel" maxLength={20} value={form.guardianPhone} onChange={(event) => updateField("guardianPhone", event.target.value)} placeholder="+91 98765 43210" />
              </label>
            </div>
            {formError ? <div className="auth-alert error" role="alert"><AlertCircle size={15} /> {formError}</div> : null}
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={closeForm} disabled={saving}>Cancel</button>
              <button type="submit" className="button primary" disabled={saving}>
                {saving ? <RefreshCw className="spin" size={16} /> : <Check size={16} />}
                {saving ? "Saving…" : editingId ? "Save changes" : "Add student"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
      <section className="panel">
        {status === "loading" ? (
          <div className="student-state"><RefreshCw className="spin" size={24} /><strong>Loading students…</strong><span>Fetching this course roster securely.</span></div>
        ) : status === "error" ? (
          <div className="student-state error-state"><AlertCircle size={24} /><strong>Students could not be loaded</strong><span>{error}</span><button type="button" className="button secondary" onClick={onRetry}>Try again</button></div>
        ) : filteredStudents.length ? (
          <StudentTable
            students={filteredStudents}
            actions={(student) => (
              <div className="row-actions">
                {deleteId === student.id ? (
                  <div className="delete-confirm" role="group" aria-label={`Confirm removal of ${student.name}`}>
                    <button type="button" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</button>
                    <button type="button" onClick={() => removeStudent(student)} disabled={deleting}>{deleting ? "Removing…" : "Delete"}</button>
                  </div>
                ) : (
                  <>
                    <button type="button" aria-label={`Edit ${student.name}`} onClick={() => startEdit(student)}><Pencil size={15} /></button>
                    <button type="button" aria-label={`Remove ${student.name}`} onClick={() => { setDeleteId(student.id); setFormError(""); }}><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            )}
          />
        ) : (
          <div className="student-state">
            <Users size={26} />
            <strong>{query ? "No matching students" : `No ${course.shortName} students yet`}</strong>
            <span>{query ? "Try a different name, batch, guardian, email, or phone." : "Use Add student to create the first learner record."}</span>
          </div>
        )}
      </section>
    </>
  );
}

function ClassesPage({ batches, setBatches, canManage, maxBatches = 12 }) {
  const emptyForm = {
    name: "",
    mentor: "",
    students: 0,
    schedule: "Mon–Fri · 7:00 AM",
    next: "Mental Ability · Pattern Completion",
  };
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedName, setSelectedName] = useState("");
  const [formError, setFormError] = useState("");
  const selectedBatch = batches.find((batch) => batch.name === selectedName);
  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const createBatch = (event) => {
    event.preventDefault();
    setFormError("");
    if (!canManage) {
      setFormError("Only the principal administrator can create batches.");
      return;
    }
    if (batches.length >= maxBatches) {
      setFormError(`The institute limit is ${maxBatches} batches.`);
      return;
    }
    const cleanName = form.name.trim();
    const cleanMentor = form.mentor.trim();
    if (!cleanName || !cleanMentor) return;
    const uniqueName = batches.some(
      (batch) => batch.name.toLowerCase() === cleanName.toLowerCase(),
    )
      ? `${cleanName} ${batches.length + 1}`
      : cleanName;
    setBatches((current) => [
      ...current,
      {
        ...form,
        name: uniqueName,
        mentor: cleanMentor,
        students: Number(form.students) || 0,
      },
    ]);
    setForm(emptyForm);
    setFormOpen(false);
    setSelectedName(uniqueName);
  };
  return (
    <>
      <PageHeading
        kicker="BATCHES & SCHEDULE"
        title="Classes"
        copy={`Keep teaching plans connected to the syllabus. ${batches.length} of ${maxBatches} batches are in use.`}
      >
        {canManage ? (
          <button
            type="button"
            className="button primary"
            aria-expanded={formOpen}
            disabled={batches.length >= maxBatches}
            onClick={() => { setFormError(""); setFormOpen((open) => !open); }}
          >
            <Plus size={16} /> {batches.length >= maxBatches ? "12-batch limit reached" : "Create batch"}
          </button>
        ) : null}
      </PageHeading>
      {formOpen ? (
        <form className="panel batch-form" onSubmit={createBatch}>
          <div className="panel-heading">
            <div>
              <p className="section-kicker">NEW CLASS</p>
              <h2>Create a teaching batch</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close create batch form"
              onClick={() => setFormOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Batch name
              <input required value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="AISSEE Evening A" />
            </label>
            <label>
              Mentor
              <input required value={form.mentor} onChange={(event) => updateField("mentor", event.target.value)} placeholder="Mentor name" />
            </label>
            <label>
              Students
              <input type="number" min="0" value={form.students} onChange={(event) => updateField("students", event.target.value)} />
            </label>
            <label>
              Schedule
              <input required value={form.schedule} onChange={(event) => updateField("schedule", event.target.value)} />
            </label>
            <label className="form-span">
              Next lesson
              <input required value={form.next} onChange={(event) => updateField("next", event.target.value)} />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" className="button primary"><Plus size={15} /> Save batch</button>
          </div>
          {formError ? <div className="auth-alert error" role="alert"><AlertCircle size={15} /> {formError}</div> : null}
        </form>
      ) : null}
      {selectedBatch ? (
        <section className="panel batch-detail" aria-live="polite">
          <div>
            <p className="section-kicker">SELECTED CLASS</p>
            <h2>{selectedBatch.name}</h2>
            <p>{selectedBatch.mentor} · {selectedBatch.students} students · {selectedBatch.schedule}</p>
            <strong>Next lesson: {selectedBatch.next}</strong>
          </div>
          <div className="form-actions">
            {canManage ? (
              <button
                type="button"
                className="button secondary danger-button"
                onClick={() => {
                  setBatches((current) => current.filter((batch) => batch.name !== selectedBatch.name));
                  setSelectedName("");
                }}
              >
                <Trash2 size={15} /> Remove batch
              </button>
            ) : null}
            <button type="button" className="icon-button" aria-label="Close class details" onClick={() => setSelectedName("")}><X size={18} /></button>
          </div>
        </section>
      ) : null}
      <div className="batch-grid">
        {batches.map((batch) => (
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
            <button
              type="button"
              className="button secondary"
              onClick={() => setSelectedName(batch.name)}
            >
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
        {batches.map((batch, index) => (
          <div className="schedule-row" key={batch.name}>
            <time>{batch.schedule.split(" · ").join(" ")}</time>
            <strong>{batch.next}</strong>
            <span>{batch.name}</span>
            <b>{batch.mentor}</b>
          </div>
        ))}
      </section>
    </>
  );
}

function SettingsPage({ course, onCourseChange }) {
  const [instituteName, setInstituteName] = useState("Vijetha Institute");
  const [email, setEmail] = useState("admin@vijetha.in");
  const [saved, setSaved] = useState(false);
  const saveSettings = (event) => {
    event.preventDefault();
    setSaved(true);
  };
  return (
    <>
      <PageHeading
        kicker="WORKSPACE PREFERENCES"
        title="Settings"
        copy="Manage the demo institute identity and default entrance-exam workspace."
      />
      <form className="panel settings-form" onSubmit={saveSettings}>
        <div className="panel-heading">
          <div>
            <p className="section-kicker">GENERAL</p>
            <h2>Institute workspace</h2>
          </div>
          {saved ? <span className="save-confirmation"><Check size={14} /> Saved</span> : null}
        </div>
        <div className="form-grid">
          <label>
            Institute name
            <input required value={instituteName} onChange={(event) => { setInstituteName(event.target.value); setSaved(false); }} />
          </label>
          <label>
            Administrator email
            <input type="email" required value={email} onChange={(event) => { setEmail(event.target.value); setSaved(false); }} />
          </label>
          <label>
            Default course
            <select value={course.key} onChange={(event) => onCourseChange(event.target.value)}>
              {Object.values(EXAM_COURSES).map((item) => <option key={item.key} value={item.key}>{item.shortName} · {item.className}</option>)}
            </select>
          </label>
          <label>
            Test delivery
            <select defaultValue="OMR practice runner">
              <option>OMR practice runner</option>
              <option>Printable paper</option>
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setInstituteName("Vijetha Institute");
              setEmail("admin@vijetha.in");
              setSaved(false);
            }}
          >
            Reset
          </button>
          <button type="submit" className="button primary"><Check size={15} /> Save settings</button>
        </div>
      </form>
    </>
  );
}

function MockTestsPage({ course, tests, status, error, dataSource, onRetry, onOpen, canPrint }) {
  const groups = EXPECTED_LEVELS.map((level) => ({
    level,
    tests: tests.filter((test) => test.level === level),
  }));
  return (
    <>
      <PageHeading
        kicker={`${course.shortName} · 30 FULL PRACTICE PAPERS`}
        title={`${course.shortName} mock tests`}
        copy={`Ten Easy, ten Medium, and ten Challenging papers—each following the ${course.standard.questionsPerPaper}-question ${course.shortName} Class VI blueprint.`}
      >
        {canPrint ? (
          <button
            type="button"
            className="button secondary"
            onClick={() => window.print()}
          >
            <Printer size={16} /> Print list
          </button>
        ) : null}
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
                  <p>{(course.standard.questionsPerPaper * 10).toLocaleString("en-IN")} questions · {(course.standard.marksPerPaper * 10).toLocaleString("en-IN")} marks total</p>
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
          value={students.filter((student) => student.progress < 70).length}
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
            .filter((student) => student.progress < 70)
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

function SyllabusPage({ course }) {
  const marksPerQuestion = new Set(
    course.blueprint.map((section) => section.marks / section.questionCount),
  );
  return (
    <>
      <PageHeading
        kicker={course.sourceType.toUpperCase()}
        title={`${course.shortName} ${course.className} syllabus`}
        copy={course.coverageNote}
      />
      <section className="standard-banner">
        <div>
          <strong>{course.standard.questionsPerPaper}</strong>
          <span>questions</span>
        </div>
        <div>
          <strong>{course.standard.marksPerPaper}</strong>
          <span>marks</span>
        </div>
        <div>
          <strong>{course.standard.durationMinutes}</strong>
          <span>minutes</span>
        </div>
        <div>
          <strong>{marksPerQuestion.size === 1 ? `+${[...marksPerQuestion][0]}` : "Variable"}</strong>
          <span>correct answer</span>
        </div>
        <div>
          <strong>{course.standard.negativeMarking}</strong>
          <span>negative marking</span>
        </div>
        <div>
          <strong>OMR</strong>
          <span>offline mode</span>
        </div>
      </section>
      <div className="syllabus-grid">
        {course.blueprint.map((section) => (
          <article className="panel syllabus-card" key={section.key}>
            <div className="syllabus-card-head">
              <span>{section.section}</span>
              <b>
                {section.questionCount} Q · {section.marks} marks
              </b>
            </div>
            <h2>{section.subject}</h2>
            <div className="topic-chips">
              {section.topics.map(([topic]) => (
                <span key={topic}>{topic}</span>
              ))}
            </div>
            {course.key === "jnvst" && section.key === "mental" ? (
              <p>
                Five parts × four questions:{" "}
                {MAT_SECTION_PLAN.map((item) => item.subtopic).join(" · ")}
              </p>
            ) : null}
            {course.key === "jnvst" && section.key === "arithmetic" ? (
              <p>
                Detailed coverage:{" "}
                {ARITHMETIC_SECTION_PLAN.map((item) => item.subtopic).join(
                  " · ",
                )}
              </p>
            ) : null}
            {course.key === "jnvst" && section.key === "language" ? (
              <p>
                Four passages × five questions: {LANGUAGE_SKILLS.join(" · ")}
              </p>
            ) : null}
            {course.key === "jnvst" && section.key === "evs" ? (
              <p>
                15 standalone questions + one study passage with five questions;
                20 distinct topics per paper.
              </p>
            ) : null}
          </article>
        ))}
      </div>
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
function Level({ name, count, range, color, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={`level-card ${color}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`Open ${name} full tests`}
    >
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
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
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

function ExamSetDialog({ mode, selectedSet, preparing, onSelect, onClose, onConfirm }) {
  const { t } = useI18n();
  if (!mode) return null;
  const isPdf = mode === "pdf";

  return (
    <div
      className="exam-set-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="exam-set-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-set-dialog-title"
      >
        <header>
          <div className="exam-set-dialog-icon">
            {isPdf ? <FileText size={22} /> : <Printer size={22} />}
          </div>
          <div>
            <span>{t("secureExamSets")}</span>
            <h2 id="exam-set-dialog-title">{t("chooseExamSet")}</h2>
            <p>{isPdf ? t("saveSetHelp") : t("printSetHelp")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("closeExamSetDialog")}>
            <X size={19} />
          </button>
        </header>

        <div className="exam-set-grid" aria-label={t("chooseExamSet")}>
          {EXAM_SET_CODES.map((setCode) => (
            <button
              type="button"
              className={selectedSet === setCode ? "selected" : ""}
              aria-pressed={selectedSet === setCode}
              onClick={() => onSelect(setCode)}
              key={setCode}
            >
              <span>{t("set")}</span>
              <strong>{setCode}</strong>
              <i>{t("uniqueOrder")}</i>
              {selectedSet === setCode ? <Check size={17} /> : null}
            </button>
          ))}
        </div>

        <div className="exam-set-assurance">
          <ShieldCheck size={21} />
          <div>
            <strong>{t("sameValidatedPaper")}</strong>
            <p>{t("examSetAssurance")}</p>
          </div>
        </div>

        <div className="exam-set-features">
          <span><Shuffle size={15} /> {t("questionsShuffled")}</span>
          <span><Shuffle size={15} /> {t("optionsShuffled")}</span>
          <span><ShieldCheck size={15} /> {t("answersRemapped")}</span>
        </div>

        <footer>
          <button type="button" className="exam-set-cancel" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="exam-set-confirm"
            disabled={preparing}
            onClick={() => onConfirm(selectedSet, mode)}
          >
            {preparing ? <RefreshCw className="spin" size={17} /> : isPdf ? <FileText size={17} /> : <Printer size={17} />}
            {preparing
              ? t("preparingPaper")
              : isPdf
                ? t("saveSetPdf", { set: selectedSet })
                : t("printSet", { set: selectedSet })}
          </button>
        </footer>
      </section>
    </div>
  );
}

function PrintPaper({ course, test, setCode }) {
  const { locale, t, text, subject } = useI18n();
  const negativeMarking = Number(course.standard.negativeMarking || 0);
  const printPattern = course.printPattern || {};
  const printSections = printPattern.sections || course.blueprint.map((section) => ({
    section: section.section,
    subject: section.subject,
    questions: section.questionCount,
    marksEach: section.marks / section.questionCount,
    marks: section.marks,
    duration: section.durationMinutes ? `${section.durationMinutes} min` : "—",
    qualifying: "—",
  }));
  const instructions = (printPattern.instructions || [
    "Attempt every question and mark only one option for each question.",
    "Use the response sheet at the end of this paper for your final responses.",
    `Each section follows the published ${course.shortName} Class VI paper structure.`,
  ]).map((instruction) => text(instruction));
  const responsePageSize = test.questions.length > 125 ? 100 : test.questions.length;
  const responsePages = Array.from(
    { length: Math.ceil(test.questions.length / responsePageSize) },
    (_, pageIndex) =>
      test.questions.slice(
        pageIndex * responsePageSize,
        (pageIndex + 1) * responsePageSize,
      ),
  );

  return (
    <div className="runner-print-bank" aria-hidden="true" data-exam-set={setCode}>
      <header className="print-paper-header">
        <div>
          <span>VIJETHA INSTITUTE · {t("fullTest").toUpperCase()}</span>
          <h1>{course.name}</h1>
          <p>{course.className} · {course.year} · {t("practiceEdition")} · {locale.toUpperCase()}</p>
        </div>
        <div className="print-paper-code">
          <strong>{test.id}</strong>
          <b aria-label={`${t("bookletCode")} ${setCode}`}>{setCode}</b>
          <span>{t(test.level.toLowerCase())}</span>
        </div>
      </header>

      <section className="print-candidate-fields">
        <span>{t("candidateName")}: ______________________________</span>
        <span>{t("rollNumber")}: __________________</span>
        <span>{t("bookletCode")}: <strong>{setCode}</strong></span>
        <span>{t("candidateSignature")}: ______________________</span>
        <span>{t("invigilatorSignature")}: __________________</span>
        <span>{t("date")}: ________________</span>
      </section>

      <section className="print-paper-summary">
        <div><strong>{test.questionCount}</strong><span>{t("questions")}</span></div>
        <div><strong>{test.totalMarks}</strong><span>{t("marks")}</span></div>
        <div><strong>{test.durationMinutes} min</strong><span>{t("minutes")}</span></div>
        <div><strong>{negativeMarking ? `−${negativeMarking}` : t("none")}</strong><span>{t("negativeMarking")}</span></div>
      </section>

      <section className="print-instructions">
        <h2>{t("instructions")}</h2>
        <ol>
          {instructions.map((instruction) => (
            <li key={instruction}>{instruction}</li>
          ))}
        </ol>
      </section>

      <table className="print-section-table">
        <thead>
          <tr>
            <th>{t("section")}</th><th>{t("subject")}</th><th>{t("range")}</th><th>{t("questions")}</th>
            <th>{t("marksEach")}</th><th>{t("marks")}</th><th>{t("duration")}</th><th>{t("qualifying")}</th>
          </tr>
        </thead>
        <tbody>
          {printSections.map((section) => (
            <tr key={`${section.section}-${section.subject}`}>
              <td>{section.section}</td>
              <td>{subject(section.subject)}</td>
              <td>{section.range || "—"}</td>
              <td>{section.questions}</td>
              <td>{section.marksEach}</td>
              <td>{section.marks}</td>
              <td>{section.duration}</td>
              <td>{section.qualifying}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="print-practice-notice">
        {t("practiceNotice")}
      </p>

      {course.blueprint.map((section) => {
        const questions = test.questions.filter(
          (item) => item.subject === section.subject,
        );
        return (
          <section className="print-question-section" key={section.key}>
            <header>
              <span>{section.section}</span>
              <h2>{subject(section.subject)}</h2>
              <p>
                {t("question")} {questions[0]?.questionNumber}–{questions.at(-1)?.questionNumber}
                {" · "}{section.questionCount} {t("questions")} · {section.marks} {t("marks")} · {setCode}
              </p>
            </header>
            {questions.map((item, index) => {
              const previous = questions[index - 1];
              const showPassage =
                item.passageId && item.passageId !== previous?.passageId;
              return (
                <article
                  className="print-question"
                  data-question-id={item.questionId}
                  key={item.questionId}
                >
                  {showPassage ? (
                    <div className="print-passage">
                      <strong>{t("instructions")}</strong>
                      <p>{item.passage}</p>
                    </div>
                  ) : null}
                  <div className="print-question-heading">
                    <b>{item.questionNumber}.</b>
                    <div>
                      <h3>{item.text}</h3>
                      <small>{item.topicLabel || text(item.topic)}</small>
                    </div>
                    <em>{item.marks || 1} mark{Number(item.marks || 1) === 1 ? "" : "s"}</em>
                  </div>
                  {item.stimulus ? (
                    <QuestionStimulus stimulus={item.stimulus} />
                  ) : null}
                  <ol className="print-options" type="A">
                    {item.options.map((option) => (
                      <li key={option.id}>
                        {option.figure ? (
                          <FigureGraphic figure={option.figure} size={42} />
                        ) : (
                          option.label
                        )}
                      </li>
                    ))}
                  </ol>
                </article>
              );
            })}
          </section>
        );
      })}

      {responsePages.map((responseQuestions, pageIndex) => (
        <section className="print-answer-sheet" key={`response-page-${pageIndex + 1}`}>
          <header>
            <span>{t("responseSheet").toUpperCase()} · OMR</span>
            <h2>{course.shortName} · {test.id} · {setCode}</h2>
            <p>
              {t("responseSheetHelp")}
              {responsePages.length > 1
                ? ` Sheet ${pageIndex + 1} of ${responsePages.length} · Questions ${responseQuestions[0].questionNumber}–${responseQuestions.at(-1).questionNumber}`
                : ""}
            </p>
          </header>
          <div>
            {responseQuestions.map((item) => (
              <span key={`response-${item.questionId}`}>
                <b>{item.questionNumber}</b> ○ A&nbsp;&nbsp;○ B&nbsp;&nbsp;○ C&nbsp;&nbsp;○ D
              </span>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TestStudio({
  course,
  testCatalog,
  selectedTest,
  setSelectedTest,
  status,
  error,
  onRetry,
  onLoadTest,
  testLoadStatus,
  testLoadError,
  close,
  canPrint,
}) {
  const { locale, t, text, subject, test: localizeTest } = useI18n();
  const [levelFilter, setLevelFilter] = useState("All levels");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [bookmarked, setBookmarked] = useState(new Set());
  const [remainingSeconds, setRemainingSeconds] = useState(
    course.standard.durationMinutes * 60,
  );
  const [submitted, setSubmitted] = useState(false);
  const [printPreparing, setPrintPreparing] = useState(false);
  const [printDialogMode, setPrintDialogMode] = useState(null);
  const [selectedPrintSet, setSelectedPrintSet] = useState("A");
  const [activePrintSet, setActivePrintSet] = useState("A");
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
  const sourceTest = testMap.get(selectedTest);
  const test = useMemo(
    () => (sourceTest ? localizeTest(sourceTest) : sourceTest),
    [sourceTest, localizeTest, locale],
  );
  const printableTest = useMemo(
    () => (test ? createExamSet(test, activePrintSet, course.blueprint) : test),
    [activePrintSet, course.blueprint, test],
  );
  const question = test?.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const score = test
    ? test.questions.reduce(
        (total, item) =>
          total + (answers[item.questionId] === item.answer ? item.marks || 1 : 0),
        0,
      )
    : 0;
  const coverage = useMemo(
    () =>
      test
        ? Object.fromEntries(
            course.blueprint.map((section) => [
              section.subject,
              new Set(
                test.questions
                  .filter((item) => item.subject === section.subject)
                  .flatMap((item) => item.coverageTopics || [item.topic]),
              ).size,
            ]),
          )
        : {},
    [course, test],
  );

  useEffect(() => {
    setCurrentIndex(0);
    setAnswers({});
    setBookmarked(new Set());
    setRemainingSeconds(course.standard.durationMinutes * 60);
    setSubmitted(false);
    setPrintDialogMode(null);
    setSelectedPrintSet("A");
    setActivePrintSet("A");
  }, [course, selectedTest]);

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
    onLoadTest(testId);
  };

  const goTo = (index) =>
    setCurrentIndex(
      Math.max(0, Math.min(course.standard.questionsPerPaper - 1, index)),
    );
  const formatTime = (seconds) =>
    `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const chooseOption = (optionId) => {
    if (!question || submitted) return;
    setAnswers((current) => ({ ...current, [question.questionId]: optionId }));
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
  const printCompletePaper = async (setCode, mode) => {
    if (printPreparing || !canPrint) return;
    setActivePrintSet(setCode);
    setPrintDialogMode(null);
    setPrintPreparing(true);
    const originalTitle = document.title;
    const printableTitle = `${course.shortName}-${test.id}-SET-${setCode}-${locale.toUpperCase()}-${mode === "pdf" ? "PDF" : "Print"}`;
    let restored = false;
    const restoreTitle = () => {
      if (restored) return;
      restored = true;
      document.title = originalTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };

    try {
      document.title = printableTitle;
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.all(
        [...document.images].map((image) =>
          image.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
              }),
        ),
      );
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.addEventListener("afterprint", restoreTitle, { once: true });
      window.print();
      window.setTimeout(restoreTitle, 60000);
    } finally {
      setPrintPreparing(false);
    }
  };
  const revealAnswer = submitted;

  useEffect(() => {
    document.body.classList.toggle("print-runner-active", Boolean(test));
    return () => document.body.classList.remove("print-runner-active");
  }, [test]);

  return (
    <div
      className={`catalog-overlay ${test ? "runner-mode" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${course.shortName} full practice tests`}
    >
      <section className={`catalog-panel ${test ? "runner-panel" : ""}`}>
        <div className="catalog-header">
          <div>
            <p className="section-kicker">{course.shortName} {course.className.toUpperCase()} · {course.year}</p>
            <h2>
              {test
                ? `${test.id} · ${test.level}`
                : t("newFullPracticeTests", { count: 30 })}
            </h2>
            <p>
              {test
                ? `${test.subject} · ${test.questionCount} questions · ${test.totalMarks} marks · ${test.durationMinutes} minutes`
                : t("levelSummary")}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={close}
            aria-label={t("closeTestStudio")}
          >
            <X size={19} />
          </button>
        </div>

        {status === "loading" ? (
          <div className="catalog-state">
            <RefreshCw className="spin" size={25} />
            <h3>{t("loadingDatabase")}</h3>
            <p>{t("readingQuestionModule", { course: course.shortName })}</p>
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
        ) : selectedTest && (!question || testLoadStatus === "loading") ? (
          <div className={`catalog-state ${testLoadStatus === "error" ? "error-state" : ""}`}>
            {testLoadStatus === "error" ? <AlertCircle size={28} /> : <RefreshCw className="spin" size={25} />}
            <h3>{testLoadStatus === "error" ? "This full test could not be loaded" : t("loadingFullTest", { course: course.shortName })}</h3>
            <p>{testLoadStatus === "error" ? testLoadError : t("validatingQuestions", { count: course.standard.questionsPerPaper })}</p>
            {testLoadStatus === "error" ? (
              <button type="button" className="button primary" onClick={() => onLoadTest(selectedTest)}>
                <RefreshCw size={15} /> Retry test
              </button>
            ) : null}
          </div>
        ) : test && question ? (
          <div className="exam-runner">
            <aside className="exam-sidebar">
              <button
                type="button"
                className="runner-back"
                onClick={() => setSelectedTest(null)}
              >
                <ArrowLeft size={16} /> {t("backToLibrary")}
              </button>
              <LanguageSelector compact className="runner-language-selector" />
              <span className="runner-kicker">
                {t(test.level.toLowerCase()).toUpperCase()} {t("fullTest").toUpperCase()}
              </span>
              <h2>{course.shortName} {t(test.level.toLowerCase())} {t("fullTest")} {test.categoryNumber || test.number}</h2>
              <div className="coverage-proof">
                <ShieldCheck size={17} />
                <span>
                  {t("syllabus")}: {course.blueprint.map((section) => `${subject(section.subject)} ${coverage[section.subject] || 0}`).join(" · ")}
                </span>
              </div>
              {canPrint ? (
                <>
                  <button
                    type="button"
                    className="runner-utility"
                    onClick={() => setPrintDialogMode("print")}
                    disabled={printPreparing}
                  >
                    <Printer size={16} /> {printPreparing ? t("preparingPaper") : t("printComplete")}
                  </button>
                  <button
                    type="button"
                    className="runner-utility accent"
                    onClick={() => setPrintDialogMode("pdf")}
                    disabled={printPreparing}
                  >
                    <FileText size={16} /> {printPreparing ? t("preparingPaper") : t("savePdf")}
                  </button>
                  <p className="runner-print-help">{t("printSettings")}</p>
                </>
              ) : (
                <div className="runner-print-locked"><ShieldCheck size={16} /> Printing is controlled by the principal.</div>
              )}
              <div className="runner-progress-meta">
                <span>
                  <b>{answeredCount}</b> {t("answered")}
                </span>
                <time>{formatTime(remainingSeconds)}</time>
              </div>
              <div className="runner-progress">
                <span style={{ width: `${(answeredCount / test.questionCount) * 100}%` }} />
              </div>
              <div className="runner-sections">
                {course.blueprint.map((section) => {
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
                      <span>{subject(section.subject)}</span>
                      <b>{section.questionCount}</b>
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
                    aria-label={`${t("question")} ${index + 1}`}
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
                  <i className="answered" /> {t("attempted")}
                </span>
                <span>
                  <i className="unanswered" /> {t("notAttempted")}
                </span>
                <span>
                  <i className="current" /> {t("current")}
                </span>
              </div>
            </aside>
            <main className="exam-stage">
              <header className="runner-heading">
                <div>
                  <span>{(question.subjectLabel || subject(question.subject)).toUpperCase()}</span>
                  <h2>{question.topicLabel || text(question.topic)}</h2>
                </div>
                <button
                  type="button"
                  className="submit-test"
                  onClick={() => setSubmitted(true)}
                >
                  {submitted ? t("submitTest") : t("submitTest")}
                </button>
                <button
                  type="button"
                  className="runner-close"
                  onClick={close}
                  aria-label={t("closeTest")}
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
                      Your current score is {score} / {test.totalMarks} marks. Select
                      any palette number to review its answer.
                    </p>
                  </div>
                </div>
              ) : null}
              <article className="runner-question-card">
                <div className="runner-question-meta">
                  <span>{t("question").toUpperCase()} {currentIndex + 1} / {test.questionCount}</span>
                  <i>{t(test.level.toLowerCase())}</i>
                </div>
                {question.syllabusSubtopics?.length ? (
                  <p className="runner-syllabus-tag">
                    {t("syllabusSkill")} · {question.syllabusSubtopics.map((item) => text(item)).join(", ")}
                  </p>
                ) : null}
                {question.localization?.retainedLanguageSubject ? (
                  <p className="runner-language-note">{t("retainedLanguage")}</p>
                ) : null}
                {question.passageId ? (
                  <div className="runner-passage">
                    <span>
                      {question.subject === "Language"
                        ? t("readingPassage").toUpperCase()
                        : t("evsStudyNotes").toUpperCase()}
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
                    <strong>{t("answer")} {question.answer}</strong>
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
                  <ArrowLeft size={19} /> {t("previous")}
                </button>
                <button
                  type="button"
                  className={bookmarked.has(question.questionId) ? "saved" : ""}
                  onClick={toggleBookmark}
                >
                  <Bookmark size={19} />{" "}
                  {bookmarked.has(question.questionId)
                    ? t("bookmarked")
                    : t("bookmark")}
                </button>
                <span />
                {!submitted ? <small className="answer-policy-note">Answers are checked only after final submission.</small> : null}
                <button
                  type="button"
                  className="next"
                  disabled={currentIndex === test.questionCount - 1}
                  onClick={() => goTo(currentIndex + 1)}
                >
                  {t("next")} <ArrowRight size={19} />
                </button>
              </footer>
            </main>
            {canPrint ? (
              <>
                <ExamSetDialog
                  mode={printDialogMode}
                  selectedSet={selectedPrintSet}
                  preparing={printPreparing}
                  onSelect={setSelectedPrintSet}
                  onClose={() => setPrintDialogMode(null)}
                  onConfirm={printCompletePaper}
                />
                <PrintPaper course={course} test={printableTest} setCode={activePrintSet} />
              </>
            ) : null}
          </div>
        ) : (
          <>
            <div className="exam-blueprint-banner">
              <ShieldCheck size={18} />
              <div>
                <strong>{t("fullTestModule")}</strong>
                <p>
                  {t("paperContains")} {course.blueprint.map((section) => `${section.questionCount} ${subject(section.subject)}`).join(" + ")}.
                </p>
              </div>
            </div>
            <div className="catalog-toolbar">
              <div className="catalog-count">
                <strong>{visibleTests.length}</strong> {t("testsShown")}
              </div>
              <select
                aria-label={t("filterDifficulty")}
                value={levelFilter}
                onChange={(event) => setLevelFilter(event.target.value)}
              >
                <option value="All levels">{t("allLevels")}</option>
                <option value="Easy">{t("easy")}</option>
                <option value="Medium">{t("medium")}</option>
                <option value="Challenging">{t("challenging")}</option>
              </select>
              {canPrint ? (
                <button
                  type="button"
                  className="button primary small"
                  onClick={() => window.print()}
                >
                  <Printer size={15} /> {t("printTestList")}
                </button>
              ) : null}
            </div>
            {visibleTests.length > 0 ? (
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
                        {t(item.level.toLowerCase()).toUpperCase()} {t("test").toUpperCase()}{" "}
                        {String(item.categoryNumber || item.number).padStart(
                          2,
                          "0",
                        )}
                      </span>
                      <h3>{t(item.level.toLowerCase())}</h3>
                      <p>
                        {item.questionCount} {t("questions")} · {item.totalMarks} {t("marks")} · {item.topics?.length || 0}{" "}
                        {t("topics")}
                      </p>
                    </div>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="catalog-state error-state" role="status">
                <AlertCircle size={28} />
                <h3>No full tests are available for this filter</h3>
                <p>
                  Refresh the validated {course.shortName} catalog or choose a different difficulty.
                </p>
                <button type="button" className="button primary" onClick={onRetry}>
                  <RefreshCw size={15} /> Refresh test catalog
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default App;

createRoot(document.getElementById("root")).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
