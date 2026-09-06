import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import testImportsHandler from '../test-import-handler.js';
import { VIJETHA_COLLECTIONS } from '../database-config.js';
import {
  decodeTestImportFile,
  extractUploadedTest,
  previewTestImport,
  questionsFromCsv,
  questionsFromExtractedPages,
  questionsFromExtractedText,
  testImportLimits,
} from '../test-import-service.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixtureDirectory = path.join(root, 'public', 'test-import-samples');

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end(body) { this.body = body; return this; },
  };
}

function uploadFile(filename, mimeType, buffer) {
  return decodeTestImportFile({ fileName: filename, mimeType, dataBase64: buffer.toString('base64') });
}

const [csvBuffer, pdfBuffer, scannedPdfBuffer, imageBuffer, complexPdfBuffer, visualPdfBuffer, xlsxBuffer] = await Promise.all([
  readFile(path.join(fixtureDirectory, 'sample-test-paper.csv')),
  readFile(path.join(fixtureDirectory, 'sample-test-paper.pdf')),
  readFile(path.join(fixtureDirectory, 'sample-scanned-test-paper.pdf')),
  readFile(path.join(fixtureDirectory, 'sample-test-paper.png')),
  readFile(path.join(fixtureDirectory, 'sample-complex-test-paper.pdf')),
  readFile(path.join(fixtureDirectory, 'sample-visual-question.pdf')),
  readFile(path.join(fixtureDirectory, 'sample-visual-questions.xlsx')),
]);

const structured = questionsFromCsv(csvBuffer.toString('utf8'));
assert.equal(structured.length, 3);
assert.deepEqual(structured.map((question) => question.answer), ['C', 'B', 'D']);
assert.equal(structured[0].stem, 'What is 48 divided by 6?');

const plainText = questionsFromExtractedText('1. What is 5 + 7?\nA) 10\nB) 11\nC) 12\nD) 13\nAnswer: C');
assert.equal(plainText.length, 1);
assert.equal(plainText[0].options.length, 4);
assert.equal(plainText[0].answer, 'C');

const difficultPages = [
  {
    pageNumber: 1,
    text: `Q. No. 1: Which number is prime? A) 9 B) 11 C) 15 D) 21 Ans: B
Question 2 - Choose the correctly spelt word.
A) Recieve
B) Receive
C) Receeve
D) Receve
Answer: B
3) A rectangle has length 8 cm and
width 3 cm. What is its area?
(A) 11 cm2
(B) 16 cm2
(C) 24 cm2
(D) 32 cm2
Answer - C
(4) Complete the series: 5, 10, 20, 40, __
A. 50 B. 60 C. 70 D. 80
Correct Answer: D`,
  },
  {
    pageNumber: 2,
    text: `Q5 Which direction is opposite to east?
A West
B North
C South
D North-East
Ans. A
6. Select the largest fraction.
(1) 1/4
(2) 3/4
(3) 2/5
(4) 1/2
Answer: 2
7.
A train covers 60 km in one hour. How far in two hours?
A) 90 km
B) 100 km
C) 120 km
D) 140 km
Ans: C
[8] Which word is an adjective?
A) Swiftly
B) Beauty
C) Colourful
D) Speak
Answer: C`,
  },
];
const difficultQuestions = questionsFromExtractedPages(difficultPages, 'Medium');
assert.equal(difficultQuestions.length, 8, `Expected all 8 varied question formats; received ${difficultQuestions.length}.`);
assert.deepEqual(difficultQuestions.map((question) => question.options.length), [4, 4, 4, 4, 4, 4, 4, 4]);
assert.deepEqual(difficultQuestions.map((question) => question.answer), ['B', 'B', 'C', 'D', 'A', 'B', 'C', 'C']);
assert.deepEqual(difficultQuestions.map((question) => question.sourcePage), [1, 1, 1, 1, 2, 2, 2, 2]);

const regionalNumbering = questionsFromExtractedText('१. सही संख्या चुनिए?\nक) १\nख) २\nग) ३\nघ) ४\nउत्तर: ख\n\n౨. సరైన పదాన్ని ఎంచుకోండి?\nఅ) ఒకటి\nఆ) రెండు\nఇ) మూడు\nఈ) నాలుగు\nజవాబు: ఇ');
assert.equal(regionalNumbering.length, 2);
assert.deepEqual(regionalNumbering.map((question) => question.number), [1, 2]);
assert.deepEqual(regionalNumbering.map((question) => question.answer), ['B', 'C']);
assert.deepEqual(regionalNumbering.map((question) => question.options.length), [4, 4]);

const unnumberedQuestions = questionsFromExtractedText('Which animal is known as the ship of the desert?\nA) Horse\nB) Camel\nC) Tiger\nD) Yak\nAnswer: B\n\nWhat is 9 multiplied by 7?\nA) 56\nB) 63\nC) 72\nD) 81\nAnswer: B');
assert.equal(unnumberedQuestions.length, 2);
assert.deepEqual(unnumberedQuestions.map((question) => question.options.length), [4, 4]);

const csvResult = await extractUploadedTest(uploadFile('sample-test-paper.csv', 'text/csv', csvBuffer), 'eng');
assert.equal(csvResult.extractionMethod, 'Structured CSV');
assert.equal(csvResult.questions.length, 3);

const excelResult = await extractUploadedTest(uploadFile('sample-visual-questions.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xlsxBuffer), 'eng');
assert.equal(excelResult.extractionMethod, 'Excel workbook');
assert.equal(excelResult.questions.length, 3);
assert.equal(excelResult.questions[1].options.length, 4);
assert.ok(excelResult.questions[1].options.every((option) => option.isVisual));
assert.equal(excelResult.questions[1].answer, 'C');
assert.equal(excelResult.questions[1].hasVisual, true);
assert.ok(excelResult.questions[1].questionImage.dataBase64.length > 100);

const pdfResult = await extractUploadedTest(uploadFile('sample-test-paper.pdf', 'application/pdf', pdfBuffer), 'eng');
assert.equal(pdfResult.extractionMethod, 'PDF text');
assert.equal(pdfResult.totalPages, 1);
assert.equal(pdfResult.questions.length, 3);
assert.deepEqual(pdfResult.questions.map((question) => question.answer), ['C', 'B', 'D']);
assert.equal(pdfResult.sourcePages.length, 1);
assert.ok(pdfResult.sourcePages[0].dataBase64.length > 100);
assert.deepEqual(pdfResult.questions.map((question) => question.sourcePage), [1, 1, 1]);

const complexPdfResult = await extractUploadedTest(uploadFile('sample-complex-test-paper.pdf', 'application/pdf', complexPdfBuffer), 'eng', 'accurate');
assert.equal(complexPdfResult.totalPages, 2);
assert.equal(complexPdfResult.questions.length, 8, `Expected 8 questions from the complex PDF; received ${complexPdfResult.questions.length}.`);
assert.deepEqual(complexPdfResult.questions.map((question) => question.options.length), [4, 4, 4, 4, 4, 4, 4, 4]);
assert.equal(complexPdfResult.sourcePages.length, 2);
assert.equal(complexPdfResult.questions.filter((question) => question.questionImage?.dataBase64).length, 8);

const visualPdfResult = await extractUploadedTest(uploadFile('sample-visual-question.pdf', 'application/pdf', visualPdfBuffer), 'eng', 'accurate');
assert.equal(visualPdfResult.questions.length, 1);
assert.equal(visualPdfResult.questions[0].sourceNumber, 8);
assert.equal(visualPdfResult.questions[0].options.length, 4);
assert.ok(visualPdfResult.questions[0].options.every((option) => option.isVisual));
assert.equal(visualPdfResult.questions[0].hasVisual, true);
assert.ok(visualPdfResult.questions[0].questionImage.dataBase64.length > 100);
assert.equal(visualPdfResult.questions[0].questionImage.cropConfidence, 'Exact');

const imageResult = await extractUploadedTest(uploadFile('sample-test-paper.png', 'image/png', imageBuffer), 'eng');
assert.equal(imageResult.extractionMethod, 'Image OCR');
assert.equal(imageResult.questions.length, 3);
assert.deepEqual(imageResult.questions.map((question) => question.answer), ['C', 'B', 'D']);
assert.ok(imageResult.ocrConfidence >= 70, `Expected readable sample-image OCR; received ${imageResult.ocrConfidence}.`);
assert.equal(imageResult.sourcePages.length, 1);

const scannedPdfResult = await extractUploadedTest(uploadFile('sample-scanned-test-paper.pdf', 'application/pdf', scannedPdfBuffer), 'eng');
assert.equal(scannedPdfResult.extractionMethod, 'Scanned PDF OCR');
assert.equal(scannedPdfResult.questions.length, 3);
assert.deepEqual(scannedPdfResult.questions.map((question) => question.answer), ['C', 'B', 'D']);

const previewResult = await previewTestImport({
  course: 'jnvst',
  title: 'Demo CSV preview',
  ocrLanguage: 'eng',
  file: {
    fileName: 'sample-test-paper.csv',
    mimeType: 'text/csv',
    dataBase64: csvBuffer.toString('base64'),
  },
});
assert.match(previewResult.id, /^preview-/);
assert.equal(previewResult.persisted, false);
assert.equal(previewResult.questionCount, 3);
assert.equal(previewResult.questions.length, 3);

assert.equal(VIJETHA_COLLECTIONS.testImports, 'test_imports_Vijetha');
assert.equal(testImportLimits.maxFileBytes, 3 * 1024 * 1024);
assert.equal(testImportLimits.maxQuestions, 500);
assert.equal(testImportLimits.maxScannedPdfPages, testImportLimits.maxPdfPages);
assert.deepEqual(new Set(testImportLimits.allowedOcrLanguages), new Set(['eng', 'hin', 'tel']));
assert.throws(() => decodeTestImportFile({
  fileName: 'renamed.pdf',
  mimeType: 'application/pdf',
  dataBase64: Buffer.from('not a PDF').toString('base64'),
}), /not a valid PDF/);
assert.throws(() => decodeTestImportFile({
  fileName: 'script.html',
  mimeType: 'text/html',
  dataBase64: Buffer.from('<script>alert(1)</script>').toString('base64'),
}), /PDF, Excel \.xlsx, CSV, JPG, PNG, or WebP/);

delete process.env.MONGODB_URI;
delete process.env.AUTH_SECRET;
const apiPreview = responseRecorder();
await testImportsHandler({
  method: 'POST',
  query: { action: 'preview' },
  headers: { origin: 'http://localhost:5174', host: 'localhost:5174', 'x-forwarded-for': '127.0.0.2' },
  body: {
    course: 'jnvst',
    title: 'API demo preview',
    ocrLanguage: 'eng',
    file: {
      fileName: 'sample-test-paper.csv',
      mimeType: 'text/csv',
      dataBase64: csvBuffer.toString('base64'),
    },
  },
}, apiPreview);
assert.equal(apiPreview.statusCode, 200);
assert.equal(apiPreview.body.testImport.persisted, false);
assert.equal(apiPreview.body.testImport.questionCount, 3);

const unauthenticated = responseRecorder();
await testImportsHandler({ method: 'GET', query: { course: 'jnvst' }, headers: {} }, unauthenticated);
assert.equal(unauthenticated.statusCode, 401);
assert.equal(unauthenticated.body.code, 'AUTHENTICATION_REQUIRED');

const crossOrigin = responseRecorder();
await testImportsHandler({
  method: 'POST',
  query: {},
  headers: { origin: 'https://attacker.example', host: 'vijetha.example' },
  body: {},
}, crossOrigin);
assert.equal(crossOrigin.statusCode, 403);
assert.equal(crossOrigin.body.code, 'INVALID_ORIGIN');

console.log(JSON.stringify({
  status: 'passed',
  collection: VIJETHA_COLLECTIONS.testImports,
  fixtures: {
    csv: { method: csvResult.extractionMethod, questions: csvResult.questions.length },
    excel: { method: excelResult.extractionMethod, questions: excelResult.questions.length, visualOptions: excelResult.questions[1].options.length, questionImage: Boolean(excelResult.questions[1].questionImage) },
    textPdf: { method: pdfResult.extractionMethod, questions: pdfResult.questions.length },
    complexPdf: { method: complexPdfResult.extractionMethod, questions: complexPdfResult.questions.length, sourcePages: complexPdfResult.sourcePages.length },
    visualPdf: { method: visualPdfResult.extractionMethod, questions: visualPdfResult.questions.length, visualOptions: visualPdfResult.questions[0].options.length, questionImage: Boolean(visualPdfResult.questions[0].questionImage) },
    image: { method: imageResult.extractionMethod, questions: imageResult.questions.length, ocrConfidence: imageResult.ocrConfidence },
    scannedPdf: { method: scannedPdfResult.extractionMethod, questions: scannedPdfResult.questions.length, ocrConfidence: scannedPdfResult.ocrConfidence },
  },
  security: ['authentication', 'same-origin mutation protection', 'MIME/signature validation', '3 MB limit'],
}, null, 2));
