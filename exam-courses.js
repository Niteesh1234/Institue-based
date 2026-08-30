import { JNVST_BLUEPRINT, JNVST_LEVELS, JNVST_STANDARD, TESTING_MODULE_VERSION } from './syllabus.js';
import { vijethaCourseCollections } from './database-config.js';

const topics = (items) => items.map((topic) => [topic, [topic.toLowerCase()]]);

export const SAINIK_BLUEPRINT = [
  {
    key: 'language', subject: 'Language', section: 'Section A', questionCount: 25, marks: 50,
    topics: topics(['Comprehension Passage', 'Preposition', 'Article', 'Vocabulary', 'Verbs and Type', 'Confusing Words', 'Question Tags', 'Types of Sentence', 'Tense Forms', 'Kinds of Nouns', 'Kinds of Pronouns', 'Correct Spelling', 'Ordering of Words', 'Sentence Formation', 'Antonyms', 'Synonyms', 'Adjectives', 'Interjection', 'Idioms and Phrases', 'Collective Nouns', 'Number', 'Gender', 'Adverbs', 'Rhyming Words', 'Singular and Plural'])
  },
  {
    key: 'mathematics', subject: 'Mathematics', section: 'Section B', questionCount: 50, marks: 150,
    topics: topics(['Natural Numbers', 'LCM and HCF', 'Unitary Method', 'Fractions', 'Ratio and Proportion', 'Profit and Loss', 'Simplification', 'Average', 'Percentage', 'Area and Perimeter', 'Simple Interest', 'Lines and Angles', 'Complementary and Supplementary Angles', 'Conversion of Units', 'Roman Numerals', 'Types of Angles', 'Circle', 'Volume of Cube and Cuboids', 'Prime and Composite Numbers', 'Plane Figures', 'Decimal Numbers', 'Speed and Time', 'Operation on Numbers', 'Temperature', 'Arranging of Fractions'])
  },
  {
    key: 'intelligence', subject: 'Intelligence', section: 'Section C', questionCount: 25, marks: 50,
    topics: topics(['Analogies', 'Spatial and Mathematical Patterns', 'Classification', 'Visual and Logical Reasoning', 'Series and Sequences', 'Critical Thinking and Problem Solving', 'Familial Relations'])
  },
  {
    key: 'general-knowledge', subject: 'General Knowledge', section: 'Section D', questionCount: 25, marks: 50,
    topics: topics(['National Symbols of India', 'India at a Glance', 'Art and Culture of India', 'Indian Literary and Cultural Awards', 'National and International Personalities', 'Indian Defence System', 'Sports', 'National and International Organizations', 'Solar System and Our Earth', 'Mountain Terrain and Lifestyle', 'Water Cycle', 'Energy', 'Climate and Natural Calamities', 'Uses of Water', 'Digestion and Food Preservation', 'Farming and Seed Dispersal', 'Tribal Communities and Forest', 'Scientific Devices in Daily Life', 'Water Pollution and Microbial Diseases', 'Humans and Animals', 'Functions of Plants Animals and Humans', 'Super Senses and Young Ones of Animals'])
  }
];

export const RMS_BLUEPRINT = [
  {
    key: 'english', subject: 'English', section: 'Qualifying Section', questionCount: 50, marks: 50,
    topics: topics(['Reading Comprehension', 'Nouns and Pronouns', 'Verbs and Tenses', 'Adjectives and Adverbs', 'Articles and Prepositions', 'Vocabulary', 'Synonyms and Antonyms', 'Spelling', 'Sentence Formation', 'Number and Gender'])
  },
  {
    key: 'intelligence', subject: 'Intelligence Test', section: 'Merit Section 1', questionCount: 50, marks: 50,
    topics: topics(['Analogies', 'Classification', 'Number Series', 'Alphabet Series', 'Coding and Decoding', 'Directions', 'Familial Relations', 'Ranking and Order', 'Patterns', 'Logical Reasoning'])
  },
  {
    key: 'mathematics', subject: 'Mathematics', section: 'Merit Section 2', questionCount: 50, marks: 50,
    topics: topics(['Numbers and Place Value', 'Four Fundamental Operations', 'Factors and Multiples', 'Fractions', 'Decimals', 'Measurement and Conversion', 'Geometry and Angles', 'Area and Perimeter', 'Time and Money', 'Data Handling'])
  },
  {
    key: 'general-knowledge', subject: 'General Knowledge & Current Affairs', section: 'Merit Section 3', questionCount: 50, marks: 50,
    topics: topics(['India and the World', 'History and Civics', 'Geography', 'General Science', 'Environment', 'Indian Defence', 'Sports', 'Awards and Personalities', 'Current Affairs', 'Everyday Life'])
  }
];

export const EXAM_COURSES = {
  jnvst: {
    key: 'jnvst', shortName: 'JNVST', name: 'Jawahar Navodaya Vidyalaya Selection Test', className: 'Class VI', year: 2027,
    syllabusVersion: 'JNVST-2027', moduleVersion: TESTING_MODULE_VERSION, blueprint: JNVST_BLUEPRINT, levels: JNVST_LEVELS,
    standard: JNVST_STANDARD, sourceType: 'Supplied syllabus document', sourceLabel: 'JNVST_Class6_2027_Syllabus.pdf', sourceUrl: null,
    coverageNote: 'The supplied JNVST syllabus is preserved without changes.',
    printPattern: {
      edition: 'English practice edition',
      instructions: [
        'The paper contains 80 objective questions carrying 100 marks and must be completed in 2 hours.',
        'Each correct response carries 1.25 marks. There is no negative marking.',
        'Use the response sheet at the end and mark only one option for each question.',
        'The minimum qualifying marks are 14 in Section 1, 7 in Arithmetic, and 7 in Language.',
        'Eligible Divyang candidates receive 40 additional minutes.'
      ],
      sections: [
        { section: 'Section 1', subject: 'Mental Ability + Environmental Studies', range: '1–40', questions: 40, marksEach: 1.25, marks: 50, duration: '60 min', qualifying: '14 marks' },
        { section: 'Section 2', subject: 'Arithmetic', range: '41–60', questions: 20, marksEach: 1.25, marks: 25, duration: '30 min', qualifying: '7 marks' },
        { section: 'Section 3', subject: 'Language', range: '61–80', questions: 20, marksEach: 1.25, marks: 25, duration: '30 min', qualifying: '7 marks' }
      ]
    }
  },
  sainik: {
    key: 'sainik', shortName: 'AISSEE', name: 'All India Sainik Schools Entrance Examination', className: 'Class VI', year: 2026,
    syllabusVersion: 'AISSEE-2026-CLASS-VI', moduleVersion: 'AISSEE-2026-TESTING-V3', blueprint: SAINIK_BLUEPRINT, levels: JNVST_LEVELS,
    standard: { syllabusYear: 2026, questionsPerPaper: 125, marksPerPaper: 300, durationMinutes: 150, papersPerLevel: 10, negativeMarking: 0, examMode: 'Offline OMR-based', defaultLanguage: 'English' },
    sourceType: 'Official NTA Information Bulletin · Appendix II', sourceLabel: 'AISSEE 2026 Information Bulletin', sourceUrl: 'https://cdnbbsr.s3waas.gov.in/s388a839f2f6f1427879fc33ee4acf4f66/uploads/2025/10/20251010937989896.pdf',
    coverageNote: 'Topics and section weights are mapped directly from Appendix II of the official AISSEE 2026 bulletin.',
    printPattern: {
      edition: 'English practice edition',
      instructions: [
        'The paper contains 125 multiple-choice questions carrying 300 marks and must be completed in 150 minutes.',
        'Section A Language has 25 questions, Section B Mathematics has 50, Section C Intelligence has 25, and Section D General Knowledge has 25.',
        'Language, Intelligence, and General Knowledge questions carry 2 marks each; Mathematics questions carry 3 marks each.',
        'There is no negative marking. Mark only one answer for every question on the response sheet.',
        'The official qualifying standard is 25% in each subject and 40% in aggregate, subject to the applicable category rules.'
      ],
      sections: [
        { section: 'Section A', subject: 'Language', range: '1–25', questions: 25, marksEach: 2, marks: 50, duration: '—', qualifying: '25%' },
        { section: 'Section B', subject: 'Mathematics', range: '26–75', questions: 50, marksEach: 3, marks: 150, duration: '—', qualifying: '25%' },
        { section: 'Section C', subject: 'Intelligence', range: '76–100', questions: 25, marksEach: 2, marks: 50, duration: '—', qualifying: '25%' },
        { section: 'Section D', subject: 'General Knowledge', range: '101–125', questions: 25, marksEach: 2, marks: 50, duration: '—', qualifying: '25%' }
      ]
    }
  },
  rms: {
    key: 'rms', shortName: 'RMS CET', name: 'Rashtriya Military Schools Common Entrance Test', className: 'Class VI', year: 2026,
    syllabusVersion: 'RMS-CET-2026-CLASS-VI', moduleVersion: 'RMS-CET-2026-TESTING-V3', blueprint: RMS_BLUEPRINT, levels: JNVST_LEVELS,
    standard: { syllabusYear: 2026, questionsPerPaper: 200, marksPerPaper: 200, durationMinutes: 150, papersPerLevel: 10, negativeMarking: 0, examMode: 'Offline OMR-based', defaultLanguage: 'English / Hindi' },
    sourceType: 'Official RMS 2026–27 prospectus', sourceLabel: 'RMS admission prospectus 2026–27', sourceUrl: 'https://apply-delhi.nielit.gov.in/PDF/RMSCET2025/Prospectus%20for%20Admission%20to%20Rashtriya%20Military%20Schools%20%28Academic%20Session%202026-2027%29.pdf',
    coverageNote: 'Official RMS rules specify four 50-mark sections at Class V standard. The visible topic map expands that Class V standard for practice and is labelled accordingly.',
    printPattern: {
      edition: 'English practice edition',
      instructions: [
        'The Class VI practice paper contains four 50-mark sections at Class V standard.',
        'The response sheet follows the OMR pattern. Mark only one answer for every question.',
        'English is qualifying at 35% and is not counted in the written merit score.',
        'Intelligence Test, Mathematics, and General Knowledge & Current Affairs each require 40%.',
        'The official Class VI entrance paper is bilingual in English and Hindi; this generated practice edition is in English.'
      ],
      sections: [
        { section: '(a)', subject: 'English', range: '1–50', questions: 50, marksEach: 1, marks: 50, duration: '—', qualifying: '35%' },
        { section: '(b)', subject: 'Intelligence Test', range: '51–100', questions: 50, marksEach: 1, marks: 50, duration: '—', qualifying: '40%' },
        { section: '(c)', subject: 'Mathematics', range: '101–150', questions: 50, marksEach: 1, marks: 50, duration: '—', qualifying: '40%' },
        { section: '(d)', subject: 'General Knowledge & Current Affairs', range: '151–200', questions: 50, marksEach: 1, marks: 50, duration: '—', qualifying: '40%' }
      ]
    }
  }
};

export const COURSE_KEYS = Object.keys(EXAM_COURSES);

export function getExamCourse(key = 'jnvst') {
  return EXAM_COURSES[key] || EXAM_COURSES.jnvst;
}

export function courseCollectionNames(key) {
  return vijethaCourseCollections(key);
}
