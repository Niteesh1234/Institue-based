import { generateTestingBank, validateTestingBank } from '../question-engine.js';

const report = validateTestingBank(generateTestingBank());
console.log(JSON.stringify(report, null, 2));
