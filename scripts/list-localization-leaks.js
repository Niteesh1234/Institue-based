import { COURSE_KEYS } from '../exam-courses.js';
import { buildValidatedPreviewCatalog } from '../vercel-catalog.js';
import { containsEnglishGrammar, isRetainedLanguageSubject, localizeQuestion } from '../src/localization.js';

const wantedCourse = process.argv[2];
const wantedSubject = process.argv[3];
const names = ['Aarav','Aditi','Akhil','Anaya','Arjun','Diya','Farhan','Gauri','Harini','Ishaan','Jaya','Kabir','Kavya','Laksh','Meera','Naman','Neha','Omkar','Pooja','Pranav','Rani','Rehan','Riya','Rohan','Saanvi','Sameer','Sara','Tanvi','Varun','Yash','Zoya'];
const canonical = (value) => String(value || '')
  .replace(new RegExp(`\\b(?:${names.join('|')})\\b`, 'g'), '{NAME}')
  .replace(/₹?[\d][\d,.]*(?:\.\d+)?(?:°C|°|%|\s*(?:cm³|cm²|cm|km|mL|kg|mm|g|m))?/g, '{N}')
  .replace(/[A-Z]\d+/g, '{CODE}')
  .replace(/\s+/g, ' ').trim();

const groups = new Map();
for (const course of COURSE_KEYS.filter((item) => !wantedCourse || item === wantedCourse)) {
  for (const test of buildValidatedPreviewCatalog(course).tests) {
    for (const source of test.questions) {
      if (isRetainedLanguageSubject(source) || (wantedSubject && source.subject !== wantedSubject)) continue;
      const localized = localizeQuestion(source, 'te');
      const fields = {
        stem: [source.stem, localized.stem],
        passage: [source.passage, localized.passage],
        options: [source.options.map((option) => option.text).join(' | '), localized.options.map((option) => option.text).join(' | ')],
      };
      for (const [field, [original, translated]] of Object.entries(fields)) {
        if (!containsEnglishGrammar(translated)) continue;
        const key = `${field}:${canonical(original)}`;
        const group = groups.get(key) || { field, count: 0, source: original, localized: translated };
        group.count += 1;
        groups.set(key, group);
      }
    }
  }
}

console.log(JSON.stringify([...groups.values()].sort((a, b) => b.count - a.count), null, 2));
