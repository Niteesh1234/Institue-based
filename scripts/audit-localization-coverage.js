import { COURSE_KEYS } from '../exam-courses.js';
import { buildValidatedPreviewCatalog } from '../vercel-catalog.js';
import { localizeQuestion } from '../src/localization.js';

const englishGrammar = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'both', 'each', 'every', 'all', 'one', 'two',
  'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'does', 'do', 'did',
  'what', 'which', 'who', 'why', 'how', 'when', 'where', 'whose', 'in', 'on', 'at',
  'to', 'from', 'of', 'for', 'with', 'without', 'into', 'below', 'above', 'before',
  'after', 'between', 'while', 'then', 'than', 'that', 'this', 'these', 'those',
  'select', 'choose', 'find', 'complete', 'correct', 'incorrect', 'option', 'answer',
  'figure', 'pattern', 'card', 'rule', 'next', 'follows', 'follow', 'contains', 'shows',
  'number', 'value', 'angle', 'area', 'perimeter', 'volume', 'side', 'sides', 'long',
  'many', 'more', 'remain', 'needed', 'altogether', 'called', 'best', 'statement',
]);
const leaks = (value) => [...new Set((String(value || '').match(/[A-Za-z]+/g) || [])
  .filter((word) => word.length > 1 && word !== word.toUpperCase()).map((word) => word.toLowerCase()).filter((word) => englishGrammar.has(word)))];
const allowedLatin = new Set(['cm', 'ml', 'km', 'kg']);
const untranslatedWords = (value) => [...new Set((String(value || '').match(/[A-Za-z]+/g) || [])
  .filter((word) => word.length > 1 && word !== word.toUpperCase() && !allowedLatin.has(word.toLowerCase())))];

const report = {};
const compact = process.argv.includes('--compact');
let failureCount = 0;
for (const locale of ['hi', 'te']) {
  report[locale] = {};
  for (const course of COURSE_KEYS) {
    const courseReport = { checked: 0, failed: 0, subjects: {}, samples: [] };
    for (const test of buildValidatedPreviewCatalog(course).tests) {
      for (const source of test.questions) {
        courseReport.checked += 1;
        const localized = localizeQuestion(source, locale);
        const fields = {
          topic: localized.topicLabel,
          stem: localized.stem,
          passage: localized.passage,
          explanation: localized.explanation,
          options: localized.options.map((option) => option.text).join(' | '),
          stimulus: (localized.stimulus?.rows || []).map((row) => row?.[0]).join(' | '),
          skills: [...(localized.coverageTopics || []), ...(localized.syllabusSubtopics || [])].join(' | '),
        };
        const fieldLeaks = Object.fromEntries(Object.entries(fields)
          .map(([field, value]) => [field, [...new Set([...leaks(value), ...untranslatedWords(value)])]])
          .filter(([, words]) => words.length));
        if (!Object.keys(fieldLeaks).length) continue;
        courseReport.failed += 1;
        failureCount += 1;
        const subjectReport = courseReport.subjects[source.subject] || { failed: 0, fields: {} };
        subjectReport.failed += 1;
        for (const field of Object.keys(fieldLeaks)) subjectReport.fields[field] = (subjectReport.fields[field] || 0) + 1;
        courseReport.subjects[source.subject] = subjectReport;
        if (courseReport.samples.length < 12) courseReport.samples.push({ questionId: source.questionId, subject: source.subject, fieldLeaks, source: source.stem, localized: localized.stem });
      }
    }
    report[locale][course] = courseReport;
  }
}

const output = compact
  ? Object.fromEntries(Object.entries(report).map(([locale, courses]) => [locale,
      Object.fromEntries(Object.entries(courses).map(([course, details]) => [course, {
        checked: details.checked,
        failed: details.failed,
        subjects: details.subjects,
      }]))]))
  : report;
console.log(JSON.stringify({ status: failureCount ? 'failed' : 'passed', failureCount, locales: output }, null, 2));
if (failureCount) process.exitCode = 1;
