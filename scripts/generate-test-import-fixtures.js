import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, PDFDocument } from '@napi-rs/canvas';
import ExcelJS from 'exceljs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, 'public', 'test-import-samples');

const questions = [
  {
    number: 1,
    stem: 'What is 48 divided by 6?',
    options: ['6', '7', '8', '9'],
    answer: 'C',
    subject: 'Mathematics',
    difficulty: 'Easy',
  },
  {
    number: 2,
    stem: 'Which word is a noun?',
    options: ['Quickly', 'School', 'Bright', 'Run'],
    answer: 'B',
    subject: 'Language',
    difficulty: 'Easy',
  },
  {
    number: 3,
    stem: 'Complete the pattern: 2, 4, 8, 16, __',
    options: ['18', '24', '30', '32'],
    answer: 'D',
    subject: 'Reasoning',
    difficulty: 'Medium',
  },
];

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCsv() {
  const headers = ['number', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'answer', 'subject', 'difficulty', 'marks'];
  const rows = questions.map((question) => [
    question.number,
    question.stem,
    ...question.options,
    question.answer,
    question.subject,
    question.difficulty,
    1,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

function paperLines() {
  return [
    'VIJETHA SAMPLE CLASS VI TEST',
    '',
    ...questions.flatMap((question) => [
      `${question.number}. ${question.stem}`,
      ...question.options.map((option, index) => `${String.fromCharCode(65 + index)}) ${option}`),
      `Answer: ${question.answer}`,
      '',
    ]),
  ];
}

function pdfEscape(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function buildPdf() {
  const lines = paperLines();
  const commands = lines.map((line, index) => {
    const fontSize = index === 0 ? 15 : 11;
    const y = 754 - index * 19;
    return `BT /F1 ${fontSize} Tf 54 ${y} Td (${pdfEscape(line)}) Tj ET`;
  }).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'binary');
}

function buildMultiPagePdf(pages) {
  const pageIds = pages.map((_, index) => 3 + index * 2);
  const fontId = 3 + pages.length * 2;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ];
  pages.forEach((lines, pageIndex) => {
    const contentId = pageIds[pageIndex] + 1;
    const commands = lines.map((line, index) => {
      const fontSize = index === 0 ? 14 : 9;
      const y = 760 - index * 19;
      return `BT /F1 ${fontSize} Tf 42 ${y} Td (${pdfEscape(line)}) Tj ET`;
    }).join('\n');
    const diagram = pageIndex === 0 ? '\n0.8 w 430 520 90 60 re S 430 520 m 520 580 l S' : '';
    const stream = `${commands}${diagram}`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'binary');
}

const complexPaperPages = [
  [
    'VIJETHA COMPLEX EXTRACTION TEST - PAGE 1',
    'Q. No. 1: Which number is prime? A) 9 B) 11 C) 15 D) 21 Answer: B',
    'Question 2 - Choose the correctly spelt word.',
    'A) Recieve', 'B) Receive', 'C) Receeve', 'D) Receve', 'Answer: B',
    '3) A rectangle has length 8 cm and',
    'width 3 cm. What is its area? Refer to the diagram.',
    '(A) 11 cm2', '(B) 16 cm2', '(C) 24 cm2', '(D) 32 cm2', 'Answer: C',
    '(4) Complete the series: 5, 10, 20, 40, __',
    'A. 50 B. 60 C. 70 D. 80 Correct Answer: D',
  ],
  [
    'VIJETHA COMPLEX EXTRACTION TEST - PAGE 2',
    'Q5 Which direction is opposite to east?',
    'A West', 'B North', 'C South', 'D North-East', 'Ans. A',
    '6. Select the largest fraction.',
    '(1) 1/4', '(2) 3/4', '(3) 2/5', '(4) 1/2', 'Answer: 2',
    '7.', 'A train covers 60 km in one hour. How far in two hours?',
    'A) 90 km', 'B) 100 km', 'C) 120 km', 'D) 140 km', 'Ans: C',
    '[8] Which word is an adjective?',
    'A) Swiftly', 'B) Beauty', 'C) Colourful', 'D) Speak', 'Answer: C',
  ],
];

const visualQuestionPages = [[
  'VIJETHA VISUAL REASONING EXTRACTION TEST',
  'Q8. (Visual - Figure Series)',
  'Find the figure that will come at the fifth position in the series.',
  'The original vector diagram and graphical choices must remain visible.',
  'Options:',
  '(A) (B) (C) (D)',
]];

async function buildPng() {
  const canvas = createCanvas(1500, 1200);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fffdf8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#d9d6cb';
  context.lineWidth = 3;
  context.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);
  context.fillStyle = '#17242a';
  context.font = 'bold 38px Arial';
  context.fillText('VIJETHA SAMPLE CLASS VI TEST', 70, 90);
  context.font = '26px Arial';
  let y = 155;
  for (const line of paperLines().slice(2)) {
    context.fillText(line, 75, y);
    y += line ? 39 : 18;
  }
  return canvas.toBuffer('image/png');
}

function buildVisualOptionPng(index) {
  const canvas = createCanvas(240, 170);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#17242a';
  context.lineWidth = 5;
  context.strokeRect(38, 20, 150, 130);
  if (index !== 1) {
    context.beginPath();
    context.moveTo(38, 20);
    context.lineTo(188, 150);
    context.stroke();
  }
  if (index !== 3) {
    context.beginPath();
    context.moveTo(188, 20);
    context.lineTo(38, 150);
    context.stroke();
  }
  if (index === 0 || index === 2) {
    context.beginPath();
    context.moveTo(113, 20);
    context.lineTo(113, 150);
    context.stroke();
  }
  if (index === 0) {
    context.beginPath();
    context.moveTo(38, 85);
    context.lineTo(188, 85);
    context.stroke();
  }
  return canvas.toBuffer('image/png');
}

async function buildExcelWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('JNVST Visual Test');
  worksheet.addRow(['number', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'answer', 'subject', 'marks']);
  worksheet.addRow([1, 'What is 7 multiplied by 8?', '54', '56', '58', '64', 'B', 'Mathematics', 1]);
  worksheet.addRow([2, 'Which figure completes the visual series?', '', '', '', '', 'C', 'Reasoning', 1]);
  worksheet.addRow([3, 'Choose the correctly spelt word.', 'Recieve', 'Receive', 'Receeve', 'Receve', 'B', 'Language', 1]);
  for (let index = 0; index < 4; index += 1) {
    const imageId = workbook.addImage({ buffer: buildVisualOptionPng(index), extension: 'png' });
    worksheet.addImage(imageId, { tl: { col: index * 2, row: 2.05 }, ext: { width: 120, height: 85 } });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

await mkdir(output, { recursive: true });
const png = await buildPng();
const excelWorkbook = await buildExcelWorkbook();
const scannedPdf = new PDFDocument({ title: 'Vijetha scanned test paper fixture', rasterDPI: 150 });
const scannedPage = scannedPdf.beginPage(750, 600);
scannedPage.drawImage(await loadImage(png), 0, 0, 750, 600);
scannedPdf.endPage();
await Promise.all([
  writeFile(path.join(output, 'sample-test-paper.csv'), buildCsv()),
  writeFile(path.join(output, 'sample-test-paper.pdf'), buildPdf()),
  writeFile(path.join(output, 'sample-test-paper.png'), png),
  writeFile(path.join(output, 'sample-scanned-test-paper.pdf'), scannedPdf.close()),
  writeFile(path.join(output, 'sample-complex-test-paper.pdf'), buildMultiPagePdf(complexPaperPages)),
  writeFile(path.join(output, 'sample-visual-question.pdf'), buildMultiPagePdf(visualQuestionPages)),
  writeFile(path.join(output, 'sample-visual-questions.xlsx'), excelWorkbook),
]);

console.log(`Generated CSV, Excel, text PDF, complex PDF, visual PDF, scanned PDF, and PNG test-import fixtures in ${output}`);
