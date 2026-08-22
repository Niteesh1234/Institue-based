export const JNVST_LEVELS = ['easy', 'medium', 'challenging'];

export const LANGUAGE_SKILLS = [
  'Direct Comprehension',
  'Vocabulary in Context',
  'Inference',
  'Cause and Effect',
  'Main Idea'
];

export const MAT_SECTION_PLAN = [
  ['Part I', 'Pattern Completion', 'Number Patterns', 'mat-number-pattern'],
  ['Part I', 'Pattern Completion', 'Alphabet Patterns', 'mat-alphabet-pattern'],
  ['Part I', 'Pattern Completion', 'Figure Patterns', 'mat-figure-pattern'],
  ['Part I', 'Pattern Completion', 'Mixed Visual Patterns', 'mat-mixed-pattern'],
  ...Array.from({ length: 4 }, (_, index) => ['Part II', 'Figure Series Completion', `Figure Series ${index + 1}`, `mat-figure-series-${index + 1}`]),
  ...Array.from({ length: 4 }, (_, index) => ['Part III', 'Geometrical Figure Completion', `Geometrical Completion ${index + 1}`, `mat-geometrical-${index + 1}`]),
  ['Part IV', 'Mirror Imaging', 'Vertical Mirror Imaging 1', 'mat-mirror-1'],
  ['Part IV', 'Mirror Imaging', 'Vertical Mirror Imaging 2', 'mat-mirror-2'],
  ['Part IV', 'Water Imaging', 'Horizontal Water Imaging 1', 'mat-water-1'],
  ['Part IV', 'Water Imaging', 'Horizontal Water Imaging 2', 'mat-water-2'],
  ...Array.from({ length: 4 }, (_, index) => ['Part V', 'Embedded Figures', `Embedded Figure ${index + 1}`, `mat-embedded-${index + 1}`])
].map(([part, topic, subtopic, skillCode]) => ({ part, topic, subtopic, skillCode }));

export const ARITHMETIC_SECTION_PLAN = [
  ['Number and Numeric System', 'Place Value and Number Names', 'arithmetic-place-value-number-names'],
  ['Number and Numeric System', 'Ascending and Descending Order', 'arithmetic-ordering'],
  ['Number and Numeric System', 'Rounding to Nearest 10, 100 and 1000', 'arithmetic-rounding'],
  ['Four Fundamental Operations', 'Addition and Subtraction', 'arithmetic-addition-subtraction'],
  ['Four Fundamental Operations', 'Multiplication and Division', 'arithmetic-multiplication-division'],
  ['Factors and Multiples', 'Factors, Multiples and Their Properties', 'arithmetic-factors-multiples'],
  ['Like Fractions', 'Addition and Subtraction of Like Fractions', 'arithmetic-like-fraction-add-subtract'],
  ['Like Fractions', 'Multiplication of Fractions', 'arithmetic-fraction-multiplication'],
  ['Measurement and Unit Conversion', 'Length and Mass Conversion', 'arithmetic-length-mass'],
  ['Measurement and Unit Conversion', 'Capacity Conversion', 'arithmetic-capacity'],
  ['Measurement and Unit Conversion', 'Time Conversion', 'arithmetic-time'],
  ['Measurement and Unit Conversion', 'Money', 'arithmetic-money'],
  ['Simplification', 'Simplification of Numerical Expressions', 'arithmetic-simplification'],
  ['Perimeter and Area', 'Perimeter of Polygons', 'arithmetic-polygon-perimeter'],
  ['Perimeter and Area', 'Area of Squares and Rectangles', 'arithmetic-square-rectangle-area'],
  ['Perimeter and Area', 'Area of a Triangle as Part of a Rectangle', 'arithmetic-triangle-area'],
  ['Angles, Directions and Mapping', 'Types of Angles', 'arithmetic-angle-types'],
  ['Angles, Directions and Mapping', 'Directions and Mapping', 'arithmetic-directions-mapping'],
  ['Data Analysis', 'Tables and Bar Diagrams', 'arithmetic-table-bar'],
  ['Data Analysis', 'Pictographs', 'arithmetic-pictograph']
].map(([topic, subtopic, skillCode]) => ({ topic, subtopic, skillCode }));

export const JNVST_BLUEPRINT = [
  {
    key: 'mental',
    subject: 'Mental Ability',
    section: 'Section 1A',
    aliases: ['Mental Ability', 'Mental Ability Test', 'MAT'],
    questionCount: 20,
    marks: 25,
    durationMinutes: 30,
    topics: [
      ['Pattern Completion', ['pattern completion', 'number pattern', 'alphabetical pattern']],
      ['Figure Series Completion', ['figure series', 'series completion']],
      ['Geometrical Figure Completion', ['geometrical figure', 'geometric figure', 'figure completion']],
      ['Mirror Imaging', ['mirror image', 'mirror imaging']],
      ['Water Imaging', ['water image', 'water imaging']],
      ['Embedded Figures', ['embedded figure', 'hidden figure']]
    ]
  },
  {
    key: 'evs',
    subject: 'Environmental Studies',
    section: 'Section 1B',
    aliases: ['Environmental Studies', 'Environmental Science', 'EVS'],
    questionCount: 20,
    marks: 25,
    durationMinutes: 30,
    topics: [
      ['Transportation', ['transportation', 'transport']],
      ['Rivers', ['river', 'rivers']],
      ['Mountains', ['mountain', 'mountains']],
      ['Plants', ['plant', 'plants']],
      ['Animals on Land and in Water', ['animals on land', 'animals in water', 'aquatic animal', 'terrestrial animal']],
      ['Natural Disasters', ['natural disaster', 'earthquake', 'flood', 'cyclone']],
      ['Houses and Shelters', ['house and shelter', 'houses and shelters', 'types of houses', 'shelter']],
      ['Water Cycle', ['water cycle', 'evaporation', 'condensation', 'precipitation', 'infiltration']],
      ['Food and Nutrients', ['food and nutrient', 'nutrient', 'nutrition']],
      ['Hygiene and Cleanliness', ['hygiene', 'cleanliness']],
      ['Super Senses', ['super senses', 'sense organ', 'senses']],
      ['Digestive System', ['digestive system', 'digestion']],
      ['Circulatory System', ['circulatory system', 'circulation']],
      ['Respiratory System', ['respiratory system', 'respiration']],
      ['Food Preservation', ['food preservation', 'preservation method']],
      ['Water Pollution', ['water pollution']],
      ['Air Pollution', ['air pollution']],
      ['Conservation of Water', ['conservation of water', 'water conservation']],
      ['Conservation of Soil', ['conservation of soil', 'soil conservation']],
      ['Superlatives of India', ['superlatives of india', 'largest in india', 'highest in india', 'longest in india']],
      ['States and Capitals', ['states and capitals', 'state capital', 'indian states']],
      ['National Symbols', ['national symbol']],
      ['Landscapes', ['landscape', 'plain', 'plateau', 'desert']],
      ['Festivals', ['festival', 'festivals']],
      ['Seasons', ['season', 'seasons']],
      ['Forests', ['forest', 'forests']],
      ['Crops', ['crop', 'crops']],
      ['Clothes and Fibres', ['clothes and fibres', 'cloth and fibre', 'natural fibre', 'fiber']]
    ]
  },
  {
    key: 'arithmetic',
    subject: 'Arithmetic',
    section: 'Section 2',
    aliases: ['Arithmetic', 'Arithmetic Test', 'Mathematics', 'Maths'],
    questionCount: 20,
    marks: 25,
    durationMinutes: 30,
    topics: [
      ['Number and Numeric System', ['number and numeric system', 'number system', 'place value', 'number names', 'ascending order', 'descending order', 'rounding']],
      ['Four Fundamental Operations', ['fundamental operations', 'whole number operations', 'addition', 'subtraction', 'multiplication', 'division']],
      ['Factors and Multiples', ['factor', 'multiple', 'factors and multiples']],
      ['Like Fractions', ['like fraction', 'fractions', 'fraction addition', 'fraction subtraction']],
      ['Measurement and Unit Conversion', ['measurement', 'unit conversion', 'length', 'mass', 'capacity', 'time and money']],
      ['Simplification', ['simplification', 'numerical expression']],
      ['Perimeter and Area', ['perimeter', 'area of square', 'area of rectangle', 'area of triangle']],
      ['Angles, Directions and Mapping', ['angle', 'direction', 'mapping']],
      ['Data Analysis', ['data analysis', 'bar diagram', 'bar graph', 'table', 'pictograph']]
    ]
  },
  {
    key: 'language',
    subject: 'Language',
    section: 'Section 3',
    aliases: ['Language', 'Language Test', 'Reading Comprehension'],
    questionCount: 20,
    marks: 25,
    durationMinutes: 30,
    topics: [
      ['Reading Comprehension', ['reading comprehension', 'comprehension', 'passage', 'passage practice', 'vocabulary in context', 'inference', 'cause and effect', 'main idea']]
    ]
  }
];

export const JNVST_STANDARD = {
  syllabusYear: 2027,
  questionsPerPaper: 80,
  marksPerPaper: 100,
  durationMinutes: 120,
  papersPerLevel: 10,
  questionsPerSubject: 20,
  marksPerCorrectAnswer: 1.25,
  negativeMarking: 0,
  examMode: 'Offline OMR-based',
  divyangExtraTimeMinutes: 40,
  qualifyingMarks: { section1: 14, arithmetic: 7, language: 7 },
  defaultLanguage: 'English'
};

export const TESTING_MODULE_VERSION = 'JNVST-2027-TESTING-V1';

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function mapSyllabusTopic(blueprint, sourceTopic) {
  const normalizedTopic = normalize(sourceTopic);
  if (!normalizedTopic) return null;
  for (const [canonicalTopic, aliases] of blueprint.topics) {
    if (aliases.some((alias) => normalizedTopic.includes(normalize(alias)))) return canonicalTopic;
  }
  return null;
}

export function syllabusTopicNames(blueprint) {
  return blueprint.topics.map(([topic]) => topic);
}
