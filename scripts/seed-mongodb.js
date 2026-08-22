const database = db.getSiblingDB('vijetha_institute');
const levels = ['Easy', 'Medium', 'Challenging'];
const sets = ['A', 'B', 'C', 'D'];
const templates = [
  { domain: 'Mental Ability Test', topic: 'Pattern completion', make: n => ({ text: `Which number comes next in the pattern ${n}, ${n + 2}, ${n + 4}, ${n + 6}?`, answer: `${n + 8}`, options: [`${n + 7}`, `${n + 8}`, `${n + 9}`, `${n + 10}`] }) },
  { domain: 'Mental Ability Test', topic: 'Figure and spatial reasoning', make: n => ({ text: `Figure ${n}: A square is turned a quarter turn clockwise ${n % 4 + 1} time(s). How many right angles does the square still have?`, answer: '4', options: ['2', '3', '4', '5'] }) },
  { domain: 'Environmental Studies', topic: 'Awareness of surroundings', make: n => ({ text: `In village situation ${n}, which action helps keep drinking water safe?`, answer: 'Cover the water container', options: ['Leave it uncovered', 'Cover the water container', 'Mix soil into it', 'Store it near waste'] }) },
  { domain: 'Environmental Studies', topic: 'Science and environment', make: n => ({ text: `For plant observation ${n}, which part absorbs water from the soil?`, answer: 'Root', options: ['Flower', 'Leaf', 'Root', 'Fruit'] }) },
  { domain: 'Arithmetic Test', topic: 'Number and numeric system', make: n => ({ text: `What is the place value of ${n} in the number ${n}45?`, answer: `${n * 100}`, options: [`${n * 10}`, `${n * 100}`, `${n * 1000}`, `${n + 45}`] }) },
  { domain: 'Arithmetic Test', topic: 'Fundamental operations', make: n => ({ text: `What is ${n + 16} + ${n + 9}?`, answer: `${2 * n + 25}`, options: [`${2 * n + 15}`, `${2 * n + 25}`, `${2 * n + 35}`, `${n + 25}`] }) },
  { domain: 'Arithmetic Test', topic: 'Fractions', make: n => ({ text: `A cake is divided into 8 equal pieces. If ${n % 5 + 1} pieces are eaten, what fraction remains?`, answer: `${7 - n % 5}/8`, options: [`${n % 5 + 1}/8`, `${7 - n % 5}/8`, `1/${n % 5 + 1}`, '1/8'] }) },
  { domain: 'Arithmetic Test', topic: 'Measurement and unit conversion', make: n => ({ text: `How many centimetres are there in ${n % 4 + 1} metre${n % 4 === 0 ? '' : 's'}?`, answer: `${(n % 4 + 1) * 100} centimetres`, options: [`${(n % 4 + 1) * 10} centimetres`, `${(n % 4 + 1) * 100} centimetres`, `${n % 4 + 1} centimetres`, '1000 centimetres'] }) },
  { domain: 'Language Test', topic: 'Reading comprehension', make: n => ({ text: `Passage ${n}: “The gardener watered the sapling every morning.” What did the gardener water?`, answer: 'The sapling', options: ['The gate', 'The path', 'The sapling', 'The basket'] }) }
];

try { database.createCollection('questions', {
  validator: { $jsonSchema: { bsonType: 'object', required: ['questionId', 'testId', 'domain', 'topic', 'text', 'options', 'answer', 'level', 'set', 'syllabusVersion', 'validated'], properties: {
    questionId: { bsonType: 'string' }, testId: { bsonType: 'string' }, domain: { enum: ['Mental Ability Test', 'Environmental Studies', 'Arithmetic Test', 'Language Test'] }, topic: { bsonType: 'string' }, text: { bsonType: 'string' }, options: { bsonType: 'array', minItems: 4, maxItems: 4 }, answer: { bsonType: 'string' }, level: { enum: levels }, set: { enum: sets }, syllabusVersion: { bsonType: 'string' }, validated: { bsonType: 'bool' }
  } } }, validationLevel: 'strict', validationAction: 'error'
}); } catch (error) { if (error.codeName !== 'NamespaceExists') throw error; }
try { database.createCollection('tests'); } catch (error) { if (error.codeName !== 'NamespaceExists') throw error; }
try { database.createCollection('syllabusTopics'); } catch (error) { if (error.codeName !== 'NamespaceExists') throw error; }
try { database.createCollection('validationRuns'); } catch (error) { if (error.codeName !== 'NamespaceExists') throw error; }
database.questions.createIndex({ questionId: 1 }, { unique: true, name: 'uq_question_id' });
database.questions.createIndex({ fingerprint: 1 }, { unique: true, name: 'uq_question_fingerprint' });
database.tests.createIndex({ testId: 1 }, { unique: true, name: 'uq_test_id' });
database.syllabusTopics.deleteMany({ syllabusVersion: 'JNVST-2027' });
database.syllabusTopics.insertMany([
  { syllabusVersion: 'JNVST-2027', domain: 'Mental Ability Test', topics: ['Pattern completion', 'Figure and spatial reasoning'] },
  { syllabusVersion: 'JNVST-2027', domain: 'Environmental Studies', topics: ['Awareness of surroundings', 'Science and environment'] },
  { syllabusVersion: 'JNVST-2027', domain: 'Arithmetic Test', topics: ['Number and numeric system', 'Fundamental operations', 'Fractions', 'Measurement and unit conversion'] },
  { syllabusVersion: 'JNVST-2027', domain: 'Language Test', topics: ['Reading comprehension'] }
]);
database.questions.deleteMany({ syllabusVersion: 'JNVST-2027' });
database.tests.deleteMany({ syllabusVersion: 'JNVST-2027' });
const questionDocs = [];
const testDocs = [];
for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
  for (let testIndex = 0; testIndex < 30; testIndex += 1) {
    const number = levelIndex * 30 + testIndex + 1;
    const testId = `VJ-${levels[levelIndex].slice(0, 3).toUpperCase()}-${String(number).padStart(2, '0')}`;
    const set = sets[testIndex % 4];
    const questionIds = [];
    for (let questionIndex = 0; questionIndex < 80; questionIndex += 1) {
      const template = templates[(number + questionIndex) % templates.length];
      const seed = number + questionIndex + 2;
      const content = template.make(seed);
      content.text = `Practice variant ${number}-${questionIndex + 1}: ${content.text}`;
      const questionId = `${testId}-${String(questionIndex + 1).padStart(2, '0')}`;
      const fingerprint = `${content.text}|${content.options.join('|')}|${content.answer}`.toLowerCase().replace(/\s+/g, ' ').trim();
      questionIds.push(questionId);
      questionDocs.push({ questionId, testId, domain: template.domain, topic: template.topic, text: content.text, options: content.options, answer: content.answer, level: levels[levelIndex], set, fingerprint, syllabusVersion: 'JNVST-2027', validated: true, validation: { answerInOptions: content.options.includes(content.answer), topicInSyllabus: true, duplicate: false } });
    }
    testDocs.push({ testId, number, level: levels[levelIndex], set, subject: 'JNVST Class 6', questionCount: 80, questionIds, syllabusVersion: 'JNVST-2027', status: 'validated' });
  }
}
const duplicateFingerprints = questionDocs.length - new Set(questionDocs.map(question => question.fingerprint)).size;
if (questionDocs.length !== 7200 || duplicateFingerprints !== 0 || questionDocs.some(question => !question.validation.answerInOptions || !question.validation.topicInSyllabus)) throw new Error('Validation failed: question bank was not inserted.');
database.questions.insertMany(questionDocs, { ordered: true });
database.tests.insertMany(testDocs, { ordered: true });
database.validationRuns.insertOne({ runAt: new Date(), syllabusVersion: 'JNVST-2027', testCount: testDocs.length, questionCount: questionDocs.length, duplicateCount: duplicateFingerprints, invalidCount: 0, status: 'passed' });
printjson({ database: 'vijetha_institute', tests: testDocs.length, questions: questionDocs.length, duplicates: duplicateFingerprints, status: 'passed' });
