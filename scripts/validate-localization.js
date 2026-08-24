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

const failures = [];
const report = {};

for (const locale of SUPPORTED_LOCALES.map(({ code }) => code)) {
  const summary = {
    tests: 0,
    questions: 0,
    retainedLanguageQuestions: 0,
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
        summary.optionIdentityChecks += 1;

        if (!String(localized.text || localized.stem || '').trim()) failures.push(`${locale}:${source.questionId}: empty localized prompt`);
        if (localized.options.some((option) => !String(option.text ?? option.label ?? '').trim())) {
          failures.push(`${locale}:${source.questionId}: empty localized option`);
        }

        if (isRetainedLanguageSubject(source)) {
          summary.retainedLanguageQuestions += 1;
          if (locale !== 'en') {
            const sourcePrompt = source.text || source.stem;
            if (localized.text !== sourcePrompt || localized.stem !== sourcePrompt) {
              failures.push(`${locale}:${source.questionId}: English-language assessment content was altered`);
            }
            if (!localized.localization?.retainedLanguageSubject) {
              failures.push(`${locale}:${source.questionId}: retained-language disclosure is missing`);
            }
          }
        } else if (locale !== 'en') {
          if (localized.text === source.text) failures.push(`${locale}:${source.questionId}: academic prompt was not localized`);
          if (!targetScripts[locale].test(`${localized.text} ${localized.explanation || ''}`)) {
            failures.push(`${locale}:${source.questionId}: target-language script not found`);
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
