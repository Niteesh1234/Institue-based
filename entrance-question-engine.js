import { createHash } from 'node:crypto';
import { getExamCourse } from './exam-courses.js';

const optionIds = ['A', 'B', 'C', 'D'];
const levelLabels = { easy: 'Easy', medium: 'Medium', challenging: 'Challenging' };
const names = ['Aarav', 'Aditi', 'Advik', 'Anaya', 'Arjun', 'Diya', 'Ishaan', 'Ishita', 'Kabir', 'Kavya', 'Krish', 'Meera', 'Mira', 'Naina', 'Neel', 'Pranav', 'Riya', 'Saanvi', 'Sara', 'Tara', 'Ved', 'Vihaan', 'Yash', 'Zoya'];
const femaleNames = ['Aditi', 'Anaya', 'Diya', 'Ishita', 'Kavya', 'Meera', 'Mira', 'Naina', 'Riya', 'Saanvi', 'Sara', 'Tara', 'Zoya'];
const primeNumbers = Array.from({ length: 997 }, (_, index) => index + 2).filter((number) => {
  for (let divisor = 2; divisor * divisor <= number; divisor += 1) if (number % divisor === 0) return false;
  return true;
});

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

function normalize(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function visibleOption(option) {
  return normalize(option.text);
}

function promptFingerprint(question) {
  return digest({ passage: normalize(question.passage), stem: normalize(question.stem), stimulus: question.stimulus || null });
}

function renderedFingerprint(question) {
  return digest({ passage: normalize(question.passage), stem: normalize(question.stem), stimulus: question.stimulus || null, options: question.options.map(visibleOption).sort() });
}

function underlyingFingerprint(question) {
  return digest({
    passage: normalize(question.passage),
    stem: normalize(question.stem).replace(/^(aissee|rms cet) practice scenario \d+:\s*/, ''),
    stimulus: question.stimulus || null,
    options: question.options.map(visibleOption).sort()
  });
}

function toRoman(number) {
  const values = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let remaining = number;
  let result = '';
  for (const [value, symbol] of values) {
    while (remaining >= value) { result += symbol; remaining -= value; }
  }
  return result;
}

function makeOptions(answer, distractors, seed) {
  const choices = [{ text: String(answer), correct: true }, ...distractors.map((text) => ({ text: String(text), correct: false }))];
  const unique = [...new Map(choices.map((choice) => [normalize(choice.text), choice])).values()];
  if (unique.length !== 4) throw new Error(`Four unique options are required for ${seed}.`);
  const ordered = shuffle(unique, seed);
  return {
    options: ordered.map((choice, index) => ({ id: optionIds[index], text: choice.text })),
    correctOption: optionIds[ordered.findIndex((choice) => choice.correct)]
  };
}

function numericChoices(answer, step = 1) {
  const safeStep = Math.max(1, Math.abs(step));
  return [answer + safeStep, Math.max(0, answer - safeStep), answer + safeStep * 2];
}

function mathematicsQuestion({ topic, seed, levelIndex, courseKey }) {
  const scale = levelIndex + 1;
  const student = names[seed % names.length];
  const key = topic.toLowerCase();
  if (key.includes('place value')) {
    const digit = 2 + (seed % 7);
    const number = 40000 + digit * 100 + (Math.floor(seed / 9) % 90);
    const answer = digit * 100;
    return { stem: `What is the place value of the digit ${digit} in ${number.toLocaleString('en-IN')}?`, answer, distractors: [digit, digit * 10, digit * 1000], explanation: `The digit ${digit} is in the hundreds place, so its value is ${answer}.`, templateKey: `place-value-${number}-${digit}` };
  }
  if (key.includes('lcm') || key.includes('factor') || key.includes('multiple')) {
    const factor = 2 + (seed % 97);
    const firstMultiplier = 3 + (Math.floor(seed / 7) % 17);
    const secondMultiplier = firstMultiplier + 1;
    const first = factor * firstMultiplier;
    const second = factor * secondMultiplier;
    return { stem: `What is the HCF of ${first} and ${second}?`, answer: factor, distractors: [factor + 1, factor * 2, factor * 5], explanation: `${factor} is the greatest number that divides both ${first} and ${second}.`, templateKey: `hcf-${first}-${second}` };
  }
  if (key.includes('prime') || key.includes('composite')) {
    const answer = primeNumbers[seed % primeNumbers.length];
    return { stem: `Which option is a prime number between ${answer - 1} and ${answer + 1}?`, answer, distractors: [answer * 2, answer * 3, answer * 5], explanation: `${answer} lies in the stated interval and has exactly two factors: 1 and ${answer}.`, templateKey: `prime-${answer}` };
  }
  if (key.includes('arranging of fractions')) {
    const denominator = 8 + (seed % 83);
    const base = 1 + (Math.floor(seed / 5) % Math.max(1, denominator - 5));
    const numerators = [base, base + 2, base + 4];
    const answer = numerators.map((value) => `${value}/${denominator}`).join(' < ');
    return {
      stem: `Arrange ${numerators[2]}/${denominator}, ${numerators[0]}/${denominator}, and ${numerators[1]}/${denominator} in ascending order.`,
      answer,
      distractors: [
        [...numerators].reverse().map((value) => `${value}/${denominator}`).join(' < '),
        [numerators[1], numerators[0], numerators[2]].map((value) => `${value}/${denominator}`).join(' < '),
        [numerators[0], numerators[2], numerators[1]].map((value) => `${value}/${denominator}`).join(' < '),
      ],
      explanation: `With the same denominator, compare the numerators: ${numerators.join(' < ')}.`,
      templateKey: `arrange-fractions-${numerators.join('-')}-${denominator}`,
    };
  }
  if (key.includes('fraction')) {
    const denominator = 11 + (seed % 89);
    const first = 1 + (Math.floor(seed / 5) % 17);
    const second = 1 + (Math.floor(seed / 11) % 19);
    const answer = `${first + second}/${denominator}`;
    return { stem: `Add the like fractions ${first}/${denominator} + ${second}/${denominator}.`, answer, distractors: [`${first + second + 1}/${denominator}`, `${first + second}/${denominator + 1}`, `${Math.abs(first - second) || 1}/${denominator}`], explanation: `Add the numerators and keep the common denominator: ${answer}.`, templateKey: `fractions-${first}-${second}-${denominator}` };
  }
  if (key.includes('ratio and proportion') || key.includes('unitary')) {
    const quantity = 3 + (seed % 9);
    const unitCost = 4 + (Math.floor(seed / 7) % (15 * scale));
    const requested = quantity + 2;
    const answer = requested * unitCost;
    return { stem: `${quantity} identical notebooks cost ₹${quantity * unitCost}. What will ${requested} notebooks cost at the same rate?`, answer: `₹${answer}`, distractors: [`₹${answer + unitCost}`, `₹${answer - unitCost}`, `₹${quantity * unitCost}`], explanation: `One notebook costs ₹${unitCost}; ${requested} cost ₹${answer}.`, templateKey: `unitary-${quantity}-${unitCost}-${requested}` };
  }
  if (key.includes('simple interest')) {
    const principal = 100 * (2 + (seed % (18 * scale)));
    const rate = 2 + (Math.floor(seed / 7) % 9);
    const time = 1 + (Math.floor(seed / 13) % 5);
    const answer = (principal * rate * time) / 100;
    return {
      stem: `${student} deposits ₹${principal} at ${rate}% simple interest per year for ${time} ${time === 1 ? 'year' : 'years'}. What simple interest is earned?`,
      answer: `₹${answer}`,
      distractors: [`₹${answer + rate}`, `₹${Math.max(1, answer - rate)}`, `₹${answer + rate + time * 10}`],
      explanation: `Simple interest = principal × rate × time ÷ 100 = ${principal} × ${rate} × ${time} ÷ 100 = ₹${answer}.`,
      templateKey: `simple-interest-${principal}-${rate}-${time}`,
    };
  }
  if (key.includes('profit') || key.includes('money')) {
    const cost = 50 + (seed % (250 * scale));
    const gain = 5 + (Math.floor(seed / 9) % 40);
    const answer = cost + gain;
    return { stem: `${student} buys an item for ₹${cost} and earns a profit of ₹${gain}. What is the selling price?`, answer: `₹${answer}`, distractors: [`₹${cost - gain}`, `₹${answer + gain}`, `₹${cost}`], explanation: `Selling price = cost price + profit = ₹${answer}.`, templateKey: `profit-${cost}-${gain}` };
  }
  if (key.includes('average')) {
    const start = 10 + (seed % 70);
    const step = 2 + (Math.floor(seed / 13) % 8);
    const answer = start + step;
    return { stem: `Find the average of ${start}, ${start + step}, and ${start + step * 2}.`, answer, distractors: numericChoices(answer, step), explanation: `Their sum divided by 3 is ${answer}.`, templateKey: `average-${start}-${step}` };
  }
  if (key.includes('percentage')) {
    const rate = [10, 20, 25, 50][seed % 4];
    const whole = 40 + 20 * (Math.floor(seed / 7) % (12 * scale));
    const answer = (whole * rate) / 100;
    return { stem: `What is ${rate}% of ${whole}?`, answer, distractors: numericChoices(answer, Math.max(2, rate / 5)), explanation: `${rate}/100 × ${whole} = ${answer}.`, templateKey: `percentage-${rate}-${whole}` };
  }
  if (key.includes('decimal')) {
    const whole = 2 + (seed % 40);
    const tenths = 1 + (Math.floor(seed / 9) % 8);
    const hundredths = (tenths % 8) + 1;
    const answer = (whole + tenths / 10 + hundredths / 100).toFixed(2);
    return { stem: `Write ${whole} + ${tenths}/10 + ${hundredths}/100 as a decimal.`, answer, distractors: [(whole + hundredths / 10 + tenths / 100).toFixed(2), `${whole}.${tenths + hundredths}`, `${whole + tenths + hundredths}.00`], explanation: `Tenths occupy the first decimal place and hundredths the second: ${answer}.`, templateKey: `decimal-${whole}-${tenths}-${hundredths}` };
  }
  if (key.includes('volume') || key.includes('cube') || key.includes('cuboid')) {
    const length = 3 + (seed % 9);
    const width = 2 + (Math.floor(seed / 7) % 7);
    const height = 2 + (Math.floor(seed / 13) % 6);
    const answer = length * width * height;
    return { stem: `Find the volume of a cuboid ${length} cm × ${width} cm × ${height} cm.`, answer: `${answer} cm³`, distractors: [`${answer + 1} cm³`, `${answer + 2} cm³`, `${answer + 3} cm³`], explanation: `Volume = ${length} × ${width} × ${height} = ${answer} cm³.`, templateKey: `volume-${length}-${width}-${height}` };
  }
  if (key.includes('circle')) {
    const radius = 2 + (seed % 149);
    const answer = radius * 2;
    return { stem: `A circle has a radius of ${radius} cm. What is its diameter?`, answer: `${answer} cm`, distractors: [`${radius} cm`, `${answer + 2} cm`, `${answer - 1} cm`], explanation: `Diameter = 2 × radius = 2 × ${radius} = ${answer} cm.`, templateKey: `circle-diameter-${radius}` };
  }
  if (key.includes('plane figure')) {
    const sides = 3 + (seed % 8);
    const sideLength = 2 + (Math.floor(seed / 11) % 61);
    const answer = sides * sideLength;
    return { stem: `A regular plane figure has ${sides} equal sides, each ${sideLength} cm long. What is its perimeter?`, answer: `${answer} cm`, distractors: [`${answer + 1} cm`, `${answer + 2} cm`, `${answer + 3} cm`], explanation: `Perimeter = ${sides} × ${sideLength} = ${answer} cm.`, templateKey: `regular-figure-${sides}-${sideLength}` };
  }
  if (key.includes('types of angle')) {
    const angle = 1 + (seed % 179);
    const answer = angle < 90 ? 'Acute angle' : angle === 90 ? 'Right angle' : 'Obtuse angle';
    const distractors = ['Acute angle', 'Right angle', 'Obtuse angle', 'Reflex angle'].filter((item) => item !== answer).slice(0, 3);
    return { stem: `How should an angle measuring ${angle}° be classified?`, answer, distractors, explanation: `${angle}° is ${answer.toLowerCase()}.`, templateKey: `angle-type-${angle}` };
  }
  if (key.includes('complementary')) {
    const angle = 10 + (seed % 71);
    const asksSupplement = Math.floor(seed / 97) % 2 === 0;
    const total = asksSupplement ? 180 : 90;
    const answer = total - angle;
    const oppositeRelationAnswer = (asksSupplement ? 90 : 180) - angle;
    const relation = asksSupplement ? 'supplement' : 'complement';
    const adjective = asksSupplement ? 'Supplementary' : 'Complementary';
    return { stem: `What is the ${relation} of an angle measuring ${angle}°?`, answer: `${answer}°`, distractors: [`${oppositeRelationAnswer}°`, `${angle + 15}°`, `${answer + 10}°`], explanation: `${adjective} angles total ${total}°, so ${total}° − ${angle}° = ${answer}°.`, templateKey: `${relation}-${angle}` };
  }
  if (key.includes('angle') || key.includes('geometry')) {
    if (seed % 2 === 0) {
      const angle = 1 + (Math.floor(seed / 2) % 178);
      const answer = 180 - angle;
      return { stem: `Two angles form a straight line. If one angle measures ${angle}°, what is the other angle?`, answer: `${answer}°`, distractors: [`${answer + 5}°`, `${Math.max(1, answer - 5)}°`, `${answer + 15}°`], explanation: `Angles on a straight line total 180°, so 180° − ${angle}° = ${answer}°.`, templateKey: `straight-line-angle-${angle}` };
    }
    const first = 5 + (Math.floor(seed / 2) % 76);
    const second = 5 + (Math.floor(seed / 17) % (170 - first));
    const answer = 180 - first - second;
    return { stem: `Three adjacent angles form a straight line. Two measure ${first}° and ${second}°. What is the third angle?`, answer: `${answer}°`, distractors: [`${answer + 4}°`, `${answer + 8}°`, `${Math.max(1, answer - 4)}°`], explanation: `Angles on a straight line total 180°, so 180° − ${first}° − ${second}° = ${answer}°.`, templateKey: `three-straight-line-angles-${first}-${second}` };
  }
  if (key.includes('area') || key.includes('perimeter')) {
    const first = 30 + (seed % (170 * scale));
    const length = 6 + (first % (20 * scale));
    const width = 3 + (Math.floor(seed / 9) % Math.max(3, length - 2));
    const perimeter = 2 * (length + width);
    return { stem: `A rectangular training ground is ${length} m long and ${width} m wide. What is its perimeter?`, answer: `${perimeter} m`, distractors: [`${perimeter + 1} m`, `${perimeter + 2} m`, `${perimeter + 3} m`], explanation: `Perimeter = 2 × (${length} + ${width}) = ${perimeter} m.`, templateKey: `perimeter-${length}-${width}` };
  }
  if (key.includes('conversion') || key.includes('measurement')) {
    const litres = 2 + (seed % (18 * scale));
    const millilitres = 25 + (Math.floor(seed / 11) % 900);
    const answer = litres * 1000 + millilitres;
    return { stem: `Convert ${litres} L ${millilitres} mL completely into millilitres.`, answer: `${answer} mL`, distractors: [`${litres * 100 + millilitres} mL`, `${answer + 1000} mL`, `${answer - 1000} mL`], explanation: `Use 1 L = 1000 mL, giving ${answer} mL.`, templateKey: `capacity-${litres}-${millilitres}` };
  }
  if (key.includes('roman')) {
    const number = 10 + (seed % 90);
    const answer = toRoman(number);
    return { stem: `Which Roman numeral represents ${number}?`, answer, distractors: [toRoman(number + 1), toRoman(number + 2), toRoman(number + 5)], explanation: `${number} is written as ${answer} in Roman numerals.`, templateKey: `roman-${number}` };
  }
  if (key.includes('speed') || key.includes('time')) {
    const speed = 4 + (seed % 15);
    const hours = 2 + (Math.floor(seed / 11) % 8);
    const answer = speed * hours;
    return { stem: `A cyclist travels at ${speed} km per hour for ${hours} hours. What distance is covered?`, answer: `${answer} km`, distractors: [`${speed + hours} km`, `${answer + speed} km`, `${answer - speed} km`], explanation: `Distance = speed × time = ${answer} km.`, templateKey: `speed-${speed}-${hours}` };
  }
  if (key.includes('temperature')) {
    const morning = 8 + (seed % 18);
    const rise = 3 + (Math.floor(seed / 13) % 12);
    const answer = morning + rise;
    return { stem: `The morning temperature was ${morning}°C and rose by ${rise}°C. What was the later temperature?`, answer: `${answer}°C`, distractors: [`${answer + 1}°C`, `${answer + 2}°C`, `${answer + 3}°C`], explanation: `${morning} + ${rise} = ${answer}°C.`, templateKey: `temperature-${morning}-${rise}` };
  }
  if (key.includes('data')) {
    const red = 5 + (seed % 20);
    const blue = 4 + (Math.floor(seed / 9) % 18);
    const green = 3 + (Math.floor(seed / 17) % 16);
    const answer = red + blue + green;
    return { stem: `A table records ${red} red, ${blue} blue, and ${green} green flags. How many flags are recorded altogether?`, answer, distractors: numericChoices(answer, 2), explanation: `${red} + ${blue} + ${green} = ${answer}.`, templateKey: `data-${red}-${blue}-${green}` };
  }
  const first = 30 + (seed % (170 * scale));
  const second = 12 + (Math.floor(seed / 7) % (90 * scale));
  const third = 3 + (Math.floor(seed / 13) % 25);
  const answer = first + second - third;
  return { stem: `${student} starts with ${first} counters, receives ${second}, and gives away ${third}. How many counters remain?`, answer, distractors: numericChoices(answer, scale + 1), explanation: `${first} + ${second} − ${third} = ${answer}.`, templateKey: `operation-${first}-${second}-${third}` };
}

function intelligenceQuestion({ topic, seed, levelIndex, courseKey }) {
  const key = topic.toLowerCase();
  if (key.includes('familial')) {
    const first = femaleNames[seed % femaleNames.length];
    const availableSiblings = names.filter((name) => name !== first);
    const second = availableSiblings[Math.floor(seed / 29) % availableSiblings.length];
    return { stem: `${first} is the sister of ${second}. ${second} is the son of Kavita. How is ${first} related to Kavita?`, answer: 'Daughter', distractors: ['Mother', 'Aunt', 'Grandmother'], explanation: `${first} and ${second} are siblings, and ${second} is Kavita's son, so ${first} is Kavita's daughter.`, templateKey: `family-${first}-${second}` };
  }
  if (key.includes('direction')) {
    const east = 2 + (seed % 43);
    const north = 2 + (Math.floor(seed / 9) % 41);
    return { stem: `A cadet walks ${east} m east and then ${north} m north. In which direction is the cadet from the starting point?`, answer: 'North-east', distractors: ['North-west', 'South-east', 'South-west'], explanation: 'Moving east and then north places the cadet north-east of the start.', templateKey: `direction-${east}-${north}` };
  }
  if (key.includes('classification')) {
    const factor = 3 + (seed % 29);
    const base = factor * (4 + (Math.floor(seed / 17) % 47));
    const answer = base + 1;
    return { stem: `In a classification set beginning with ${base}, which number does not belong with the other multiples of ${factor}?`, answer, distractors: [base, base + factor, base + factor * 2], explanation: `${answer} is not divisible by ${factor}; the other values are.`, templateKey: `classification-${factor}-${base}` };
  }
  if (key.includes('alphabet') || key.includes('coding')) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const start = seed % alphabet.length;
    const step = 1 + (Math.floor(seed / 13) % 9);
    const length = 3 + (Math.floor(seed / 101) % 4);
    const letters = Array.from({ length }, (_, index) => alphabet[(start + index * step) % alphabet.length]);
    const answerIndex = (start + step * length) % alphabet.length;
    const answer = alphabet[answerIndex % alphabet.length];
    return { stem: `Complete the letter pattern: ${letters.join(', ')}, __.`, answer, distractors: [alphabet[(answerIndex + 1) % alphabet.length], alphabet[(answerIndex + 2) % alphabet.length], alphabet[(answerIndex + 3) % alphabet.length]], explanation: `The pattern moves ${step} letter${step === 1 ? '' : 's'} forward each time, wrapping after Z when needed.`, templateKey: `letter-series-${start}-${step}-${length}` };
  }
  if (key.includes('series') || key.includes('sequence') || key.includes('pattern')) {
    const start = 3 + (seed % 80);
    const step = 2 + (Math.floor(seed / 7) % (7 + levelIndex * 3));
    const sequence = [0, 1, 2, 3].map((index) => start + index * step);
    const answer = start + 4 * step;
    return { stem: `Find the next number: ${sequence.join(', ')}, __.`, answer, distractors: numericChoices(answer, step), explanation: `The rule is “add ${step}.”`, templateKey: `number-series-${start}-${step}` };
  }
  const first = 2 + (seed % 18);
  const multiplier = 2 + (Math.floor(seed / 11) % (4 + levelIndex));
  const second = first * multiplier;
  const third = 3 + (Math.floor(seed / 23) % 16);
  const answer = third * multiplier;
  return { stem: `${first} is related to ${second} in the same way that ${third} is related to __.`, answer, distractors: numericChoices(answer, multiplier), explanation: `Both pairs use multiplication by ${multiplier}.`, templateKey: `analogy-${first}-${multiplier}-${third}` };
}

function languageQuestion({ topic, seed, courseKey }) {
  const student = names[seed % names.length];
  const places = ['library', 'museum', 'garden', 'classroom', 'playground', 'laboratory', 'auditorium', 'art room', 'assembly hall', 'computer room', 'music room', 'reading room', 'sports field', 'science centre', 'school office', 'training ground', 'workshop', 'exhibition hall', 'nature club', 'language lab'];
  const place = places[Math.floor(seed / 7) % places.length];
  const key = topic.toLowerCase();
  if (key.includes('comprehension')) {
    const count = 3 + (seed % 47);
    const objects = ['labelled notebooks', 'science cards', 'history folders', 'reading journals', 'art sheets', 'seed packets', 'map cards', 'number tiles'];
    const object = objects[Math.floor(seed / 17) % objects.length];
    const alternatives = objects.filter((item) => item !== object).slice(0, 3);
    const passage = `${student} visited the school ${place} before assembly and arranged ${count} ${object}. After checking every item, ${student} returned them to the teacher.`;
    return { passage, stem: `What did ${student} arrange before assembly?`, answer: `${count} ${object}`, distractors: alternatives.map((item) => `${count} ${item}`), explanation: 'The answer is stated directly in the passage.', templateKey: `comprehension-${student}-${place}-${count}-${object}` };
  }
  if (key.includes('article')) {
    const objects = [['umbrella', 'an'], ['orange folder', 'an'], ['hourglass', 'an'], ['atlas', 'an'], ['ink bottle', 'an'], ['uniform', 'a'], ['book', 'a'], ['map', 'a'], ['pencil', 'a'], ['useful chart', 'a']];
    const [object, answer] = objects[Math.floor(seed / 19) % objects.length];
    return { stem: `Choose the correct article: “${student} carried ___ ${object} to the ${place}.”`, answer, distractors: answer === 'an' ? ['a', 'the only', 'no article'] : ['an', 'the only', 'no article'], explanation: `“${object}” begins with ${answer === 'an' ? 'a vowel sound' : 'a consonant sound'}, so “${answer}” is correct.`, templateKey: `article-${student}-${place}-${object}` };
  }
  if (key.includes('preposition')) return { stem: `Choose the correct preposition: “The chart prepared by ${student} is ___ the wall near the ${place}.”`, answer: 'on', distractors: ['into', 'among', 'during'], explanation: 'Something attached to a wall is “on” the wall.', templateKey: `preposition-${student}-${place}` };
  if (key.includes('verb') || key.includes('tense')) {
    const activities = ['activity register', 'attendance sheet', 'reading diary', 'science checklist', 'sports record', 'project calendar', 'library log', 'practice notebook'];
    const activity = activities[Math.floor(seed / 23) % activities.length];
    return { stem: `Choose the correct verb: “Every morning, ${student} ___ the ${activity} in the ${place}.”`, answer: 'checks', distractors: ['check', 'checking', 'have check'], explanation: 'A singular subject in the simple present takes “checks.”', templateKey: `verb-${student}-${place}-${activity}` };
  }
  if (key.includes('spelling')) {
    const words = [['necessary', ['neccessary', 'necesary', 'necessery']], ['beautiful', ['beutiful', 'beautifull', 'beauteful']], ['separate', ['seperate', 'separrate', 'separete']], ['knowledge', ['knowlege', 'knowladge', 'knowledje']]];
    const [answer, distractors] = words[seed % words.length];
    return { stem: `Choose the correctly spelled word for ${student}'s ${place} notice.`, answer, distractors, explanation: `“${answer}” is the correct spelling.`, templateKey: `spelling-${answer}-${student}-${place}` };
  }
  if (key.includes('ordering') || key.includes('sentence formation') || key.includes('types of sentence')) return { stem: `Choose the correctly ordered sentence about ${student} and the ${place}.`, answer: `${student} quietly opened the ${place}.`, distractors: [`Quietly ${student} the ${place} opened.`, `Opened the quietly ${place} ${student}.`, `The opened ${student} quietly ${place}.`], explanation: 'The correct order is subject + adverb + verb + object.', templateKey: `ordering-${student}-${place}` };
  if (key.includes('synonym') || key.includes('antonym') || key.includes('vocabulary') || key.includes('confusing') || key.includes('idiom')) {
    const sets = key.includes('antonym')
      ? [['ancient', 'modern', ['old', 'historic', 'aged']], ['expand', 'contract', ['extend', 'increase', 'enlarge']], ['brave', 'cowardly', ['bold', 'fearless', 'valiant']]]
      : [['rapid', 'quick', ['silent', 'rough', 'late']], ['assist', 'help', ['refuse', 'hide', 'delay']], ['observe', 'notice', ['forget', 'damage', 'avoid']]];
    const [word, answer, distractors] = sets[seed % sets.length];
    return { stem: `Choose the ${key.includes('antonym') ? 'antonym' : 'synonym'} of “${word}” in ${student}'s ${place} exercise.`, answer, distractors, explanation: `“${answer}” is the correct ${key.includes('antonym') ? 'antonym' : 'synonym'} of “${word}.”`, templateKey: `word-meaning-${word}-${answer}-${student}-${place}` };
  }
  if (key.includes('question tag')) return { stem: `Complete the question tag: “The team led by ${student} is visiting the ${place}, ___?”`, answer: "isn't it", distractors: ["doesn't it", "wasn't it", "is it"], explanation: 'A positive statement with “is” and the singular subject “team” takes the negative tag “isn’t it.”', templateKey: `tag-${student}-${place}` };
  if (key.includes('interjection')) return { stem: `Choose the interjection: “___! ${student} completed the ${place} project.”`, answer: 'Hurray', distractors: ['Because', 'Under', 'Slowly'], explanation: '“Hurray!” expresses sudden joy and is an interjection.', templateKey: `interjection-${student}-${place}` };
  if (key.includes('adjective')) return { stem: `Choose the adjective: “${student} carried a bright poster into the ${place}.”`, answer: 'bright', distractors: [student, 'carried', 'into'], explanation: '“Bright” describes the noun “poster.”', templateKey: `adjective-${student}-${place}` };
  if (key.includes('adverb')) return { stem: `Which word best completes the sentence: “${student} arranged the books ___ in the ${place}”?`, answer: 'carefully', distractors: ['careful', 'care', 'carefulness'], explanation: '“Carefully” is an adverb describing how the books were arranged.', templateKey: `adverb-${student}-${place}` };
  if (key.includes('collective noun')) return { stem: `Choose the collective noun for a group of birds in ${student}'s ${place} worksheet.`, answer: 'flock', distractors: ['bundle', 'fleet', 'pack'], explanation: 'A group of birds is called a flock.', templateKey: `collective-${student}-${place}` };
  if (key.includes('pronoun')) return { stem: `Which word is the pronoun in “${student} said, ‘I will visit the ${place}’”?`, answer: 'I', distractors: [student, 'visit', place], explanation: '“I” is used as a pronoun by the speaker.', templateKey: `pronoun-${student}-${place}` };
  if (key.includes('noun')) return { stem: `Which word is the proper noun in “${student} visited the ${place} on Monday”?`, answer: student, distractors: ['visited', place, 'on'], explanation: `${student} is the specific name of a person and is a proper noun.`, templateKey: `noun-${student}-${place}` };
  if (key.includes('rhyming')) return { stem: `Which word rhymes with “light” on ${student}'s ${place} card?`, answer: 'bright', distractors: ['late', 'left', 'lot'], explanation: '“Light” and “bright” share the same ending sound.', templateKey: `rhyme-${student}-${place}` };
  if (key.includes('gender')) return { stem: `Choose the feminine gender form of “nephew” for ${student}'s ${place} worksheet.`, answer: 'niece', distractors: ['aunt', 'sister', 'daughter'], explanation: 'The feminine counterpart of “nephew” is “niece.”', templateKey: `gender-${student}-${place}` };
  const singular = ['leaf', 'knife', 'shelf', 'child', 'woman'][seed % 5];
  const plural = { leaf: 'leaves', knife: 'knives', shelf: 'shelves', child: 'children', woman: 'women' }[singular];
  return { stem: `Select the correct plural of “${singular}” for ${student}'s ${place} record.`, answer: plural, distractors: [`${singular}s`, `${singular}es`, `${singular}'s`], explanation: `The correct plural of “${singular}” is “${plural}.”`, templateKey: `plural-${singular}-${student}-${place}` };
}

const factGroups = [
  ['renewable source', 'solar energy', ['coal', 'petrol', 'diesel']],
  ['planet known for prominent rings', 'Saturn', ['Mars', 'Venus', 'Mercury']],
  ['instrument used to measure temperature', 'thermometer', ['barometer', 'compass', 'telescope']],
  ['Indian national animal', 'Bengal tiger', ['Asian elephant', 'snow leopard', 'lion-tailed macaque']],
  ['process that changes liquid water into vapour', 'evaporation', ['condensation', 'freezing', 'precipitation']],
  ['branch that protects India at sea', 'Indian Navy', ['Indian Army', 'Indian Air Force', 'Coast Guard Auxiliary']],
  ['organ that pumps blood', 'heart', ['lungs', 'stomach', 'kidney']],
  ['practice that reduces soil erosion', 'planting trees', ['removing grass', 'burning stubble', 'leaving soil bare']],
  ['international organisation focused on global health', 'WHO', ['UNESCO', 'FIFA', 'ICC']],
  ['direction in which the Sun appears to rise', 'east', ['west', 'north', 'south']],
  ['gas used by green plants during photosynthesis', 'carbon dioxide', ['oxygen only', 'nitrogen only', 'helium']],
  ['method that preserves food by removing moisture', 'drying', ['soaking', 'rinsing', 'peeling']]
];

function generalKnowledgeQuestion({ topic, seed, courseKey }) {
  const key = topic.toLowerCase();
  let fact;
  if (key.includes('national symbol')) fact = ['Indian national animal', 'Bengal tiger', ['Asian elephant', 'snow leopard', 'lion-tailed macaque']];
  else if (key.includes('india at') || key.includes('india and the world')) fact = ['capital of India', 'New Delhi', ['Mumbai', 'Kolkata', 'Chennai']];
  else if (key.includes('art') || key.includes('culture')) fact = ['classical dance form from Tamil Nadu', 'Bharatanatyam', ['Bihu', 'Garba', 'Ghoomar']];
  else if (key.includes('award') || key.includes('personalit') || key.includes('literary')) fact = ['Indian award associated with literature', 'Sahitya Akademi Award', ['Arjuna Award', 'Dronacharya Award', 'Major Dhyan Chand Khel Ratna']];
  else if (key.includes('defence')) fact = ['branch that protects India at sea', 'Indian Navy', ['Indian Army', 'Indian Air Force', 'Territorial Army']];
  else if (key.includes('sport')) fact = ['number of players in a cricket team on the field', '11', ['9', '10', '12']];
  else if (key.includes('organization')) fact = ['international organisation focused on global health', 'WHO', ['UNESCO', 'FIFA', 'ICC']];
  else if (key.includes('solar') || key.includes('earth')) fact = ['planet known for prominent rings', 'Saturn', ['Mars', 'Venus', 'Mercury']];
  else if (key.includes('mountain') || key.includes('geography')) fact = ['farming method commonly used on steep hill slopes', 'terrace farming', ['deep-sea farming', 'factory farming', 'drift farming']];
  else if (key.includes('water cycle')) fact = ['process that changes liquid water into vapour', 'evaporation', ['condensation', 'freezing', 'precipitation']];
  else if (key.includes('energy') || key.includes('environment')) fact = ['renewable source', 'solar energy', ['coal', 'petrol', 'diesel']];
  else if (key.includes('climate') || key.includes('calamit')) fact = ['instrument used to record earthquake waves', 'seismograph', ['thermometer', 'rain gauge', 'wind vane']];
  else if (key.includes('use of water') || key.includes('uses of water')) fact = ['irrigation method that saves water by delivering it near roots', 'drip irrigation', ['flood irrigation', 'canal overflow', 'open spraying all day']];
  else if (key.includes('digestion') || key.includes('food preservation') || key.includes('everyday')) fact = ['method that preserves food by removing moisture', 'drying', ['soaking', 'rinsing', 'peeling']];
  else if (key.includes('farm') || key.includes('seed')) fact = ['condition needed by most seeds for germination', 'water air and warmth', ['paint and salt', 'sand only', 'bright light only']];
  else if (key.includes('tribal') || key.includes('forest')) fact = ['practice that helps conserve a forest', 'planting native trees', ['burning dry leaves widely', 'removing all young plants', 'dumping plastic waste']];
  else if (key.includes('scientific device') || key.includes('science')) fact = ['instrument used to measure temperature', 'thermometer', ['barometer', 'compass', 'telescope']];
  else if (key.includes('pollution') || key.includes('microbial')) fact = ['safe step that reduces water-borne infection risk', 'boiling drinking water', ['leaving water uncovered', 'mixing waste into water', 'drinking from any puddle']];
  else if (key.includes('human') || key.includes('animal')) fact = ['organ that pumps blood', 'heart', ['lungs', 'stomach', 'kidney']];
  else if (key.includes('function of plant')) fact = ['gas used by green plants during photosynthesis', 'carbon dioxide', ['oxygen only', 'nitrogen only', 'helium']];
  else if (key.includes('super senses') || key.includes('young ones')) fact = ['young one of a frog', 'tadpole', ['calf', 'cub', 'chick']];
  else if (key.includes('history') || key.includes('civics')) fact = ['document that lays down the fundamental law of India', 'Constitution of India', ['school diary', 'railway timetable', 'weather chart']];
  else if (key.includes('current affairs')) fact = ['most reliable source for a current official government announcement', 'official government website', ['an anonymous forward', 'an unverified rumour', 'an unsigned poster']];
  else fact = factGroups[hashNumber(`${courseKey}-${topic}-${seed}`) % factGroups.length];
  const [description, answer, distractors] = fact;
  const station = 1 + (seed % 10007);
  const contexts = ['quiz board', 'field journal', 'science display', 'heritage card', 'training worksheet'];
  const context = contexts[Math.floor(seed / 11) % contexts.length];
  return {
    stem: `At ${context} ${station}, which option correctly identifies the ${description}?`, answer, distractors,
    explanation: `${answer} is the correct ${description}.`, templateKey: `gk-${description}-${station}-${context}-${topic}`
  };
}

function rawQuestion(section, topic, context) {
  if (section.key === 'mathematics') return mathematicsQuestion({ topic, ...context });
  if (section.key === 'intelligence') return intelligenceQuestion({ topic, ...context });
  if (section.key === 'language' || section.key === 'english') return languageQuestion({ topic, ...context });
  return generalKnowledgeQuestion({ topic, ...context });
}

function createQuestion({ course, section, topic, seed, levelIndex, testId, questionNumber }) {
  const raw = rawQuestion(section, topic, { seed, levelIndex, courseKey: course.key });
  const { options, correctOption } = makeOptions(raw.answer, raw.distractors, `${testId}-${questionNumber}`);
  const marks = section.marks / section.questionCount;
  const question = {
    questionId: `${testId}-Q${String(questionNumber).padStart(3, '0')}`, testId, questionNumber,
    course: course.key, subject: section.subject, section: section.section, topic, coverageTopics: [topic], syllabusSubtopics: [topic],
    type: raw.passage ? 'passage-mcq' : 'mcq', stem: raw.stem, ...(raw.passage ? { passageId: `${testId}-PASS-${questionNumber}`, passage: raw.passage } : {}),
    options, correctOption, explanation: raw.explanation, difficulty: course.levels[levelIndex], difficultyLabel: levelLabels[course.levels[levelIndex]],
    syllabusYear: course.year, syllabusVersion: course.syllabusVersion, moduleVersion: course.moduleVersion, marks, status: 'validated',
    semanticFingerprint: digest({ course: course.key, subject: section.subject, topic, templateKey: raw.templateKey })
  };
  return { ...question, promptFingerprint: promptFingerprint(question), renderFingerprint: renderedFingerprint(question), underlyingFingerprint: underlyingFingerprint(question), fingerprint: renderedFingerprint(question), difficultyRank: levelIndex + 1 };
}

function generateCourseBank(courseKey, { excludedPromptFingerprints = [], excludedUnderlyingFingerprints = [] } = {}) {
  const course = getExamCourse(courseKey);
  if (course.key === 'jnvst') throw new Error('JNVST uses its dedicated authored engine.');
  const tests = [];
  const questions = [];
  const promptQuestions = new Set(excludedPromptFingerprints);
  const underlyingQuestions = new Set(excludedUnderlyingFingerprints);
  const semanticQuestions = new Set();
  for (let levelIndex = 0; levelIndex < course.levels.length; levelIndex += 1) {
    const difficulty = course.levels[levelIndex];
    for (let paperIndex = 0; paperIndex < course.standard.papersPerLevel; paperIndex += 1) {
      const globalNumber = levelIndex * course.standard.papersPerLevel + paperIndex + 1;
      const testId = `${course.shortName.replace(/\W/g, '')}-${difficulty.slice(0, 3).toUpperCase()}-${String(paperIndex + 1).padStart(2, '0')}`;
      const rows = [];
      let questionNumber = 0;
      for (const section of course.blueprint) {
        const sectionTopics = section.topics.map(([topic]) => topic);
        for (let index = 0; index < section.questionCount; index += 1) {
          questionNumber += 1;
          const topic = sectionTopics[(index + paperIndex + levelIndex) % sectionTopics.length];
          const seed = (course.key === 'sainik' ? 2 : 3) * 10000000 + globalNumber * 10000 + questionNumber * 17 + index;
          let question;
          for (let attempt = 0; attempt < 10000; attempt += 1) {
            const variantSeed = attempt === 0 ? seed : hashNumber(`${course.key}-${seed}-${attempt}`);
            question = createQuestion({ course, section, topic, seed: variantSeed, levelIndex, testId, questionNumber });
            if (
              !promptQuestions.has(question.promptFingerprint) &&
              !underlyingQuestions.has(question.underlyingFingerprint) &&
              !semanticQuestions.has(question.semanticFingerprint)
            ) break;
            question = null;
          }
          if (!question) throw new Error(`Unable to create unique content for ${testId} question ${questionNumber} (${topic}).`);
          promptQuestions.add(question.promptFingerprint);
          underlyingQuestions.add(question.underlyingFingerprint);
          semanticQuestions.add(question.semanticFingerprint);
          rows.push(question);
        }
      }
      questions.push(...rows);
      tests.push({
        testId, course: course.key, number: globalNumber, categoryNumber: paperIndex + 1,
        title: `${course.shortName} ${levelLabels[difficulty]} Full Test ${paperIndex + 1}`, difficulty, difficultyLabel: levelLabels[difficulty],
        questionCount: rows.length, totalMarks: course.standard.marksPerPaper, durationMinutes: course.standard.durationMinutes,
        questionIds: rows.map((question) => question.questionId),
        sectionCounts: Object.fromEntries(course.blueprint.map((section) => [section.subject, rows.filter((question) => question.subject === section.subject).length])),
        topicCoverage: [...new Set(rows.map((question) => question.topic))],
        syllabusCoverage: Object.fromEntries(course.blueprint.map((section) => [section.subject, [...new Set(rows.filter((question) => question.subject === section.subject).map((question) => question.topic))]])),
        markingScheme: { negativeMarking: course.standard.negativeMarking, sectionMarks: Object.fromEntries(course.blueprint.map((section) => [section.subject, section.marks])) },
        examMode: course.standard.examMode, language: course.standard.defaultLanguage, syllabusYear: course.year,
        syllabusVersion: course.syllabusVersion, moduleVersion: course.moduleVersion, status: 'validated'
      });
    }
  }
  return { tests, questions };
}

export function generateEntranceBank(courseKey) {
  if (courseKey !== 'rms') return generateCourseBank(courseKey);
  const sainikBank = generateCourseBank('sainik');
  return generateCourseBank('rms', {
    excludedPromptFingerprints: sainikBank.questions.map((question) => question.promptFingerprint),
    excludedUnderlyingFingerprints: sainikBank.questions.map((question) => question.underlyingFingerprint)
  });
}

export function validateEntranceBank(courseKey, bank) {
  const course = getExamCourse(courseKey);
  const errors = [];
  const expectedTests = course.levels.length * course.standard.papersPerLevel;
  const expectedQuestions = expectedTests * course.standard.questionsPerPaper;
  if (bank.tests.length !== expectedTests) errors.push(`Expected ${expectedTests} tests, received ${bank.tests.length}.`);
  if (bank.questions.length !== expectedQuestions) errors.push(`Expected ${expectedQuestions} questions, received ${bank.questions.length}.`);
  const ids = new Set();
  const prompts = new Set();
  const renders = new Set();
  const semantics = new Set();
  const underlyingQuestions = new Set();
  for (const level of course.levels) if (bank.tests.filter((test) => test.difficulty === level).length !== course.standard.papersPerLevel) errors.push(`Expected 10 ${level} tests.`);
  for (const test of bank.tests) {
    const rows = bank.questions.filter((question) => question.testId === test.testId);
    if (rows.length !== course.standard.questionsPerPaper) errors.push(`${test.testId} contains ${rows.length}/${course.standard.questionsPerPaper} questions.`);
    const earnedMarks = rows.reduce((sum, question) => sum + question.marks, 0);
    if (earnedMarks !== course.standard.marksPerPaper) errors.push(`${test.testId} totals ${earnedMarks}/${course.standard.marksPerPaper} marks.`);
    for (const section of course.blueprint) {
      const sectionRows = rows.filter((question) => question.subject === section.subject);
      if (sectionRows.length !== section.questionCount) errors.push(`${test.testId} contains ${sectionRows.length}/${section.questionCount} ${section.subject} questions.`);
      const covered = new Set(sectionRows.map((question) => question.topic));
      for (const [topic] of section.topics) if (!covered.has(topic)) errors.push(`${test.testId} is missing ${section.subject}: ${topic}.`);
    }
  }
  for (const question of bank.questions) {
    if (ids.has(question.questionId)) errors.push(`Duplicate ID ${question.questionId}.`); ids.add(question.questionId);
    if (prompts.has(question.promptFingerprint)) errors.push(`Duplicate prompt ${question.questionId}.`); prompts.add(question.promptFingerprint);
    if (renders.has(question.renderFingerprint)) errors.push(`Duplicate rendered question ${question.questionId}.`); renders.add(question.renderFingerprint);
    if (semantics.has(question.semanticFingerprint)) errors.push(`Semantic duplicate ${question.questionId}.`); semantics.add(question.semanticFingerprint);
    if (underlyingQuestions.has(question.underlyingFingerprint)) errors.push(`Underlying duplicate ${question.questionId}.`); underlyingQuestions.add(question.underlyingFingerprint);
    if (question.promptFingerprint !== promptFingerprint(question)) errors.push(`Invalid prompt fingerprint ${question.questionId}.`);
    if (question.renderFingerprint !== renderedFingerprint(question)) errors.push(`Invalid render fingerprint ${question.questionId}.`);
    if (question.underlyingFingerprint !== underlyingFingerprint(question)) errors.push(`Invalid underlying fingerprint ${question.questionId}.`);
    if (renderedFingerprint({ ...question, options: [...question.options].reverse() }) !== question.renderFingerprint) errors.push(`Option-order invariant failed ${question.questionId}.`);
    if (question.options.length !== 4 || new Set(question.options.map(visibleOption)).size !== 4) errors.push(`Invalid options ${question.questionId}.`);
    if (!question.options.some((option) => option.id === question.correctOption)) errors.push(`Missing answer ${question.questionId}.`);
  }
  const report = {
    status: errors.length ? 'failed' : 'passed', course: course.key, moduleVersion: course.moduleVersion,
    testCount: bank.tests.length, questionCount: bank.questions.length,
    levelCounts: Object.fromEntries(course.levels.map((level) => [level, bank.tests.filter((test) => test.difficulty === level).length])),
    subjectCounts: Object.fromEntries(course.blueprint.map((section) => [section.subject, bank.questions.filter((question) => question.subject === section.subject).length])),
    uniqueQuestionIds: ids.size, uniquePromptFingerprints: prompts.size, uniqueRenderFingerprints: renders.size,
    uniqueSemanticFingerprints: semantics.size, uniqueUnderlyingFingerprints: underlyingQuestions.size, optionOrderInvariantChecks: bank.questions.length, errorCount: errors.length, errors: errors.slice(0, 100)
  };
  if (errors.length) throw new Error(`${course.shortName} bank validation failed with ${errors.length} error(s):\n${errors.slice(0, 20).join('\n')}`);
  return report;
}
