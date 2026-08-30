import { COURSE_KEYS } from '../exam-courses.js';
import { buildValidatedPreviewCatalog } from '../vercel-catalog.js';
import {
  SUPPORTED_LOCALES,
  isRetainedLanguageSubject,
  localizeQuestion,
} from '../src/localization.js';

const targetScripts = {
  hi: /[\u0900-\u097F]/,
  te: /[\u0C00-\u0C7F]/,
};

// Proper names, scientific symbols, units and Roman numerals may legitimately use
// Latin characters. Ordinary English grammar must never leak into an academic
// Hindi/Telugu rendering, because that is what creates mixed-language questions.
const englishLeakWords = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'both', 'each', 'every', 'all', 'one', 'two',
  'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'does', 'do', 'did',
  'what', 'which', 'who', 'why', 'how', 'when', 'where', 'whose',
  'in', 'on', 'at', 'to', 'from', 'of', 'for', 'with', 'without', 'into', 'below', 'above',
  'before', 'after', 'between', 'while', 'then', 'than', 'that', 'this', 'these', 'those',
  'select', 'choose', 'find', 'complete', 'correct', 'incorrect', 'option', 'answer',
  'figure', 'pattern', 'card', 'rule', 'next', 'follows', 'follow', 'contains', 'shows',
  'number', 'value', 'angle', 'area', 'perimeter', 'volume', 'side', 'sides', 'long',
  'many', 'more', 'remain', 'needed', 'altogether', 'called', 'best', 'statement',
]);

const allowedLatin = new Set(['cm', 'ml', 'km', 'kg']);

function leakedEnglish(value) {
  return (String(value || '').match(/[A-Za-z]+/g) || [])
    .filter((word) => word.length > 1 && word !== word.toUpperCase())
    .filter((word) => englishLeakWords.has(word.toLowerCase()) || !allowedLatin.has(word.toLowerCase()));
}

const failures = [];
const report = {};

for (const locale of SUPPORTED_LOCALES.map(({ code }) => code)) {
  const summary = {
    tests: 0,
    questions: 0,
    sourceLanguageQuestions: 0,
    translatedAcademicQuestions: 0,
    answerKeyChecks: 0,
    optionIdentityChecks: 0,
  };

  for (const courseKey of COURSE_KEYS) {
    const catalog = buildValidatedPreviewCatalog(courseKey);
    summary.tests += catalog.tests.length;

    for (const test of catalog.tests) {
      for (const source of test.questions) {
        const localized = localizeQuestion(source, locale);
        summary.questions += 1;

        if (localized.questionId !== source.questionId) failures.push(`${locale}:${source.questionId}: question ID changed`);
        if (localized.correctOption !== source.correctOption) failures.push(`${locale}:${source.questionId}: answer key changed`);
        summary.answerKeyChecks += 1;

        const sourceOptionIds = source.options.map(({ id }) => id);
        const localizedOptionIds = localized.options.map(({ id }) => id);
        if (JSON.stringify(sourceOptionIds) !== JSON.stringify(localizedOptionIds)) {
          failures.push(`${locale}:${source.questionId}: option identity/order changed`);
        }
        if (!localizedOptionIds.includes(localized.correctOption)) {
          failures.push(`${locale}:${source.questionId}: correct option is missing`);
        }
        const localizedOptionText = localized.options.map((option) => String(option.text ?? option.label ?? '').normalize('NFKC').trim().toLowerCase());
        if (new Set(localizedOptionText).size !== localizedOptionText.length) {
          failures.push(`${locale}:${source.questionId}: localized options are not unique`);
        }
        summary.optionIdentityChecks += 1;

        if (!String(localized.text || localized.stem || '').trim()) failures.push(`${locale}:${source.questionId}: empty localized prompt`);
        if (localized.options.some((option) => !String(option.text ?? option.label ?? '').trim())) {
          failures.push(`${locale}:${source.questionId}: empty localized option`);
        }

        if (isRetainedLanguageSubject(source)) summary.sourceLanguageQuestions += 1;
        if (locale !== 'en') {
          if (localized.text === source.text) failures.push(`${locale}:${source.questionId}: academic prompt was not localized`);
          if (!targetScripts[locale].test(`${localized.text} ${localized.explanation || ''}`)) {
            failures.push(`${locale}:${source.questionId}: target-language script not found`);
          }
          const academicFields = [
            localized.text || localized.stem,
            localized.passage,
            localized.topicLabel,
            localized.explanation,
            ...(localized.coverageTopics || []),
            ...(localized.syllabusSubtopics || []),
            ...localized.options.map((option) => option.text ?? option.label),
            ...(localized.stimulus?.rows || []).map((row) => row?.[0]),
          ];
          const leaks = [...new Set(academicFields.flatMap(leakedEnglish))];
          if (leaks.length) {
            failures.push(`${locale}:${source.questionId}: untranslated Latin words remain (${leaks.join(', ')})`);
          }
          summary.translatedAcademicQuestions += 1;
        }
      }
    }
  }
  report[locale] = summary;
}

if (failures.length) {
  throw new Error(`Localization validation failed (${failures.length}):\n${failures.slice(0, 30).join('\n')}`);
}

console.log(JSON.stringify({ status: 'passed', locales: report }, null, 2));
