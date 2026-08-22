# Vijetha Institute · JNVST Testing Module

The application contains a new JNVST Class 6 question module authored from the supplied `JNVST_Class6_2027_Syllabus.pdf` and stored in a separate MongoDB database named `Testing`.

## Module contract

- 30 full tests: 10 Easy, 10 Medium, and 10 Challenging.
- 80 questions per test, 100 marks, and a 2-hour duration.
- Every test contains 20 Mental Ability, 20 Environmental Studies, 20 Arithmetic, and 20 Language questions.
- Every Language section contains four passages with five questions per passage.
- Questions include four options, a correct option, an explanation, difficulty metadata, syllabus topic metadata, and a stable content fingerprint.
- Mental Ability follows five parts of four questions and includes rendered figure/sequence data.
- EVS follows the 15 standalone + one five-question study-passage structure.
- Arithmetic covers all 20 detailed syllabus skills in every paper.
- Language follows four passages with five questions per passage.
- Answers are hidden by default and can be checked inside the test runner.

The old `questionbank.syllabus2027_questions` aggregation is not used by this module.

## Generate and validate

The authoring engine is deterministic, so the same module version always produces the same question records.

```bash
npm install
npm run validate:testing
npm run validate:duplicates
```

Validation checks:

- exactly 30 tests and 2,400 questions;
- exactly 10 tests for each difficulty;
- exactly 20 questions per subject in every test;
- five MAT parts with four questions each and all 20 detailed MAT skill slots;
- all 20 detailed Arithmetic syllabus skills;
- the EVS 15+5 structure and 20 distinct topics per paper;
- four reading passages with five questions each;
- approved JNVST subjects and topics only;
- exactly four unique options and an answer present in those options;
- unique question IDs and unique content fingerprints.
- globally unique prompt and rendered-question fingerprints;
- option-order invariance, so rearranging A/B/C/D cannot disguise a duplicate;
- an adversarial shuffled-option duplicate that must be rejected.

## Seed MongoDB

Provide the existing MongoDB connection string and run the idempotent seed command:

```bash
export MONGODB_URI='your-mongodb-connection-string'
npm run seed:testing
```

The command creates or updates these collections in the `Testing` database:

- `jnvst_questions`
- `jnvst_tests`
- `jnvst_syllabus_topics`
- `jnvst_validation_runs`

The seed creates unique indexes, writes the authored records through upserts, audits the stored data, and saves the validation report. A failed audit causes the command to exit with an error.

## Portal components

The responsive React interface includes a marketing landing page, demo login, dashboard, student CRUD, batches and class schedule, mock-test library and rank list, progress charts and attention list, parent messaging, exact syllabus view, and the full 80-question test runner.

## Run the complete website

For a single local website URL, build and start the server:

```bash
npm run build
npm run api
```

Open [http://localhost:5174](http://localhost:5174). The server hosts both the built website and API.

When `MONGODB_URI` is set, the API reads only the `Testing` database. Without it, the API exposes the same deterministic, fully validated bank as an in-memory preview so the test screen never becomes blank.

For development with live reload, run the API and UI in separate terminals:

Run the API and UI in separate terminals after seeding:

```bash
export MONGODB_URI='your-mongodb-connection-string'
npm run api
```

```bash
npm run dev
```

For a separately hosted API, provide `VITE_API_BASE_URL` before building the frontend.
