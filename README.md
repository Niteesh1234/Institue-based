# Vijetha Institute · Multi-exam Testing Module

The application supports three separate Class VI entrance courses without changing the supplied JNVST syllabus:

| Course | Full tests | Questions per test | Marks | Duration | Pattern source |
|---|---:|---:|---:|---:|---|
| JNVST 2027 | 30 | 80 | 100 | 120 min | Supplied `JNVST_Class6_2027_Syllabus.pdf` |
| AISSEE 2026 | 30 | 125 | 300 | 150 min | Official NTA AISSEE 2026 Information Bulletin, Appendix II |
| RMS CET 2026 | 30 | 200 | 200 | 150 min | Official RMS 2026–27 prospectus and Class V standard |

Every course has 10 Easy, 10 Medium, and 10 Challenging papers. The UI includes a course switcher, course-specific dashboard metrics, full-test library, syllabus screen, and responsive test runner.

## Official alignment

- JNVST remains mapped to the supplied 2027 document.
- AISSEE uses the official 50 Mathematics + 25 Intelligence + 25 Language + 25 General Knowledge structure and the complete Appendix II topic list.
- RMS uses four 50-mark sections: English, Intelligence Test, Mathematics, and General Knowledge & Current Affairs. English is qualifying only and excluded from written merit. The official prospectus describes the Class VI written test as generally Class V standard; the UI clearly labels the expanded topic map as the practice coverage used for that standard.

Official sources are linked from each applicable syllabus screen.

## Validation

```bash
npm install
npm run validate:all-courses
npm run validate:duplicates
npm run build
```

The complete validation contract checks:

- exactly 90 tests and 12,150 questions;
- 10 tests per difficulty for every course;
- the correct subject counts, marks, and total questions for each exam;
- every mapped syllabus topic in every paper;
- four unique options and a valid answer for every question;
- globally unique question IDs, visible prompts, rendered questions, and semantic scenario fingerprints;
- option-order invariance, preventing rearranged A/B/C/D choices from disguising a duplicate.

## MongoDB `coach-exam` database

Set the connection string and seed JNVST plus the two new courses:

```bash
export MONGODB_URI='your-mongodb-connection-string'
npm run seed:testing
npm run seed:courses
```

All application-owned collection names carry the `_Vijetha` suffix. Course collections:

- `jnvst_questions_Vijetha`, `jnvst_tests_Vijetha`, `jnvst_syllabus_topics_Vijetha`, `jnvst_validation_runs_Vijetha`
- `sainik_questions_Vijetha`, `sainik_tests_Vijetha`, `sainik_syllabus_topics_Vijetha`, `sainik_validation_runs_Vijetha`
- `rms_questions_Vijetha`, `rms_tests_Vijetha`, `rms_syllabus_topics_Vijetha`, `rms_validation_runs_Vijetha`

Account and student collections in the same `Testing` database:

- `auth_users_Vijetha`, `auth_otps_Vijetha`, `auth_sessions_Vijetha`, `auth_attempts_Vijetha`
- `students_Vijetha` — account-scoped and course-scoped learner records
- `batch_exams_Vijetha`, `resources_Vijetha`, `institute_control_Vijetha`
- GridFS bucket `resource_files_Vijetha` (`resource_files_Vijetha.files` and `resource_files_Vijetha.chunks`)

Without `MONGODB_URI`, the question API still serves the same deterministic, validated in-memory banks. Secure login and student management intentionally remain unavailable until MongoDB is configured.

## Secure login and student management

Copy `.env.example` to `.env.local` and configure all five values. `AUTH_SECRET` must contain at least 32 characters, `AUTH_EMAIL_FROM` must use a verified Resend domain, and `AUTH_ALLOWED_ORIGIN` must exactly match the deployed website origin.

The Students screen supports persisted list/create/edit/delete operations, local roster search, course and batch assignment, student and guardian contacts, progress updates, derived attention status, guarded deletion, course isolation, loading/error/empty states, and connected Dashboard, Progress, and Parents views. Every API operation requires a verified signed-in account; mutation requests also enforce same-origin checks.

```bash
npm run validate:auth
npm run validate:students
```

## Principal-controlled institute delivery

The portal includes a **Principal Control** module with a fixed 12-batch ceiling,
teacher access approval/suspension, admin-owned print/download permissions,
batch-wise 60-question institute exams (20 Easy + 20 Medium + 20 Challenging),
validated JSON/CSV teacher question uploads, secure PDF test-paper uploads with
student assignment through MongoDB GridFS, a manual prepaid-credit ledger, and
an independent Batch Exams module that composes and assigns validated 60-question
papers with exactly 20 Easy, 20 Medium, and 20 Challenging questions while
preventing question reuse across earlier batch papers, plus
an audit register. Official JNVST, AISSEE, and RMS full-test blueprints remain
unchanged; the 20/20/20 format is a separate institute exam workflow.

Students can change a selected option before final submission, but the runner no
longer reveals correctness through a “Check answer” action. Answers and
explanations are available only after final submission.

Bulk roster and question templates are available from the deployed site:

- `/student-import-template.csv`
- `/question-upload-template.csv`

The prepaid ledger records principal-authorized credits without pretending to
process money. Connect and configure the institute's selected payment provider
before enabling real online collection.

## Vijetha Holo Tutor

The browser tutor accepts typed or spoken questions, keeps recent conversation
context, answers in English, Hindi, or Telugu, and speaks its replies using the
device voice. Final speech-recognition results are submitted automatically, so
students can continue a hands-free question-and-answer flow.

On Vercel, the AI SDK uses the deployment's automatically managed
`VERCEL_OIDC_TOKEN` with AI Gateway. For local development outside Vercel, set
`AI_GATEWAY_API_KEY`. `OPENAI_API_KEY` remains a supported direct-provider
fallback. If neither credential is available, the tutor safely falls back to
verified syllabus guidance and simple arithmetic instead of failing.

```bash
npm run validate:tutor
```

## Run locally

```bash
npm run build
npm run api
```

Open [http://localhost:5174](http://localhost:5174).

Production: [https://vijetha-jnvst-testing.vercel.app](https://vijetha-jnvst-testing.vercel.app)

## Android application

The repository includes a Capacitor Android project with application ID
`com.sreevijetha.institute`. The native application bundles the validated web
question banks, supports the Android back button, uses a Vijetha splash screen
and adaptive icon, opens external school links in the system browser, and uses
bearer sessions for authenticated calls from the approved Capacitor origin.

Requirements:

- Node.js 22
- Java 21
- Android SDK Platform 36 and Build Tools 35+

Build an installable debug APK:

```bash
npm run android:build
```

Output:

```text
releases/Vijetha-Institute-Android-debug.apk
```

For Play Store release, open the project with `npm run android:open`, configure
a private release signing key in Android Studio, increment `versionCode`, and
generate a signed Android App Bundle (`.aab`). Never commit the signing key or
its passwords.

## iOS application

The repository also includes a Capacitor iOS project for iPhone and iPad using
the same `com.sreevijetha.institute` bundle identifier, validated question
banks, English/Hindi/Telugu interface, native bearer sessions, Vijetha icon,
and branded launch screen.

Requirements:

- macOS with full Xcode 26 or newer (Command Line Tools alone are insufficient)
- An Apple ID added in Xcode for installation on a physical iPhone
- An Apple Developer Program membership for TestFlight or App Store release

After installing Xcode, build the Simulator application with:

```bash
npm run ios:build
```

Or open the native project and install it on a connected iPhone:

```bash
npm run ios:open
```

In Xcode, select the **App** target, choose **Signing & Capabilities**, select
your Apple development team, keep **Automatically manage signing** enabled,
select the connected iPhone, and press **Run**. The iPhone may ask you to enable
Developer Mode and trust the developer account before first launch.
