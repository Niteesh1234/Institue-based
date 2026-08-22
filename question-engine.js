import { createHash } from 'node:crypto';
import { ARITHMETIC_SECTION_PLAN, JNVST_BLUEPRINT, JNVST_LEVELS, JNVST_STANDARD, LANGUAGE_SKILLS, MAT_SECTION_PLAN, TESTING_MODULE_VERSION, syllabusTopicNames } from './syllabus.js';

const optionIds = ['A', 'B', 'C', 'D'];
const levelLabels = { easy: 'Easy', medium: 'Medium', challenging: 'Challenging' };
const names = ['Aarav', 'Aditi', 'Akhil', 'Anaya', 'Arjun', 'Diya', 'Farhan', 'Gauri', 'Harini', 'Ishaan', 'Jaya', 'Kabir', 'Kavya', 'Laksh', 'Meera', 'Naman', 'Neha', 'Omkar', 'Pooja', 'Pranav', 'Rani', 'Rehan', 'Riya', 'Rohan', 'Saanvi', 'Sameer', 'Sara', 'Tanvi', 'Varun', 'Zoya'];
const learningContexts = ['science-club review', 'classroom field note', 'project notebook', 'school exhibition card', 'quiz practice sheet', 'nature-club journal'];
const shapes = ['circle', 'triangle', 'square', 'pentagon'];

function hashNumber(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffle(items, seed) {
  const result = [...items];
  let state = hashNumber(seed) || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function textChoices(answer, distractors) {
  return [{ label: String(answer), correct: true }, ...distractors.map((label) => ({ label: String(label), correct: false }))];
}

function figureChoice(label, figure, correct = false) {
  return { label, figure, correct };
}

function makeOptions(choices, seed) {
  const unique = [...new Map(choices.map((choice) => [JSON.stringify([choice.label, choice.figure || null]), choice])).values()];
  if (unique.length !== 4) throw new Error(`Question choices must contain four unique options: ${JSON.stringify(choices)}`);
  const ordered = shuffle(unique, seed);
  return {
    options: ordered.map((choice, index) => ({ id: optionIds[index], text: choice.label, ...(choice.figure ? { figure: choice.figure } : {}) })),
    correctOption: optionIds[ordered.findIndex((choice) => choice.correct)]
  };
}

function mentalQuestion(topic, seed, levelIndex, syllabusSlot) {
  const paperSerial = Math.floor(seed / 10000);
  const shape = shapes[Math.floor(seed / 3) % shapes.length];
  if (topic === 'Pattern Completion') {
    const signature = Math.floor(seed / 6);
    const patternShape = shapes[signature % shapes.length];
    const start = 1 + (signature % 17);
    const mark = ['dot', 'line', 'cross'][Math.floor(signature / 28) % 3];
    const fill = Math.floor(signature / 84) % 2 ? 'light' : 'none';
    const cornerMark = ['dot-left', 'dot-right', 'dot-top', 'dot-bottom'][Math.floor(signature / 168) % 4];
    if (syllabusSlot.subtopic === 'Number Patterns') {
      const base = 4 + (hashNumber(`number-pattern-${seed}`) % 80);
      const firstStep = 2 + (hashNumber(`number-step-${seed}`) % (4 + levelIndex));
      const steps = levelIndex === 0 ? [firstStep, firstStep, firstStep, firstStep] : levelIndex === 1 ? [firstStep, firstStep + 2, firstStep, firstStep + 2] : [firstStep, firstStep + 1, firstStep + 2, firstStep + 3];
      const sequence = [base];
      for (const step of steps.slice(0, 3)) sequence.push(sequence.at(-1) + step);
      const answer = sequence.at(-1) + steps[3];
      return { stem: 'Select the number that completes the pattern.', stimulus: { kind: 'sequence', items: sequence.map(String) }, choices: textChoices(answer, [answer - 1, answer + 1, answer + firstStep]), explanation: `The successive increases are ${steps.join(', ')}.`, part: syllabusSlot.part, syllabusSubtopics: [syllabusSlot.subtopic], skillCode: syllabusSlot.skillCode };
    }
    if (syllabusSlot.subtopic === 'Alphabet Patterns') {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const step = 1 + Math.floor((paperSerial - 1) / 10);
      const start = (paperSerial - 1) % 10;
      const sequence = [0, 1, 2, 3].map((index) => alphabet[start + index * step]);
      const answerIndex = start + 4 * step;
      const answer = alphabet[answerIndex];
      const distractors = [1, 2, 3].map((offset) => alphabet[(answerIndex + offset) % alphabet.length]);
      return { stem: 'Select the letter that completes the alphabetical pattern.', stimulus: { kind: 'sequence', items: sequence }, choices: textChoices(answer, distractors), explanation: `The sequence moves forward ${step} letter${step === 1 ? '' : 's'} each time.`, part: syllabusSlot.part, syllabusSubtopics: [syllabusSlot.subtopic], skillCode: syllabusSlot.skillCode };
    }
    if (syllabusSlot.subtopic === 'Figure Patterns') {
      const sequence = [0, 1, 2, 3].map((index) => ({ shape: patternShape, rotation: 0, mark, cornerMark, fill, count: start + index }));
      const correct = { shape: patternShape, rotation: 0, mark, cornerMark, fill, count: start + 4 };
      return { stem: 'Choose the figure that completes the increasing visual pattern.', stimulus: { kind: 'figure-sequence', items: sequence }, choices: [figureChoice(`${patternShape} with ${start + 4} marks`, correct, true), figureChoice(`${patternShape} with ${start + 3} marks`, { ...correct, count: start + 3 }), figureChoice(`${patternShape} with ${start + 5} marks`, { ...correct, count: start + 5 }), figureChoice(`${patternShape} with ${start + 2} marks`, { ...correct, count: start + 2 })], explanation: 'One mark is added to the figure at every step.', part: syllabusSlot.part, syllabusSubtopics: [syllabusSlot.subtopic], skillCode: syllabusSlot.skillCode };
    }
    const sequence = [0, 1, 2, 3].map((index) => ({ shape: shapes[(seed + index) % shapes.length], rotation: index * 90, mark, count: start + index }));
    const correct = { shape: shapes[(seed + 4) % shapes.length], rotation: 0, mark, count: start + 4 };
    return { stem: `On pattern card ${paperSerial}, both the outline and the internal marks follow a rule. Which figure comes next?`, stimulus: { kind: 'figure-sequence', items: sequence }, choices: [figureChoice('Correct two-rule continuation', correct, true), figureChoice('Incorrect outline', { ...correct, shape: shapes[(seed + 3) % shapes.length] }), figureChoice('Incorrect mark count', { ...correct, count: start + 3 }), figureChoice('Incorrect rotation', { ...correct, rotation: 180 })], explanation: 'The outline follows the same four-shape cycle while one internal mark is added at each step.', part: syllabusSlot.part, syllabusSubtopics: [syllabusSlot.subtopic], skillCode: syllabusSlot.skillCode };
  }

  if (topic === 'Figure Series Completion') {
    const secondShape = shapes[(seed + 1 + levelIndex) % shapes.length];
    const mark = ['dot', 'line', 'cross'][seed % 3];
    const correctFigure = { shape, rotation: (seed % 4) * 90, mark, fill: seed % 2 ? 'light' : 'none' };
    const otherFigure = { shape: secondShape, rotation: ((seed + 1) % 4) * 90, mark: 'none', fill: 'none' };
    return {
      stem: `Series panel ${seed} follows an alternating rule. Select the figure that comes next.`,
      stimulus: { kind: 'figure-sequence', items: [correctFigure, otherFigure, correctFigure, otherFigure] },
      choices: [
        figureChoice(`${shape} with ${mark}`, correctFigure, true),
        figureChoice(secondShape, otherFigure),
        figureChoice(`rotated ${shape}`, { ...correctFigure, rotation: correctFigure.rotation + 90 }),
        figureChoice(`${shape} without a mark`, { ...correctFigure, mark: 'none' })
      ],
      explanation: `The series alternates between the marked ${shape} and the ${secondShape}.`, part: syllabusSlot.part, syllabusSubtopics: [syllabusSlot.subtopic], skillCode: syllabusSlot.skillCode
    };
  }

  if (topic === 'Geometrical Figure Completion') {
    const sideCount = [3, 4, 5, 6][seed % 4];
    const targetShape = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon' }[sideCount];
    const sideLength = 2 + (seed % 29);
    return {
      stem: `Geometric design ${seed} has a gap with ${sideCount} equal sides of ${sideLength} cm each. Which complete figure fits the gap?`,
      stimulus: { kind: 'outline', figure: { shape: targetShape, mark: 'gap', fill: 'none' } },
      choices: ['triangle', 'square', 'pentagon', 'hexagon'].map((item) => figureChoice(item, { shape: item, fill: 'none', mark: 'none' }, item === targetShape)),
      explanation: `A closed figure with ${sideCount} sides is a ${targetShape}.`, part: syllabusSlot.part, syllabusSubtopics: [syllabusSlot.subtopic], skillCode: syllabusSlot.skillCode
    };
  }

  if (topic === 'Mirror Imaging') {
    const code = `${String.fromCharCode(65 + (seed % 20))}${10 + (seed % 89)}`;
    const correctFigure = { shape: 'arrow', rotation: 180, mark: 'dot-right', fill: 'none' };
    return {
      stem: `A vertical mirror is placed to the right of card ${code}. The card shows a right-pointing arrow with a dot on its left. Choose its mirror image.`,
      stimulus: { kind: 'mirror', figure: { shape: 'arrow', rotation: 0, mark: 'dot-left', fill: 'none' } },
      choices: [
        figureChoice('Left arrow; dot on right', correctFigure, true),
        figureChoice('Right arrow; dot on right', { shape: 'arrow', rotation: 0, mark: 'dot-right' }),
        figureChoice('Left arrow; dot on left', { shape: 'arrow', rotation: 180, mark: 'dot-left' }),
        figureChoice('Down arrow; dot above', { shape: 'arrow', rotation: 90, mark: 'dot-top' })
      ],
      explanation: 'A vertical mirror reverses left and right but does not reverse top and bottom.', part: syllabusSlot.part, syllabusSubtopics: [syllabusSlot.subtopic], skillCode: syllabusSlot.skillCode
    };
  }

  if (topic === 'Water Imaging') {
    const count = 1 + (seed % 5);
    const correctFigure = { shape: 'arrow', rotation: 90, mark: `dots-top-${count}`, fill: 'none' };
    return {
      stem: `Symbol card ${seed}-${String.fromCharCode(75 + (seed % 10))} contains an upward arrow with ${count} dot${count === 1 ? '' : 's'} below it. Choose its water image.`,
      stimulus: { kind: 'water', figure: { shape: 'arrow', rotation: 270, mark: `dots-bottom-${count}`, fill: 'none' } },
      choices: [
        figureChoice('Down arrow; dots above', correctFigure, true),
        figureChoice('Up arrow; dots above', { shape: 'arrow', rotation: 270, mark: `dots-top-${count}` }),
        figureChoice('Left arrow; dots below', { shape: 'arrow', rotation: 180, mark: `dots-bottom-${count}` }),
        figureChoice('Down arrow; dots below', { shape: 'arrow', rotation: 90, mark: `dots-bottom-${count}` })
      ],
      explanation: 'A water image reverses top and bottom while left and right remain unchanged.', part: syllabusSlot.part, syllabusSubtopics: [syllabusSlot.subtopic], skillCode: syllabusSlot.skillCode
    };
  }

  const hiddenShape = shapes[(seed + levelIndex) % shapes.length];
  const lineCount = 5 + (seed % 9);
  return {
    stem: `Diagram ${seed} is made with ${lineCount} straight and curved lines and contains one complete simple figure. Which figure is embedded without changing any line?`,
    stimulus: { kind: 'embedded', figure: { shape: hiddenShape, mark: `network-${lineCount}`, fill: 'none' } },
    choices: shapes.map((item) => figureChoice(item, { shape: item, fill: 'none', mark: 'none' }, item === hiddenShape)),
    explanation: `The complete outline of a ${hiddenShape} can be traced inside the drawing.`, part: syllabusSlot.part, syllabusSubtopics: [syllabusSlot.subtopic], skillCode: syllabusSlot.skillCode
  };
}

const evsFacts = {
  Transportation: ['Which vehicle is designed to travel on railway tracks?', 'Train', ['Boat', 'Bicycle', 'Aeroplane'], 'A train moves on railway tracks.'],
  Rivers: ['Which action best protects a river from pollution?', 'Treat waste before discharge', ['Dump plastic waste', 'Wash vehicles in the river', 'Burn waste on the bank'], 'Treating waste prevents harmful material from entering river water.'],
  Mountains: ['Why is the air generally cooler at a high mountain location?', 'Temperature falls with altitude', ['Mountains create cold air', 'Rocks absorb every sunray', 'Rivers cool all mountains'], 'Air temperature generally decreases as altitude increases.'],
  Plants: ['Which plant part mainly absorbs water and minerals from soil?', 'Roots', ['Flowers', 'Fruits', 'Seeds'], 'Roots absorb water and minerals and anchor the plant.'],
  'Animals on Land and in Water': ['Which animal can naturally live both on land and in water?', 'Frog', ['Camel', 'Eagle', 'Cow'], 'A frog is an amphibian and can live on land and in water.'],
  'Natural Disasters': ['What is the safest immediate action indoors during an earthquake?', 'Drop, cover and hold', ['Use a lift', 'Stand beside glass windows', 'Run onto a balcony'], 'Drop, cover and hold protects the head and body from falling objects.'],
  'Houses and Shelters': ['Which house is most suitable in an area that floods frequently?', 'A house on stilts', ['A deep basement house', 'A tent in a riverbed', 'A house without drainage'], 'Stilts raise the living area above likely floodwater.'],
  'Water Cycle': ['What is the change of water vapour into tiny liquid drops called?', 'Condensation', ['Evaporation', 'Infiltration', 'Collection'], 'Cooling water vapour changes it into droplets through condensation.'],
  'Food and Nutrients': ['Which nutrient mainly supports body growth and tissue repair?', 'Protein', ['Roughage', 'Water', 'Mineral salt'], 'Proteins are body-building nutrients.'],
  'Hygiene and Cleanliness': ['Which habit best limits the spread of germs before eating?', 'Wash hands with soap', ['Share an unwashed towel', 'Leave food uncovered', 'Touch the face repeatedly'], 'Soap and clean water remove many disease-causing germs from hands.'],
  'Super Senses': ['Which sense organ allows a person to detect different smells?', 'Nose', ['Tongue', 'Skin', 'Ear'], 'Smell receptors are located in the nose.'],
  'Digestive System': ['In which organ does digestion begin?', 'Mouth', ['Lungs', 'Heart', 'Kidneys'], 'Chewing and saliva begin digestion in the mouth.'],
  'Circulatory System': ['Which organ pumps blood around the body?', 'Heart', ['Stomach', 'Lungs', 'Brain'], 'The heart pumps blood through blood vessels.'],
  'Respiratory System': ['Which organs take oxygen from inhaled air?', 'Lungs', ['Kidneys', 'Intestines', 'Bones'], 'Gas exchange takes place in the lungs.'],
  'Food Preservation': ['Which process preserves milk by controlled heating and cooling?', 'Pasteurisation', ['Pollination', 'Germination', 'Sedimentation'], 'Pasteurisation reduces harmful microorganisms in milk.'],
  'Water Pollution': ['Which activity is a direct cause of water pollution?', 'Releasing untreated sewage', ['Harvesting rainwater', 'Planting trees', 'Repairing a leaking tap'], 'Untreated sewage introduces waste and disease-causing organisms into water.'],
  'Air Pollution': ['Which choice can reduce air pollution in a busy town?', 'Use public transport', ['Burn fallen leaves', 'Keep engines idling', 'Burn plastic waste'], 'Public transport can reduce the number of vehicles and their emissions.'],
  'Conservation of Water': ['Which household action conserves the most water?', 'Repair a leaking tap', ['Let a tank overflow', 'Keep the tap running while brushing', 'Wash one utensil at a time under running water'], 'Repairing leaks prevents continuous water loss.'],
  'Conservation of Soil': ['How do tree roots help conserve soil?', 'They hold soil particles together', ['They remove every mineral', 'They turn soil into rock', 'They stop all water entering soil'], 'Roots bind soil and reduce erosion by wind and water.'],
  'Superlatives of India': ['Which is the largest Indian state by area?', 'Rajasthan', ['Goa', 'Sikkim', 'Kerala'], 'Rajasthan is India’s largest state by geographical area.'],
  'States and Capitals': ['What is the capital of Rajasthan?', 'Jaipur', ['Bhopal', 'Patna', 'Panaji'], 'Jaipur is the capital city of Rajasthan.'],
  'National Symbols': ['Which animal is the national animal of India?', 'Bengal tiger', ['Asian elephant', 'Indian peacock', 'One-horned rhinoceros'], 'The Bengal tiger is India’s national animal.'],
  Landscapes: ['Which landscape is a broad, mostly flat area of land?', 'Plain', ['Mountain', 'Valley', 'Island'], 'A plain is an extensive, mostly level area.'],
  Festivals: ['Which celebration is widely called the festival of lights?', 'Diwali', ['Onam', 'Baisakhi', 'Pongal'], 'Lamps and lights are a central part of Diwali celebrations.'],
  Seasons: ['Which season brings widespread rainfall to much of India?', 'Monsoon', ['Winter', 'Spring', 'Autumn'], 'Monsoon winds bring seasonal rainfall to much of India.'],
  Forests: ['Why are forests important for wild animals?', 'They provide food and shelter', ['They stop every rainfall', 'They prevent plant growth', 'They make fresh water salty'], 'Forests provide habitat, food, nesting places and protection.'],
  Crops: ['Which crop is commonly cultivated in fields containing standing water?', 'Rice', ['Gram', 'Mustard', 'Bajra'], 'Rice commonly grows in flooded or very wet fields.'],
  'Clothes and Fibres': ['Which natural fibre is obtained from a plant?', 'Cotton', ['Nylon', 'Polyester', 'Acrylic'], 'Cotton fibre grows around the seeds of the cotton plant.']
};

function evsQuestion(topic, seed, levelIndex) {
  const [baseStem, answer, distractors, explanation] = evsFacts[topic];
  const student = names[seed % names.length];
  const context = learningContexts[Math.floor(seed / names.length) % learningContexts.length];
  const stems = [
    `${student} is completing a ${context}. ${baseStem}`,
    `During ${student}'s ${context}, the group discusses ${topic.toLowerCase()}. ${baseStem}`,
    `${student} must choose the scientifically correct statement for a ${context}. ${baseStem}`
  ];
  const stem = stems[(seed + levelIndex) % stems.length];
  return { stem, choices: textChoices(answer, distractors), explanation };
}

function evsSectionPlan(difficulty, paperIndex) {
  const topics = syllabusTopicNames(JNVST_BLUEPRINT.find((section) => section.key === 'evs'));
  const order = shuffle(topics, `EVS-${difficulty}`);
  const offset = (paperIndex * 14) % topics.length;
  const selected = Array.from({ length: 20 }, (_, index) => order[(offset + index) % order.length]);
  return { standaloneTopics: selected.slice(0, 15), passageTopics: selected.slice(15), allTopics: selected };
}

function evsPassageQuestions(testId, difficulty, paperIndex, topics) {
  const facts = topics.map((topic) => {
    const [, answer, , explanation] = evsFacts[topic];
    return { topic, answer, statement: explanation };
  });
  const passageId = `${testId}-EVS-P1`;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const student = names[(paperIndex * 3 + JNVST_LEVELS.indexOf(difficulty) * 10) % names.length];
  const resource = ['field notebook', 'science-fair booklet', 'community survey', 'revision journal', 'nature-club record'][paperIndex % 5];
  const passage = `On ${days[paperIndex % days.length]}, ${student}'s group checked a ${resource} and kept five verified EVS notes. ${facts.map((fact) => fact.statement).join(' ')}`;
  return {
    passageId,
    passage,
    questions: facts.map((fact, index) => {
      const distractors = facts.filter((candidate) => candidate.topic !== fact.topic).map((candidate) => candidate.answer).slice(0, 3);
      const prompt = difficulty === 'easy'
        ? `Which answer matches the note about ${fact.topic.toLowerCase()}?`
        : difficulty === 'medium'
          ? `Based on the study notes, which conclusion about ${fact.topic.toLowerCase()} is correct?`
          : `Which option is best supported by the evidence about ${fact.topic.toLowerCase()} in the notes?`;
      return { topic: fact.topic, stem: prompt, choices: textChoices(fact.answer, distractors), explanation: fact.statement, coverageTopics: [fact.topic], passageQuestionIndex: index };
    })
  };
}

const smallNumbers = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tensNames = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function numberToWords(value) {
  if (value < 20) return smallNumbers[value];
  if (value < 100) return `${tensNames[Math.floor(value / 10)]}${value % 10 ? `-${smallNumbers[value % 10]}` : ''}`;
  if (value < 1000) return `${smallNumbers[Math.floor(value / 100)]} hundred${value % 100 ? ` ${numberToWords(value % 100)}` : ''}`;
  return `${smallNumbers[Math.floor(value / 1000)]} thousand${value % 1000 ? ` ${numberToWords(value % 1000)}` : ''}`;
}

function arithmeticQuestion(topic, seed, levelIndex, syllabusSlot) {
  const scale = levelIndex + 1;
  const paperSerial = Math.floor(seed / 10000);
  const student = names[paperSerial - 1];
  const tagged = (question) => ({ ...question, syllabusSubtopics: [syllabusSlot.subtopic], skillCode: syllabusSlot.skillCode });
  const code = syllabusSlot.skillCode;

  if (code === 'arithmetic-place-value-number-names') {
    const number = 2100 + (hashNumber(`place-${seed}`) % 7700);
    const thousands = Math.floor(number / 1000);
    const correct = `${numberToWords(number)}; ${thousands * 1000}`;
    return tagged({ stem: `Which option gives the correct number name for ${number.toLocaleString('en-IN')} and the place value of ${thousands}?`, choices: textChoices(correct, [`${numberToWords(number + 10)}; ${thousands * 1000}`, `${numberToWords(number)}; ${thousands * 100}`, `${numberToWords(number + 100)}; ${thousands}`]), explanation: `${number.toLocaleString('en-IN')} is ${numberToWords(number)}, and ${thousands} is in the thousands place.` });
  }
  if (code === 'arithmetic-ordering') {
    const base = 1000 + (hashNumber(`order-${seed}`) % 7000);
    const values = [base, base + 17 + scale, base + 43 + scale * 2, base + 71 + scale * 3];
    const ascending = seed % 2 === 0;
    const sorted = [...values].sort((a, b) => ascending ? a - b : b - a);
    const label = (items) => items.map((value) => value.toLocaleString('en-IN')).join(ascending ? ' < ' : ' > ');
    return tagged({ stem: `Which option arranges ${values.map((value) => value.toLocaleString('en-IN')).join(', ')} in ${ascending ? 'ascending' : 'descending'} order?`, choices: textChoices(label(sorted), [label([...sorted].reverse()), label([sorted[1], sorted[0], sorted[2], sorted[3]]), label([sorted[0], sorted[2], sorted[1], sorted[3]])]), explanation: `${label(sorted)} is the required ${ascending ? 'ascending' : 'descending'} order.` });
  }
  if (code === 'arithmetic-rounding') {
    const number = 1234 + (hashNumber(`round-${seed}`) % 7500);
    const rounded = [10, 100, 1000].map((unit) => Math.round(number / unit) * unit);
    const label = (items) => `10 → ${items[0].toLocaleString('en-IN')}; 100 → ${items[1].toLocaleString('en-IN')}; 1000 → ${items[2].toLocaleString('en-IN')}`;
    return tagged({ stem: `Which option correctly rounds ${number.toLocaleString('en-IN')} to the nearest 10, 100 and 1000?`, choices: textChoices(label(rounded), [label([rounded[0] + 10, rounded[1], rounded[2]]), label([rounded[0], rounded[1] + 100, rounded[2]]), label([rounded[0], rounded[1], rounded[2] + 1000])]), explanation: `The rounded values are ${label(rounded)}.` });
  }
  if (code === 'arithmetic-addition-subtraction') {
    const start = 120 + (hashNumber(`add-start-${seed}`) % (400 * scale));
    const added = 30 + (hashNumber(`add-more-${seed}`) % (100 * scale));
    const removed = 10 + (hashNumber(`add-remove-${seed}`) % Math.max(20, added));
    const answer = start + added - removed;
    return tagged({ stem: `A library had ${start} books, received ${added} more and then lent ${removed}. How many books remain?`, choices: textChoices(answer, [start + added, answer + added, answer - 10]), explanation: `${start} + ${added} − ${removed} = ${answer}.` });
  }
  if (code === 'arithmetic-multiplication-division') {
    const boxes = 3 + (seed % (4 + scale));
    const teams = 2 + (Math.floor(seed / 7) % 4);
    const unit = 3 + (Math.floor(seed / 11) % (7 + scale));
    const each = teams * unit;
    const total = boxes * each;
    const answer = total / teams;
    return tagged({ stem: `${student} arranges ${boxes} boxes with ${each} counters each. All ${total} counters are shared equally among ${teams} teams. How many counters does each team receive?`, choices: textChoices(answer, [total, answer + teams, Math.max(1, answer - teams)]), explanation: `Multiply to get ${boxes} × ${each} = ${total}, then divide: ${total} ÷ ${teams} = ${answer}.` });
  }
  if (code === 'arithmetic-factors-multiples') {
    const factor = 3 + (seed % 12);
    const multiplier = 4 + (Math.floor(seed / 13) % 19);
    const value = factor * multiplier;
    const correct = `${factor} is a factor of ${value}, and ${value} is a multiple of ${factor}.`;
    return tagged({ stem: `For the numbers ${factor} and ${value}, which statement correctly describes both a factor and a multiple?`, choices: textChoices(correct, [`${value} is a factor of ${factor}.`, `${factor + 1} is a factor of ${value}.`, `${value - 1} is a multiple of ${factor}.`]), explanation: `${value} ÷ ${factor} = ${multiplier} exactly, so both parts of the statement are true.` });
  }
  if (code === 'arithmetic-like-fraction-add-subtract') {
    const denominator = 9 + (seed % 23);
    const first = 2 + (Math.floor(seed / 5) % 4);
    const second = 2 + (Math.floor(seed / 7) % 4);
    const removed = 1 + (Math.floor(seed / 11) % Math.min(3, first + second - 1));
    const numerator = first + second - removed;
    return tagged({ stem: `Simplify ${first}/${denominator} + ${second}/${denominator} − ${removed}/${denominator}.`, choices: textChoices(`${numerator}/${denominator}`, [`${numerator + 1}/${denominator}`, `${numerator + 2}/${denominator}`, `${numerator + 3}/${denominator}`]), explanation: `For like fractions, combine the numerators: ${first} + ${second} − ${removed} = ${numerator}.` });
  }
  if (code === 'arithmetic-fraction-multiplication') {
    const denominator = 4 + (seed % 8);
    const numerator = 1 + (Math.floor(seed / 3) % (denominator - 1));
    const units = 4 + (Math.floor(seed / 17) % (10 * scale));
    const whole = denominator * units;
    const answer = numerator * units;
    return tagged({ stem: `${student} needs ${numerator}/${denominator} of ${whole} counters. How many counters are needed?`, choices: textChoices(answer, [answer + 1, answer + 2, answer + 3]), explanation: `${whole} ÷ ${denominator} × ${numerator} = ${answer}.` });
  }
  if (code === 'arithmetic-length-mass') {
    const kilometres = 2 + (seed % 9);
    const metres = 20 + (Math.floor(seed / 7) % 900);
    const kilograms = 1 + (Math.floor(seed / 11) % 8);
    const grams = 25 + (Math.floor(seed / 13) % 900);
    const answer = `${kilometres * 1000 + metres} m and ${kilograms * 1000 + grams} g`;
    return tagged({ stem: `Convert ${kilometres} km ${metres} m into metres and ${kilograms} kg ${grams} g into grams.`, choices: textChoices(answer, [`${kilometres * 100 + metres} m and ${kilograms * 100 + grams} g`, `${kilometres * 1000} m and ${kilograms * 1000} g`, `${kilometres + metres} m and ${kilograms + grams} g`]), explanation: 'Use 1 km = 1000 m and 1 kg = 1000 g, then add the remaining units.' });
  }
  if (code === 'arithmetic-capacity') {
    const litres = 2 + (seed % 18);
    const millilitres = 25 + (Math.floor(seed / 9) % 900);
    const answer = litres * 1000 + millilitres;
    return tagged({ stem: `Convert ${litres} L ${millilitres} mL completely into millilitres.`, choices: textChoices(`${answer} mL`, [`${litres * 100 + millilitres} mL`, `${litres + millilitres} mL`, `${answer + 1000} mL`]), explanation: `${litres} L = ${litres * 1000} mL; adding ${millilitres} mL gives ${answer} mL.` });
  }
  if (code === 'arithmetic-time') {
    const hours = 1 + (seed % (5 + scale));
    const minutes = 5 + (Math.floor(seed / 11) % 55);
    const answer = hours * 60 + minutes;
    return tagged({ stem: `${student}'s journey lasts ${hours} hours ${minutes} minutes. How many minutes is that altogether?`, choices: textChoices(`${answer} minutes`, [`${hours * 100 + minutes} minutes`, `${answer + 60} minutes`, `${hours + minutes} minutes`]), explanation: `${hours} × 60 + ${minutes} = ${answer} minutes.` });
  }
  if (code === 'arithmetic-money') {
    const price = 12 + (seed % (30 * scale));
    const quantity = 2 + (Math.floor(seed / 5) % 6);
    const paid = Math.ceil((price * quantity + 20) / 50) * 50;
    const answer = paid - price * quantity;
    return tagged({ stem: `${student} buys ${quantity} notebooks costing ₹${price} each and pays ₹${paid}. What change should be received?`, choices: textChoices(`₹${answer}`, [`₹${answer + price}`, `₹${answer + quantity}`, `₹${answer + price + quantity}`]), explanation: `Cost = ${quantity} × ₹${price} = ₹${price * quantity}; change = ₹${paid} − ₹${price * quantity} = ₹${answer}.` });
  }
  if (code === 'arithmetic-simplification') {
    const base = 8 + (seed % 43);
    const multiplier = 2 + (seed % 7);
    const addend = 3 + ((seed * 11) % 19);
    const answer = base + multiplier * addend;
    return tagged({ stem: `Simplify: ${base} + ${multiplier} × ${addend}.`, choices: textChoices(answer, [answer + 1, answer + 2, answer + 3]), explanation: `Multiply before adding: ${multiplier} × ${addend} = ${multiplier * addend}; then add ${base}.` });
  }
  if (code === 'arithmetic-polygon-perimeter') {
    const sides = 3 + (seed % 6);
    const sideLength = 4 + (Math.floor(seed / 7) % (15 * scale));
    const answer = sides * sideLength;
    return tagged({ stem: `${student} draws a regular polygon with ${sides} equal sides of ${sideLength} cm each. What is its perimeter?`, choices: textChoices(`${answer} cm`, [`${answer + 1} cm`, `${answer + 2} cm`, `${answer + 3} cm`]), explanation: `Perimeter = ${sides} × ${sideLength} = ${answer} cm.` });
  }
  if (code === 'arithmetic-square-rectangle-area') {
    const squareSide = 3 + (seed % (9 + scale));
    const length = squareSide + 3 + levelIndex;
    const width = 2 + (Math.floor(seed / 7) % squareSide);
    const answer = squareSide ** 2 + length * width;
    return tagged({ stem: `${student}'s diagram has a square of side ${squareSide} cm and a rectangle measuring ${length} cm by ${width} cm. What is their combined area?`, choices: textChoices(`${answer} cm²`, [`${answer - squareSide} cm²`, `${answer + width} cm²`, `${answer + length} cm²`]), explanation: `Square area ${squareSide}² plus rectangle area ${length} × ${width} gives ${answer} cm².` });
  }
  if (code === 'arithmetic-triangle-area') {
    const length = 6 + 2 * (seed % (8 + scale));
    const width = 3 + (Math.floor(seed / 5) % (8 + scale));
    const rectangleArea = length * width;
    const answer = rectangleArea / 2;
    return tagged({ stem: `${student} draws a diagonal across a ${length} cm by ${width} cm rectangle to form two equal triangles. What is the area of one triangle?`, choices: textChoices(`${answer} cm²`, [`${rectangleArea} cm²`, `${answer + length} cm²`, `${answer + width} cm²`]), explanation: `The rectangle area is ${rectangleArea} cm², so one of the two equal triangles has area ${answer} cm².` });
  }
  if (code === 'arithmetic-angle-types') {
    const angles = [35 + (seed % 40), 90, 100 + (seed % 70), 180];
    const angle = angles[seed % angles.length];
    const answer = angle < 90 ? 'Acute angle' : angle === 90 ? 'Right angle' : angle < 180 ? 'Obtuse angle' : 'Straight angle';
    return tagged({ stem: `${student} measures an angle as ${angle}°. What type of angle is it?`, choices: textChoices(answer, ['Acute angle', 'Right angle', 'Obtuse angle', 'Straight angle'].filter((item) => item !== answer)), explanation: `${angle}° is classified as a ${answer.toLowerCase()}.` });
  }
  if (code === 'arithmetic-directions-mapping') {
    const directions = ['north', 'east', 'south', 'west'];
    const startIndex = seed % 4;
    const turns = 1 + ((seed * 5) % 3);
    const clockwise = seed % 2 === 0;
    const endIndex = (startIndex + (clockwise ? turns : -turns) + 8) % 4;
    const distance = 5 + (Math.floor(seed / 5) % 97);
    return tagged({ stem: `On a neighbourhood map, ${names[seed % names.length]} walks ${distance} m facing ${directions[startIndex]}, then makes ${turns} right-angle turn${turns === 1 ? '' : 's'} ${clockwise ? 'clockwise' : 'anticlockwise'}. Which direction is now faced?`, choices: textChoices(directions[endIndex], directions.filter((direction) => direction !== directions[endIndex])), explanation: `${turns} quarter-turn${turns === 1 ? '' : 's'} ${clockwise ? 'clockwise' : 'anticlockwise'} from ${directions[startIndex]} leads to ${directions[endIndex]}.` });
  }
  if (code === 'arithmetic-table-bar') {
    const rows = [['Books', 4 + (seed % 9)], ['Plants', 7 + (Math.floor(seed / 7) % 10)], ['Models', 10 + (Math.floor(seed / 11) % 11)]];
    const highest = [...rows].sort((first, second) => second[1] - first[1])[0];
    return tagged({ stem: 'The table and matching bar diagram show project counts. Which category has the tallest bar?', stimulus: { kind: 'bar', rows }, choices: textChoices(highest[0], rows.filter((row) => row[0] !== highest[0]).map((row) => row[0]).concat('All are equal').slice(0, 3)), explanation: `${highest[0]} has the greatest value, ${highest[1]}, so its bar is tallest.` });
  }
  const key = 2 + (seed % 4);
  const rows = [['Kites', 2 + (seed % 4)], ['Boats', 4 + (Math.floor(seed / 5) % 4)], ['Trees', 6 + (Math.floor(seed / 7) % 4)]];
  const target = rows[1];
  const answer = target[1] * key;
  return tagged({ stem: `${student}'s pictograph uses one symbol for ${key} items. How many ${target[0].toLowerCase()} are represented?`, stimulus: { kind: 'pictograph', key, rows }, choices: textChoices(answer, [target[1], answer + key, Math.max(key, answer - key)]), explanation: `${target[1]} symbols × ${key} items per symbol = ${answer}.` });
}

function passageSet(kind, level, paperIndex) {
  const levelOffset = JNVST_LEVELS.indexOf(level) * 10;
  const student = names[(paperIndex * 4 + kind + levelOffset) % names.length];
  const amount = 3 + ((paperIndex * 5 + kind * 7 + levelOffset) % 18);
  const settings = ['village', 'school', 'neighbourhood', 'hill town'];
  const setting = settings[(paperIndex + kind) % settings.length];
  const variants = [
    {
      title: 'Saving Water Together',
      vocabulary: ['carefully', 'with attention'],
      passage: `${student} noticed that several taps in the ${setting} garden dripped after closing time. With the caretaker's permission, the eco-club measured the wasted water for ${amount} minutes and replaced two worn washers. The club also placed a reminder beside each tap. A week later, the storage tank lasted longer each day.`,
      direct: [`What did the eco-club replace?`, 'Two worn washers', ['The storage tank', 'Garden plants', 'Water bottles']],
      inference: [`Why did the storage tank last longer?`, 'Less water was being wasted', ['The tank became larger', 'It rained every day', 'The garden was closed']],
      cause: [`What happened after the washers and reminders were added?`, 'The tank lasted longer', ['All taps were removed', 'The garden flooded', 'The caretaker left']],
      main: 'Small repairs can conserve water'
    },
    {
      title: 'The Saturday Reading Circle',
      vocabulary: ['volunteered', 'offered willingly'],
      passage: `Every Saturday, ${student} helped arrange a reading circle in the ${setting} library. Each child selected one book, read with a partner for ${amount + 8} minutes, and shared a new word. At first, only a few children spoke. By the fourth meeting, even quiet readers volunteered to describe their favourite scenes.`,
      direct: [`What did each child share?`, 'A new word', ['A packed lunch', 'A library key', 'A drawing tool']],
      inference: [`What can be inferred about the reading circle?`, "It increased the children's confidence", ['It made the library smaller', 'It stopped children borrowing books', 'It was only for adults']],
      cause: [`What changed by the fourth meeting?`, 'Quiet readers began speaking', ['The library closed', 'Books were no longer used', 'Saturday meetings ended']],
      main: 'Reading together builds confidence'
    },
    {
      title: 'A Seed Experiment',
      vocabulary: ['observed', 'watched and noted'],
      passage: `${student}'s class placed equal bean seeds in three labelled cups. Cup A received water and sunlight, Cup B received sunlight but no water, and Cup C received water but stayed in a dark box. For ${amount} days, the class observed the cups without changing their positions. Only the seeds with suitable conditions grew into healthy green seedlings.`,
      direct: [`Which cup received sunlight but no water?`, 'Cup B', ['Cup A', 'Cup C', 'Every cup']],
      inference: [`Why were the cups kept in fixed positions?`, 'To make the comparison fair', ['To hide the labels', 'To stop all growth', 'To warm the classroom']],
      cause: [`What allowed healthy green seedlings to grow?`, 'Suitable water and light conditions', ['A missing label', 'A dark box alone', 'Dry soil alone']],
      main: 'Seeds need suitable conditions to grow'
    },
    {
      title: 'Safe Shelter from a Storm',
      vocabulary: ['sturdy', 'strong and firm'],
      passage: `Dark clouds gathered while ${student}'s family was returning through the ${setting} after buying ${amount} items. They heard thunder and moved away from an open field and a tall isolated tree. The family waited inside a sturdy building until the storm passed, then continued home together.`,
      direct: [`Where did the family wait?`, 'Inside a sturdy building', ['Under an isolated tree', 'In the open field', 'Beside a metal fence']],
      inference: [`Why did the family avoid the isolated tree?`, 'It was unsafe during lightning', ['It had no leaves', 'It was too short', 'They wanted to buy fruit']],
      cause: [`What did the family do after the storm passed?`, 'Continued home together', ['Returned to the open field', 'Climbed the tree', 'Stayed outside all night']],
      main: 'Seek safe shelter during a storm'
    }
  ];
  const selected = variants[kind];
  const vocabularyWord = selected.vocabulary[0];
  const vocabularyMeaning = selected.vocabulary[1];
  const difficultyPrompt = level === 'easy' ? 'Which title best matches the passage?' : level === 'medium' ? 'Which statement best expresses the passage’s main idea?' : 'Which conclusion is best supported by the whole passage?';
  return {
    passageId: `PASS-${level.slice(0, 3).toUpperCase()}-${String(paperIndex + 1).padStart(2, '0')}-${kind + 1}`,
    passage: selected.passage,
    questions: [
      { stem: selected.direct[0], choices: textChoices(selected.direct[1], selected.direct[2]), explanation: 'This detail is stated directly in the passage.', coverageTopics: ['Direct Comprehension'] },
      { stem: `What does “${vocabularyWord}” mean as used in the passage?`, choices: textChoices(vocabularyMeaning, ['moved without purpose', 'made very noisy', 'hidden from view']), explanation: `In this context, “${vocabularyWord}” means “${vocabularyMeaning}.”`, coverageTopics: ['Vocabulary in Context'] },
      { stem: selected.inference[0], choices: textChoices(selected.inference[1], selected.inference[2]), explanation: 'This inference follows from the events and details in the passage.', coverageTopics: ['Inference'] },
      { stem: selected.cause[0], choices: textChoices(selected.cause[1], selected.cause[2]), explanation: 'The passage links this result to the preceding action or condition.', coverageTopics: ['Cause and Effect'] },
      { stem: difficultyPrompt, choices: textChoices(selected.main, [selected.title === selected.main ? 'A completely unrelated event' : selected.title, 'Why rules should never change', 'A problem with no possible solution']), explanation: `The complete passage supports the main idea: “${selected.main}.”`, coverageTopics: ['Main Idea'] }
    ]
  };
}

function normalizedText(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}

function hashPayload(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function visibleOption(option) {
  return option.figure ? `figure:${JSON.stringify(option.figure)}` : `text:${normalizedText(option.text)}`;
}

function promptFingerprintFor(question) {
  return hashPayload({ subject: question.subject, passage: normalizedText(question.passage), stem: normalizedText(question.stem), stimulus: question.stimulus || null });
}

function renderFingerprintFor(question) {
  return hashPayload({ subject: question.subject, passage: normalizedText(question.passage), stem: normalizedText(question.stem), stimulus: question.stimulus || null, options: question.options.map(visibleOption).sort() });
}

function fingerprintFor(question) {
  return hashPayload({ subject: question.subject, passage: normalizedText(question.passage), stem: normalizedText(question.stem), stimulus: question.stimulus || null, options: question.options.map(visibleOption).sort() });
}

function createQuestion({ testId, questionNumber, blueprint, topic, difficulty, levelIndex, raw, passageId, passage }) {
  const { options, correctOption } = makeOptions(raw.choices, `${testId}-${questionNumber}`);
  const question = {
    questionId: `${testId}-Q${String(questionNumber).padStart(3, '0')}`,
    testId,
    questionNumber,
    subject: blueprint.subject,
    section: blueprint.section,
    topic,
    coverageTopics: raw.coverageTopics || [topic],
    syllabusSubtopics: raw.syllabusSubtopics || [],
    skillCode: raw.skillCode || null,
    part: raw.part || null,
    type: passageId ? 'passage-mcq' : raw.stimulus ? 'visual-mcq' : 'mcq',
    stem: raw.stem,
    ...(raw.stimulus ? { stimulus: raw.stimulus } : {}),
    ...(passageId ? { passageId, passage } : {}),
    options,
    correctOption,
    explanation: raw.explanation,
    difficulty,
    difficultyLabel: levelLabels[difficulty],
    syllabusYear: JNVST_STANDARD.syllabusYear,
    syllabusVersion: 'JNVST-2027',
    moduleVersion: TESTING_MODULE_VERSION,
    marks: 1.25,
    status: 'validated'
  };
  return { ...question, fingerprint: fingerprintFor(question), promptFingerprint: promptFingerprintFor(question), renderFingerprint: renderFingerprintFor(question), difficultyRank: levelIndex + 1 };
}

export function generateTestingBank() {
  const questions = [];
  const tests = [];
  for (let levelIndex = 0; levelIndex < JNVST_LEVELS.length; levelIndex += 1) {
    const difficulty = JNVST_LEVELS[levelIndex];
    for (let paperIndex = 0; paperIndex < JNVST_STANDARD.papersPerLevel; paperIndex += 1) {
      const globalNumber = levelIndex * JNVST_STANDARD.papersPerLevel + paperIndex + 1;
      const testId = `TST-${difficulty.slice(0, 3).toUpperCase()}-${String(paperIndex + 1).padStart(2, '0')}`;
      const testQuestions = [];
      let questionNumber = 0;
      for (const blueprint of JNVST_BLUEPRINT) {
        if (blueprint.key === 'language') {
          for (let passageIndex = 0; passageIndex < 4; passageIndex += 1) {
            const passage = passageSet(passageIndex, difficulty, paperIndex);
            for (const raw of passage.questions) {
              questionNumber += 1;
              testQuestions.push(createQuestion({ testId, questionNumber, blueprint, topic: 'Reading Comprehension', difficulty, levelIndex, raw, passageId: passage.passageId, passage: passage.passage }));
            }
          }
          continue;
        }
        if (blueprint.key === 'evs') {
          const plan = evsSectionPlan(difficulty, paperIndex);
          for (let subjectIndex = 0; subjectIndex < plan.standaloneTopics.length; subjectIndex += 1) {
            const topic = plan.standaloneTopics[subjectIndex];
            const seed = globalNumber * 10000 + questionNumber * 100 + subjectIndex;
            questionNumber += 1;
            testQuestions.push(createQuestion({ testId, questionNumber, blueprint, topic, difficulty, levelIndex, raw: evsQuestion(topic, seed, levelIndex) }));
          }
          const passage = evsPassageQuestions(testId, difficulty, paperIndex, plan.passageTopics);
          for (const raw of passage.questions) {
            questionNumber += 1;
            testQuestions.push(createQuestion({ testId, questionNumber, blueprint, topic: raw.topic, difficulty, levelIndex, raw, passageId: passage.passageId, passage: passage.passage }));
          }
          continue;
        }
        const sectionPlan = blueprint.key === 'mental' ? MAT_SECTION_PLAN : ARITHMETIC_SECTION_PLAN;
        for (let subjectIndex = 0; subjectIndex < sectionPlan.length; subjectIndex += 1) {
          const syllabusSlot = sectionPlan[subjectIndex];
          const topic = syllabusSlot.topic;
          const seed = globalNumber * 10000 + questionNumber * 100 + subjectIndex;
          const raw = blueprint.key === 'mental' ? mentalQuestion(topic, seed, levelIndex, syllabusSlot) : arithmeticQuestion(topic, seed, levelIndex, syllabusSlot);
          questionNumber += 1;
          testQuestions.push(createQuestion({ testId, questionNumber, blueprint, topic, difficulty, levelIndex, raw }));
        }
      }
      questions.push(...testQuestions);
      tests.push({
        testId,
        number: globalNumber,
        categoryNumber: paperIndex + 1,
        title: `JNVST ${levelLabels[difficulty]} Full Test ${paperIndex + 1}`,
        difficulty,
        difficultyLabel: levelLabels[difficulty],
        questionCount: testQuestions.length,
        totalMarks: JNVST_STANDARD.marksPerPaper,
        durationMinutes: JNVST_STANDARD.durationMinutes,
        questionIds: testQuestions.map((question) => question.questionId),
        sectionCounts: Object.fromEntries(JNVST_BLUEPRINT.map((section) => [section.subject, testQuestions.filter((question) => question.subject === section.subject).length])),
        topicCoverage: [...new Set(testQuestions.map((question) => question.topic))],
        syllabusCoverage: Object.fromEntries(JNVST_BLUEPRINT.map((section) => [section.subject, [...new Set(testQuestions.filter((question) => question.subject === section.subject).flatMap((question) => question.coverageTopics))]])),
        subtopicCoverage: Object.fromEntries(JNVST_BLUEPRINT.map((section) => [section.subject, [...new Set(testQuestions.filter((question) => question.subject === section.subject).flatMap((question) => question.syllabusSubtopics))]])),
        matParts: ['Part I', 'Part II', 'Part III', 'Part IV', 'Part V'].map((part) => ({ part, questionCount: testQuestions.filter((question) => question.subject === 'Mental Ability' && question.part === part).length })),
        markingScheme: { marksPerCorrectAnswer: JNVST_STANDARD.marksPerCorrectAnswer, negativeMarking: JNVST_STANDARD.negativeMarking },
        qualifyingMarks: JNVST_STANDARD.qualifyingMarks,
        examMode: JNVST_STANDARD.examMode,
        divyangExtraTimeMinutes: JNVST_STANDARD.divyangExtraTimeMinutes,
        language: JNVST_STANDARD.defaultLanguage,
        syllabusYear: JNVST_STANDARD.syllabusYear,
        syllabusVersion: 'JNVST-2027',
        moduleVersion: TESTING_MODULE_VERSION,
        status: 'validated'
      });
    }
  }
  return { tests, questions };
}

export function validateTestingBank(bank) {
  const errors = [];
  const { tests, questions } = bank;
  if (tests.length !== 30) errors.push(`Expected 30 tests, received ${tests.length}.`);
  if (questions.length !== 2400) errors.push(`Expected 2,400 questions, received ${questions.length}.`);
  for (const difficulty of JNVST_LEVELS) {
    if (tests.filter((test) => test.difficulty === difficulty).length !== 10) errors.push(`Expected 10 ${difficulty} tests.`);
  }
  const questionIds = new Set();
  const fingerprints = new Set();
  const promptFingerprints = new Set();
  const renderFingerprints = new Set();
  let optionOrderInvariantChecks = 0;
  const topicSets = new Map(JNVST_BLUEPRINT.map((section) => [section.subject, new Set(syllabusTopicNames(section))]));
  const requiredMatSkills = new Set(MAT_SECTION_PLAN.map((item) => item.skillCode));
  const requiredArithmeticSkills = new Set(ARITHMETIC_SECTION_PLAN.map((item) => item.skillCode));
  for (const test of tests) {
    const rows = questions.filter((question) => question.testId === test.testId);
    if (rows.length !== 80) errors.push(`${test.testId} has ${rows.length}/80 questions.`);
    for (const section of JNVST_BLUEPRINT) {
      const sectionRows = rows.filter((question) => question.subject === section.subject);
      if (sectionRows.length !== 20) errors.push(`${test.testId} has ${sectionRows.length}/20 ${section.subject} questions.`);
      const covered = new Set(sectionRows.flatMap((question) => question.coverageTopics));
      const required = section.key === 'language' ? LANGUAGE_SKILLS : syllabusTopicNames(section);
      if (section.key === 'evs' && covered.size !== 20) errors.push(`${test.testId} must cover 20 distinct EVS topics.`);
      if (section.key !== 'evs' && required.some((topic) => !covered.has(topic))) errors.push(`${test.testId} does not cover every ${section.subject} syllabus area.`);
      if (JSON.stringify(test.syllabusCoverage?.[section.subject]) !== JSON.stringify([...covered])) errors.push(`${test.testId} has incorrect stored ${section.subject} coverage.`);
      const storedSubtopics = [...new Set(sectionRows.flatMap((question) => question.syllabusSubtopics))];
      if (JSON.stringify(test.subtopicCoverage?.[section.subject]) !== JSON.stringify(storedSubtopics)) errors.push(`${test.testId} has incorrect stored ${section.subject} subtopic coverage.`);
    }
    const matRows = rows.filter((question) => question.subject === 'Mental Ability');
    const matSkills = new Set(matRows.map((question) => question.skillCode));
    if (matSkills.size !== requiredMatSkills.size || [...requiredMatSkills].some((skill) => !matSkills.has(skill))) errors.push(`${test.testId} does not follow the complete 20-question MAT skill plan.`);
    const matPartCounts = Map.groupBy(matRows, (question) => question.part);
    if (matPartCounts.size !== 5 || [...matPartCounts.values()].some((partRows) => partRows.length !== 4)) errors.push(`${test.testId} MAT must contain five parts of four questions.`);
    const arithmeticRows = rows.filter((question) => question.subject === 'Arithmetic');
    const arithmeticSkills = new Set(arithmeticRows.map((question) => question.skillCode));
    if (arithmeticSkills.size !== requiredArithmeticSkills.size || [...requiredArithmeticSkills].some((skill) => !arithmeticSkills.has(skill))) errors.push(`${test.testId} does not cover every detailed Arithmetic syllabus skill.`);
    if (test.markingScheme?.marksPerCorrectAnswer !== 1.25 || test.markingScheme?.negativeMarking !== 0) errors.push(`${test.testId} has an incorrect marking scheme.`);
    if (test.examMode !== JNVST_STANDARD.examMode || test.divyangExtraTimeMinutes !== 40) errors.push(`${test.testId} has incomplete exam-rule metadata.`);
    const evsRows = rows.filter((question) => question.subject === 'Environmental Studies');
    const evsStandalone = evsRows.filter((question) => !question.passageId);
    const evsPassage = evsRows.filter((question) => question.passageId);
    if (evsStandalone.length !== 15 || evsPassage.length !== 5) errors.push(`${test.testId} EVS must contain 15 standalone questions and five passage questions.`);
    if (new Set(evsPassage.map((question) => question.passageId)).size !== 1 || new Set(evsPassage.map((question) => question.passage)).size !== 1) errors.push(`${test.testId} EVS passage questions must share one passage.`);
    const passageGroups = new Map();
    for (const row of rows.filter((question) => question.subject === 'Language')) {
      if (!row.passageId || !row.passage) errors.push(`${row.questionId} is a language question without a passage.`);
      passageGroups.set(row.passageId, (passageGroups.get(row.passageId) || 0) + 1);
    }
    if (passageGroups.size !== 4 || [...passageGroups.values()].some((count) => count !== 5)) errors.push(`${test.testId} must contain four language passages with five questions each.`);
    if (new Set(rows.map((question) => question.promptFingerprint)).size !== rows.length) errors.push(`${test.testId} contains a repeated student-visible prompt.`);
    if (new Set(rows.map((question) => question.renderFingerprint)).size !== rows.length) errors.push(`${test.testId} contains a repeated student-visible question.`);
  }
  for (const difficulty of JNVST_LEVELS) {
    const ordered = tests.filter((test) => test.difficulty === difficulty).sort((first, second) => first.categoryNumber - second.categoryNumber);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const covered = new Set([...ordered[index].syllabusCoverage['Environmental Studies'], ...ordered[index + 1].syllabusCoverage['Environmental Studies']]);
      if (covered.size !== 28) errors.push(`${ordered[index].testId} and ${ordered[index + 1].testId} do not cover all 28 rotating EVS topics.`);
    }
  }
  for (const question of questions) {
    if (questionIds.has(question.questionId)) errors.push(`Duplicate question ID ${question.questionId}.`);
    questionIds.add(question.questionId);
    if (fingerprints.has(question.fingerprint)) errors.push(`Duplicate content fingerprint ${question.fingerprint} (${question.questionId}).`);
    fingerprints.add(question.fingerprint);
    if (promptFingerprints.has(question.promptFingerprint)) errors.push(`Duplicate student-visible prompt fingerprint ${question.promptFingerprint} (${question.questionId}).`);
    promptFingerprints.add(question.promptFingerprint);
    if (renderFingerprints.has(question.renderFingerprint)) errors.push(`Duplicate rendered-question fingerprint ${question.renderFingerprint} (${question.questionId}).`);
    renderFingerprints.add(question.renderFingerprint);
    if (question.fingerprint !== fingerprintFor(question)) errors.push(`${question.questionId} has a non-canonical fingerprint.`);
    if (question.promptFingerprint !== promptFingerprintFor(question)) errors.push(`${question.questionId} has an invalid prompt fingerprint.`);
    if (question.renderFingerprint !== renderFingerprintFor(question)) errors.push(`${question.questionId} has an invalid render fingerprint.`);
    const reversedOptions = { ...question, options: [...question.options].reverse() };
    if (fingerprintFor(reversedOptions) !== question.fingerprint || renderFingerprintFor(reversedOptions) !== question.renderFingerprint || promptFingerprintFor(reversedOptions) !== question.promptFingerprint) {
      errors.push(`${question.questionId} changes identity when its options are reordered.`);
    }
    optionOrderInvariantChecks += 1;
    if (!topicSets.get(question.subject)?.has(question.topic)) errors.push(`${question.questionId} uses non-syllabus topic ${question.topic}.`);
    if (!Array.isArray(question.options) || question.options.length !== 4) errors.push(`${question.questionId} does not have four options.`);
    if (new Set(question.options.map(visibleOption)).size !== 4) errors.push(`${question.questionId} contains duplicate visible options.`);
    if (!question.options.some((option) => option.id === question.correctOption)) errors.push(`${question.questionId} answer is not present in its options.`);
    if (!question.stem || !question.explanation) errors.push(`${question.questionId} is missing its stem or explanation.`);
    if (question.subject === 'Mental Ability' && !question.stimulus) errors.push(`${question.questionId} is missing a non-verbal MAT stimulus.`);
    if (['Mental Ability', 'Arithmetic'].includes(question.subject) && (!question.skillCode || !question.syllabusSubtopics.length)) errors.push(`${question.questionId} is missing detailed syllabus metadata.`);
    if (question.subject === 'Arithmetic' && /unlike|÷\s*\d+\/|\d+\/\d+\s*÷/i.test(question.stem)) errors.push(`${question.questionId} uses an excluded fraction operation.`);
    if (question.subject === 'Language' && !question.passageId) errors.push(`${question.questionId} is a standalone Language question.`);
  }
  const report = {
    status: errors.length === 0 ? 'passed' : 'failed',
    moduleVersion: TESTING_MODULE_VERSION,
    testCount: tests.length,
    questionCount: questions.length,
    levelCounts: Object.fromEntries(JNVST_LEVELS.map((level) => [level, tests.filter((test) => test.difficulty === level).length])),
    subjectCounts: Object.fromEntries(JNVST_BLUEPRINT.map((section) => [section.subject, questions.filter((question) => question.subject === section.subject).length])),
    uniqueQuestionIds: questionIds.size,
    uniqueFingerprints: fingerprints.size,
    uniquePromptFingerprints: promptFingerprints.size,
    uniqueRenderFingerprints: renderFingerprints.size,
    optionOrderInvariantChecks,
    detailedMatSkillsPerTest: MAT_SECTION_PLAN.length,
    detailedArithmeticSkillsPerTest: ARITHMETIC_SECTION_PLAN.length,
    errorCount: errors.length,
    errors: errors.slice(0, 100)
  };
  if (errors.length > 0) throw new Error(`Testing bank validation failed with ${errors.length} error(s):\n${errors.slice(0, 20).join('\n')}`);
  return report;
}
