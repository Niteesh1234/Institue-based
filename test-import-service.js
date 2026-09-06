import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import ExcelJS from 'exceljs';
import { createWorker } from 'tesseract.js';
import engData from '@tesseract.js-data/eng';
import hinData from '@tesseract.js-data/hin';
import telData from '@tesseract.js-data/tel';
import {
  definePDFJSModule,
  extractText,
  extractTextItems,
  getDocumentProxy,
  renderPageAsImage,
} from 'unpdf';
import { AuthError, getTestingDatabase, instituteIdForUser, sessionUser } from './auth-service.js';
import { VIJETHA_COLLECTIONS } from './database-config.js';
import { loadInstitutePolicies } from './institute-control-service.js';

const allowedCourses = new Set(['jnvst', 'sainik', 'rms']);
const allowedOcrLanguages = new Set(['eng', 'hin', 'tel']);
const allowedMimeTypes = new Set(['application/pdf', 'text/csv', 'image/jpeg', 'image/png', 'image/webp', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
const extensionMimeTypes = new Map([
  ['.pdf', 'application/pdf'],
  ['.csv', 'text/csv'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
]);
const ocrLanguageData = { eng: engData, hin: hinData, tel: telData };
const maxFileBytes = 3 * 1024 * 1024;
const maxQuestions = 500;
const maxRawTextLength = 200_000;
const maxPdfPages = 100;
const maxScannedPdfPages = maxPdfPages;
const maxSourcePreviewBytes = 4 * 1024 * 1024;
const maxQuestionImageBytes = 4 * 1024 * 1024;
const maxSourcePreviewWidth = 1100;
let indexPromise;
let pdfModulePromise;

function ensurePdfModule() {
  if (!pdfModulePromise) {
    pdfModulePromise = definePDFJSModule(() => import('pdfjs-dist/legacy/build/pdf.mjs'));
  }
  return pdfModulePromise;
}

function objectId(value, label = 'identifier') {
  if (!ObjectId.isValid(String(value || ''))) throw new AuthError(400, 'INVALID_ID', `The ${label} is invalid.`);
  return new ObjectId(String(value));
}

function cleanText(value, { min = 0, max = 200 } = {}) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (clean.length < min || clean.length > max) throw new AuthError(400, 'INVALID_TEXT', `Text must contain ${min}–${max} characters.`);
  return clean;
}

function normalizeCourse(value) {
  const course = String(value || '').trim().toLowerCase();
  if (!allowedCourses.has(course)) throw new AuthError(400, 'INVALID_COURSE', 'Choose JNVST, AISSEE, or RMS CET.');
  return course;
}

function normalizedHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizedStem(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function safeFilename(value) {
  const clean = String(value || 'uploaded-test').trim().replace(/[^a-zA-Z0-9._ -]/g, '').replace(/\s+/g, '-').slice(0, 120);
  return clean || 'uploaded-test';
}

function fileExtension(filename) {
  const match = String(filename).toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || '';
}

function detectMimeType(filename, supplied) {
  const expected = extensionMimeTypes.get(fileExtension(filename));
  const normalized = String(supplied || '').toLowerCase().split(';')[0].trim();
  if (!expected) throw new AuthError(400, 'UNSUPPORTED_FILE', 'Upload a PDF, Excel .xlsx, CSV, JPG, PNG, or WebP file.');
  if (normalized && normalized !== expected && !(expected === 'text/csv' && ['application/csv', 'application/vnd.ms-excel', 'text/plain'].includes(normalized))) {
    throw new AuthError(400, 'FILE_TYPE_MISMATCH', 'The filename and reported file type do not match.');
  }
  return expected;
}

function hasImageSignature(buffer, mimeType) {
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

export function decodeTestImportFile(input = {}) {
  const filename = safeFilename(input.fileName || input.filename);
  const mimeType = detectMimeType(filename, input.mimeType);
  const encoded = String(input.dataBase64 || '').trim();
  if (!encoded || !/^[a-zA-Z0-9+/]*={0,2}$/.test(encoded)) throw new AuthError(400, 'INVALID_FILE_DATA', 'The uploaded file data is invalid.');
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length) throw new AuthError(400, 'EMPTY_FILE', 'The uploaded file is empty.');
  if (buffer.length > maxFileBytes) throw new AuthError(413, 'FILE_TOO_LARGE', 'Upload a file no larger than 3 MB.');
  if (mimeType === 'application/pdf' && buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new AuthError(400, 'INVALID_PDF', 'The uploaded file is not a valid PDF.');
  }
  if (mimeType.startsWith('image/') && !hasImageSignature(buffer, mimeType)) {
    throw new AuthError(400, 'INVALID_IMAGE', 'The uploaded image signature is invalid.');
  }
  if (mimeType === 'text/csv' && buffer.includes(0)) throw new AuthError(400, 'INVALID_CSV', 'The CSV contains binary data.');
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && buffer.subarray(0, 2).toString('ascii') !== 'PK') {
    throw new AuthError(400, 'INVALID_XLSX', 'The uploaded file is not a valid Excel .xlsx workbook.');
  }
  return { filename, mimeType, buffer, size: buffer.length };
}

export function parseCsvRows(content) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  const text = String(content || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted) throw new AuthError(400, 'INVALID_CSV', 'The CSV contains an unclosed quoted value.');
  return rows;
}

function csvValue(record, ...names) {
  for (const name of names) {
    const value = record[normalizedHeader(name)];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

export function questionsFromCsv(content) {
  const rows = parseCsvRows(content);
  if (rows.length < 2) throw new AuthError(400, 'EMPTY_CSV', 'The CSV needs a header and at least one question row.');
  const headers = rows[0].map(normalizedHeader);
  if (!headers.some((header) => ['question', 'stem', 'questiontext', 'text'].includes(header))) {
    throw new AuthError(400, 'CSV_QUESTION_COLUMN_REQUIRED', 'The CSV needs a question or stem column.');
  }
  return rows.slice(1).map((values, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, values[column] || '']));
    const stem = csvValue(record, 'question', 'stem', 'question_text', 'text');
    if (!stem) return null;
    const options = ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => ({
      id,
      label: csvValue(record, `option_${id}`, `option${id}`),
    })).filter((option) => option.label);
    const answer = csvValue(record, 'answer', 'correct_option', 'correctanswer').toUpperCase().replace(/[^A-F]/g, '').slice(0, 1);
    return {
      number: Number(csvValue(record, 'number', 'question_number')) || index + 1,
      stem,
      options,
      answer,
      subject: csvValue(record, 'subject', 'section'),
      difficulty: csvValue(record, 'difficulty', 'level'),
      marks: Math.max(0, Number(csvValue(record, 'marks', 'mark')) || 1),
      extractionConfidence: 'High',
    };
  }).filter(Boolean);
}

function logicalLines(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966))
    .replace(/[౦-౯]/g, (digit) => String(digit.charCodeAt(0) - 0x0C66))
    .replace(/\r/g, '')
    .replace(/[‐‑‒–—]/g, '-')
    .split('\n')
    .flatMap((line) => line
      .replace(/\s+(?=(?:\([A-Fa-f]\)|[A-Fa-f]\s*[).:])\s+\S)/g, '\n')
      .replace(/\s+(?=(?:correct\s+answer|answer|ans(?:wer)?)\s*[:.\-])/gi, '\n')
      .split('\n'))
    .map((line) => line.trim())
    .filter(Boolean);
}

function questionStart(line) {
  const patterns = [
    /^(?:Q(?:uestion)?\.?\s*(?:No\.?)?\s*[:.#-]?\s*)(\d{1,3})\s*[).:\-]?\s*(.*)$/i,
    /^\[\s*(\d{1,3})\s*\]\s*(.*)$/,
    /^\(\s*(\d{1,3})\s*\)\s*(.*)$/,
    /^(\d{1,3})\s*[).:\-]\s*(.*)$/,
    /^(\d{1,3})$/,
  ];
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) return { number: Number(match[1]), stem: String(match[2] || '').trim() };
  }
  return null;
}

const regionalOptionIds = new Map([
  ['क', 'A'], ['ख', 'B'], ['ग', 'C'], ['घ', 'D'],
  ['అ', 'A'], ['ఆ', 'B'], ['ఇ', 'C'], ['ఈ', 'D'],
]);

function normalizedOptionId(value) {
  const clean = String(value || '').toUpperCase();
  if (regionalOptionIds.has(value)) return regionalOptionIds.get(value);
  if (/^[1-6]$/.test(clean)) return String.fromCharCode(64 + Number(clean));
  return clean;
}

function optionStart(line, loose = false) {
  const letter = line.match(/^(?:\(([A-F])\)|([A-F])\s*[).:\-])\s*(.+)$/i);
  if (letter) return { id: (letter[1] || letter[2]).toUpperCase(), label: letter[3].trim(), numeric: false };
  const ocrLetter = loose ? line.match(/^([A-F])\s+(.{1,160})$/) : null;
  if (ocrLetter) return { id: ocrLetter[1], label: ocrLetter[2].trim(), numeric: false };
  const regional = line.match(/^(?:\(([कखगघఅఆఇఈ])\)|([कखगघఅఆఇఈ])\s*[).:\-])\s*(.+)$/);
  if (regional) return { id: normalizedOptionId(regional[1] || regional[2]), label: regional[3].trim(), numeric: false };
  const numeric = line.match(/^(?:\(([1-6])\)|([1-6])\s*[).:\-])\s*(.+)$/);
  if (!numeric) return null;
  const value = Number(numeric[1] || numeric[2]);
  return { id: String.fromCharCode(64 + value), label: numeric[3].trim(), numeric: true, numericValue: value };
}

function questionBlocks(pages) {
  const blocks = [];
  let current = null;
  let numericOptionSequence = 0;
  for (const page of pages) {
    for (const line of logicalLines(page.text)) {
      const option = optionStart(line);
      if (current && option?.numeric && option.numericValue === numericOptionSequence + 1) {
        current.lines.push(line);
        if (!current.pageNumbers.includes(page.pageNumber)) current.pageNumbers.push(page.pageNumber);
        numericOptionSequence = option.numericValue;
        continue;
      }
      const start = !option || option.numeric ? questionStart(line) : null;
      if (start) {
        if (current) blocks.push(current);
        current = {
          number: start.number,
          lines: start.stem ? [start.stem] : [],
          pageNumber: page.pageNumber,
          pageNumbers: [page.pageNumber],
          confidence: page.confidence,
        };
        numericOptionSequence = 0;
      } else if (current) {
        current.lines.push(line);
        if (!current.pageNumbers.includes(page.pageNumber)) current.pageNumbers.push(page.pageNumber);
        if (option?.numeric) numericOptionSequence = option.numericValue;
      }
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function unnumberedQuestionBlocks(pages) {
  const blocks = [];
  let current = null;
  let nextNumber = 1;
  for (const page of pages) {
    for (const line of logicalLines(page.text)) {
      const option = optionStart(line);
      const answer = /^(?:correct\s+answer|answer|ans(?:wer)?|सही\s*उत्तर|उत्तर|సరైన\s*సమాధానం|సమాధానం|జవాబు)\s*[:.\-]?/i.test(line);
      const beginsQuestion = !option && !answer && line.length >= 8 && /[?？]$/.test(line);
      if (beginsQuestion) {
        if (current) blocks.push(current);
        current = { number: nextNumber, lines: [line], pageNumber: page.pageNumber, pageNumbers: [page.pageNumber], confidence: 'Low' };
        nextNumber += 1;
      } else if (current) {
        current.lines.push(line);
        if (!current.pageNumbers.includes(page.pageNumber)) current.pageNumbers.push(page.pageNumber);
      }
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function parseQuestionBlock(block, fallbackNumber, confidence) {
  const stemParts = [];
  const options = [];
  let answer = '';
  let activeOption = null;
  for (const line of block.lines) {
    const answerMatch = line.match(/^(?:correct\s+answer|answer|ans(?:wer)?|सही\s*उत्तर|उत्तर|సరైన\s*సమాధానం|సమాధానం|జవాబు)\s*[:.\-]?\s*\(?([A-F1-6कखगघఅఆఇఈ])\)?/i);
    if (answerMatch) {
      answer = normalizedOptionId(answerMatch[1]);
      activeOption = null;
      continue;
    }
    const standaloneVisualOption = line.match(/^\(?([A-F])\)?$/i);
    const visualOptionIds = standaloneVisualOption
      ? [standaloneVisualOption[1].toUpperCase()]
      : [...line.matchAll(/(?:\(([A-F])\)|\b([A-F])\))/gi)].map((match) => (match[1] || match[2]).toUpperCase());
    if (standaloneVisualOption || visualOptionIds.length >= 2) {
      for (const id of visualOptionIds) {
        if (!options.some((option) => option.id === id)) options.push({ id, label: `Visual option ${id}`, isVisual: true });
      }
      activeOption = null;
      continue;
    }
    if (/^options?\s*:?$/i.test(line)) {
      activeOption = null;
      continue;
    }
    const detectedOption = optionStart(line) || ((stemParts.length || options.length) ? optionStart(line, true) : null);
    if (detectedOption) {
      activeOption = { id: detectedOption.id, label: detectedOption.label };
      options.push(activeOption);
      continue;
    }
    if (activeOption) activeOption.label = `${activeOption.label} ${line}`.trim();
    else stemParts.push(line);
  }
  const stem = stemParts.join(' ').replace(/\s+/g, ' ').trim();
  if (stem.length < 3) return null;
  return {
    number: block.number || fallbackNumber,
    stem,
    options,
    answer,
    subject: '',
    difficulty: '',
    marks: 1,
    extractionConfidence: confidence,
    sourcePage: block.pageNumber || 1,
    sourcePages: block.pageNumbers || [block.pageNumber || 1],
  };
}

export function questionsFromExtractedPages(pageTexts, confidence = 'Medium') {
  const pages = (Array.isArray(pageTexts) ? pageTexts : [pageTexts]).map((page, index) => (
    typeof page === 'string' ? { pageNumber: index + 1, text: page } : { pageNumber: Number(page.pageNumber) || index + 1, text: String(page.text || '') }
  ));
  const parsed = questionBlocks(pages).map((block, index) => parseQuestionBlock(block, index + 1, block.confidence || confidence)).filter(Boolean);
  if (parsed.length) return parsed;
  const unnumbered = unnumberedQuestionBlocks(pages).map((block, index) => parseQuestionBlock(block, index + 1, 'Low')).filter(Boolean);
  if (unnumbered.length) return unnumbered;
  return pages.flatMap((page) => String(page.text || '').split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length >= 12)
    .map((stem) => ({ stem, sourcePage: page.pageNumber })))
    .slice(0, maxQuestions)
    .map(({ stem, sourcePage }, index) => ({ number: index + 1, stem, options: [], answer: '', subject: '', difficulty: '', marks: 1, extractionConfidence: 'Low', sourcePage, sourcePages: [sourcePage] }));
}

export function questionsFromExtractedText(text, confidence = 'Medium') {
  return questionsFromExtractedPages([{ pageNumber: 1, text }], confidence);
}

function finalizeQuestions(questions) {
  const seen = new Set();
  const rows = [];
  for (const question of questions) {
    const stem = String(question.stem || '').trim().replace(/\s+/g, ' ');
    const optionFingerprint = (question.options || []).map((option) => normalizedStem(option.label || option.text)).join('|');
    const key = `${Number(question.number) || ''}:${Number(question.sourcePage) || ''}:${normalizedStem(stem)}:${optionFingerprint}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const options = (question.options || []).map((option, index) => ({
      id: String(option.id || String.fromCharCode(65 + index)).toUpperCase().slice(0, 1),
      label: String(option.label || option.text || '').trim().replace(/\s+/g, ' '),
      isVisual: Boolean(option.isVisual),
    })).filter((option) => option.label).slice(0, 6);
    const validOptionIds = new Set(options.map((option) => option.id));
    const proposedAnswer = String(question.answer || '').toUpperCase().replace(/[^A-F]/g, '').slice(0, 1);
    rows.push({
      number: rows.length + 1,
      sourceNumber: Number(question.number) || rows.length + 1,
      stem,
      options,
      answer: validOptionIds.has(proposedAnswer) ? proposedAnswer : '',
      subject: String(question.subject || '').trim().slice(0, 80),
      difficulty: String(question.difficulty || '').trim().slice(0, 30),
      marks: Math.max(0, Number(question.marks) || 1),
      extractionConfidence: question.extractionConfidence || 'Medium',
      sourcePage: Math.max(1, Number(question.sourcePage) || 1),
      sourcePages: [...new Set((question.sourcePages || [question.sourcePage || 1]).map((page) => Math.max(1, Number(page) || 1)))],
      hasVisual: Boolean(question.hasVisual) || visualQuestion({ stem, options }),
      ...(question.questionImage ? { questionImage: question.questionImage } : {}),
    });
    if (rows.length >= maxQuestions) break;
  }
  return rows;
}

async function createOcrWorker(language) {
  const languageData = ocrLanguageData[language] || ocrLanguageData.eng;
  const worker = await createWorker(languageData.code, 1, {
    langPath: languageData.langPath,
    gzip: languageData.gzip,
    cacheMethod: 'none',
    logger: () => {},
  });
  await worker.setParameters({ preserve_interword_spaces: '1' });
  return worker;
}

async function recognizeWithWorker(worker, buffer) {
  const result = await worker.recognize(buffer, {}, { text: true, blocks: true });
  const lines = (result.data?.blocks || []).flatMap((block) => (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || []))
    .map((line) => ({ text: String(line.text || '').trim(), bbox: line.bbox }))
    .filter((line) => line.text && line.bbox);
  return {
    text: String(result.data?.text || ''),
    confidence: Number(result.data?.confidence || 0),
    lines,
  };
}

async function recognizeImage(buffer, language) {
  const worker = await createOcrWorker(language);
  try {
    return await recognizeWithWorker(worker, buffer);
  } finally {
    await worker.terminate();
  }
}

async function sourceImagePreview(buffer, pageNumber) {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const image = await loadImage(buffer);
  const ratio = Math.min(1, maxSourcePreviewWidth / Math.max(1, image.width));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const preview = canvas.toBuffer('image/webp', 72);
  return {
    pageNumber,
    mimeType: 'image/webp',
    dataBase64: preview.toString('base64'),
    width,
    height,
    byteSize: preview.length,
  };
}

function excelCellText(cell) {
  const value = cell?.value ?? cell;
  if (value == null) return '';
  if (typeof value !== 'object') return String(value).trim();
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('').trim();
  if (value.result != null) return String(value.result).trim();
  if (value.text != null) return String(value.text).trim();
  if (value.hyperlink) return String(value.text || value.hyperlink).trim();
  return String(cell?.text || '').trim();
}

function workbookImageBuffer(media) {
  if (Buffer.isBuffer(media?.buffer)) return media.buffer;
  if (media?.buffer) return Buffer.from(media.buffer);
  if (media?.base64) return Buffer.from(String(media.base64).split(',').at(-1), 'base64');
  return null;
}

async function workbookImagesPreview(mediaRows, pageNumber) {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const loaded = [];
  for (const media of mediaRows.slice(0, 6)) {
    const buffer = workbookImageBuffer(media);
    if (!buffer) continue;
    try {
      loaded.push({ image: await loadImage(buffer), buffer });
    } catch {
      // Unsupported workbook media is ignored; text extraction still succeeds.
    }
  }
  if (!loaded.length) return null;
  if (loaded.length === 1) return sourceImagePreview(loaded[0].buffer, pageNumber);
  const cellWidth = 330;
  const cellHeight = 245;
  const columns = Math.min(2, loaded.length);
  const rows = Math.ceil(loaded.length / columns);
  const canvas = createCanvas(columns * cellWidth, rows * cellHeight);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  loaded.forEach(({ image }, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const label = String.fromCharCode(65 + index);
    const availableWidth = cellWidth - 44;
    const availableHeight = cellHeight - 42;
    const ratio = Math.min(availableWidth / image.width, availableHeight / image.height, 1);
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));
    const x = column * cellWidth + 34 + Math.floor((availableWidth - width) / 2);
    const y = row * cellHeight + 30 + Math.floor((availableHeight - height) / 2);
    context.fillStyle = '#17242a';
    context.font = 'bold 18px Arial';
    context.fillText(`(${label})`, column * cellWidth + 8, row * cellHeight + 24);
    context.drawImage(image, x, y, width, height);
  });
  const preview = canvas.toBuffer('image/webp', 82);
  return { pageNumber, mimeType: 'image/webp', dataBase64: preview.toString('base64'), width: canvas.width, height: canvas.height, byteSize: preview.length };
}

function workbookImageRow(range) {
  const row = range?.tl?.nativeRow ?? range?.tl?.row ?? range?.top ?? 0;
  return Math.max(1, Math.floor(Number(row) || 0) + 1);
}

async function extractWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new AuthError(400, 'INVALID_XLSX', 'The Excel workbook could not be opened. Save it as a valid .xlsx file and try again.');
  }
  const questions = [];
  const rawSections = [];
  for (let sheetIndex = 0; sheetIndex < workbook.worksheets.length; sheetIndex += 1) {
    const worksheet = workbook.worksheets[sheetIndex];
    let headerRowNumber = 0;
    let headers = [];
    for (let rowNumber = 1; rowNumber <= Math.min(25, worksheet.rowCount); rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const candidate = Array.from({ length: Math.max(1, worksheet.columnCount) }, (_, column) => normalizedHeader(excelCellText(row.getCell(column + 1))));
      if (candidate.some((header) => ['question', 'stem', 'questiontext', 'text'].includes(header))) {
        headerRowNumber = rowNumber;
        headers = candidate;
        break;
      }
    }
    if (!headerRowNumber) continue;
    const imageAnchors = typeof worksheet.getImages === 'function' ? worksheet.getImages() : [];
    const questionRows = [];
    for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const values = headers.map((_, column) => excelCellText(row.getCell(column + 1)));
      const record = Object.fromEntries(headers.map((header, column) => [header, values[column] || '']));
      const stem = csvValue(record, 'question', 'stem', 'question_text', 'text');
      if (stem) questionRows.push({ rowNumber, record, stem });
      if (values.some(Boolean)) rawSections.push(`${worksheet.name}\t${rowNumber}\t${values.join('\t')}`);
    }
    for (let index = 0; index < questionRows.length; index += 1) {
      const entry = questionRows[index];
      const nextRow = questionRows[index + 1]?.rowNumber || worksheet.rowCount + 2;
      const anchoredMedia = imageAnchors
        .filter((anchor) => {
          const row = workbookImageRow(anchor.range);
          return row >= entry.rowNumber && row < nextRow;
        })
        .map((anchor) => workbook.getImage(anchor.imageId))
        .filter(Boolean);
      let options = ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => ({ id, label: csvValue(entry.record, `option_${id}`, `option${id}`) })).filter((option) => option.label);
      if (!options.length && anchoredMedia.length >= 2) {
        options = anchoredMedia.slice(0, 6).map((_, optionIndex) => ({ id: String.fromCharCode(65 + optionIndex), label: `Visual option ${String.fromCharCode(65 + optionIndex)}`, isVisual: true }));
      }
      const answer = normalizedOptionId(csvValue(entry.record, 'answer', 'correct_option', 'correctanswer').replace(/[^A-F1-6कखगघఅఆఇఈ]/gi, '').slice(0, 1));
      const questionImage = anchoredMedia.length ? await workbookImagesPreview(anchoredMedia, sheetIndex + 1) : null;
      if (questionImage) questionImage.cropConfidence = 'Exact';
      questions.push({
        number: Number(csvValue(entry.record, 'number', 'question_number')) || questions.length + 1,
        stem: entry.stem,
        options,
        answer,
        subject: csvValue(entry.record, 'subject', 'section'),
        difficulty: csvValue(entry.record, 'difficulty', 'level'),
        marks: Math.max(0, Number(csvValue(entry.record, 'marks', 'mark')) || 1),
        extractionConfidence: 'High',
        sourcePage: sheetIndex + 1,
        sourcePages: [sheetIndex + 1],
        hasVisual: Boolean(questionImage),
        ...(questionImage ? { questionImage } : {}),
      });
    }
  }
  return {
    rawText: rawSections.join('\n'),
    questions: finalizeQuestions(questions),
    sourcePages: [],
    extractionMethod: 'Excel workbook',
    totalPages: workbook.worksheets.length,
    ocrConfidence: null,
  };
}

function sourceSequenceWarnings(questions) {
  const numbers = [...new Set(questions.map((question) => Number(question.sourceNumber)).filter((number) => Number.isInteger(number) && number > 0))].sort((a, b) => a - b);
  if (numbers.length < 2 || numbers[0] > 2 || numbers.at(-1) > numbers.length + 20) return [];
  const available = new Set(numbers);
  const missing = [];
  for (let number = numbers[0]; number <= numbers.at(-1); number += 1) {
    if (!available.has(number)) missing.push(number);
  }
  if (!missing.length) return [];
  const shown = missing.slice(0, 12).join(', ');
  return [`Possible missing source question number${missing.length === 1 ? '' : 's'}: ${shown}${missing.length > 12 ? ', …' : ''}. Check the source-page previews.`];
}

function detectedQuestionStart(text) {
  for (const line of logicalLines(text)) {
    const detected = questionStart(line);
    if (detected) return detected;
  }
  return null;
}

function pdfQuestionStarts(items, pageHeight) {
  const groups = [];
  const sorted = (items || []).filter((item) => String(item.str || '').trim()).sort((left, right) => right.y - left.y || left.x - right.x);
  for (const item of sorted) {
    const group = groups.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(3, item.height * 0.45));
    if (group) {
      group.items.push(item);
      group.y = Math.max(group.y, item.y);
    } else {
      groups.push({ y: item.y, items: [item] });
    }
  }
  return groups.map((group) => {
    const lineItems = group.items.sort((left, right) => left.x - right.x);
    const text = lineItems.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
    const top = Math.min(...lineItems.map((item) => pageHeight - item.y - item.height));
    return { detected: detectedQuestionStart(text), text, topRatio: Math.max(0, Math.min(1, top / pageHeight)) };
  }).filter((line) => line.detected).sort((left, right) => left.topRatio - right.topRatio);
}

function ocrQuestionStarts(lines, imageHeight) {
  return (lines || []).map((line) => ({
    detected: detectedQuestionStart(line.text),
    text: line.text,
    topRatio: Math.max(0, Math.min(1, Number(line.bbox?.y0 || 0) / Math.max(1, imageHeight))),
  })).filter((line) => line.detected).sort((left, right) => left.topRatio - right.topRatio);
}

function visualQuestion(question) {
  return (question.options || []).some((option) => option.isVisual)
    || /\b(?:figure|diagram|visual|image|shape|mirror|paper\s*fold|pattern|चित्र|आकृति|బొమ్మ|ఆకృతి)\b/i.test(question.stem || '');
}

async function attachQuestionRegionImages(questions, pageImages, pageStarts) {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  let totalBytes = 0;
  let omitted = 0;
  let estimated = 0;
  const byPage = new Map();
  for (const question of questions) {
    const pageNumber = Math.max(1, Number(question.sourcePage) || 1);
    if (!byPage.has(pageNumber)) byPage.set(pageNumber, []);
    byPage.get(pageNumber).push(question);
  }
  for (const [pageNumber, pageQuestions] of byPage) {
    const pageBuffer = pageImages.get(pageNumber);
    if (!pageBuffer) {
      omitted += pageQuestions.length;
      continue;
    }
    const image = await loadImage(pageBuffer);
    const starts = pageStarts.get(pageNumber) || [];
    const matchedStarts = [];
    let cursor = 0;
    for (let index = 0; index < pageQuestions.length; index += 1) {
      const sourceNumber = Number(pageQuestions[index].sourceNumber);
      let matchIndex = starts.findIndex((start, candidateIndex) => candidateIndex >= cursor && Number(start.detected?.number) === sourceNumber);
      if (matchIndex < 0) matchIndex = cursor < starts.length ? cursor : -1;
      matchedStarts.push(matchIndex >= 0 ? starts[matchIndex] : null);
      if (matchIndex >= 0) cursor = matchIndex + 1;
    }
    for (let index = 0; index < pageQuestions.length; index += 1) {
      const question = pageQuestions[index];
      const startRatio = matchedStarts[index]?.topRatio ?? (index / pageQuestions.length);
      const nextRatio = matchedStarts[index + 1]?.topRatio ?? ((index + 1) / pageQuestions.length);
      const top = Math.max(0, Math.floor(image.height * startRatio) - 18);
      const estimatedBottom = index === pageQuestions.length - 1 ? image.height - 8 : Math.floor(image.height * nextRatio) - 10;
      const bottom = Math.min(image.height, Math.max(top + 120, estimatedBottom));
      const horizontalMargin = Math.min(18, Math.floor(image.width * 0.015));
      const width = Math.max(1, image.width - horizontalMargin * 2);
      const height = Math.max(1, bottom - top);
      const canvas = createCanvas(width, height);
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, horizontalMargin, top, width, height, 0, 0, width, height);
      const crop = canvas.toBuffer('image/webp', 80);
      if (totalBytes + crop.length > maxQuestionImageBytes) {
        omitted += 1;
        continue;
      }
      totalBytes += crop.length;
      const cropConfidence = matchedStarts[index] ? 'Exact' : 'Estimated';
      if (cropConfidence === 'Estimated') estimated += 1;
      question.hasVisual = visualQuestion(question);
      question.questionImage = {
        pageNumber,
        mimeType: 'image/webp',
        dataBase64: crop.toString('base64'),
        width,
        height,
        cropConfidence,
      };
    }
  }
  return { omitted, estimated };
}

async function pdfSourcePreviews(pdf, pageNumbers, renderedPages) {
  const previews = [];
  let totalBytes = 0;
  let omitted = 0;
  for (const pageNumber of [...new Set(pageNumbers)].sort((a, b) => a - b)) {
    const rendered = renderedPages.get(pageNumber) || Buffer.from(await renderPageAsImage(pdf, pageNumber, {
      canvasImport: () => import('@napi-rs/canvas'),
      scale: 1.25,
    }));
    const preview = await sourceImagePreview(rendered, pageNumber);
    if (previews.length && totalBytes + preview.byteSize > maxSourcePreviewBytes) {
      omitted += 1;
      continue;
    }
    totalBytes += preview.byteSize;
    previews.push(preview);
  }
  return { previews, omitted };
}

function pageExtractionScore(text, pageNumber) {
  const questions = questionsFromExtractedPages([{ pageNumber, text }], 'Medium');
  const numbers = [...new Set(questions.map((question) => Number(question.number)).filter(Number.isFinite))].sort((a, b) => a - b);
  let gaps = 0;
  for (let index = 1; index < numbers.length; index += 1) gaps += Math.max(0, numbers[index] - numbers[index - 1] - 1);
  const optionCount = questions.reduce((sum, question) => sum + question.options.length, 0);
  return {
    questionCount: questions.length,
    gaps,
    score: questions.length * 25 + optionCount * 4 - gaps * 15 + Math.min(10, String(text || '').replace(/\s/g, '').length / 100),
  };
}

async function extractPdf(buffer, language, extractionMode) {
  await ensurePdfModule();
  const pdf = await getDocumentProxy(new Uint8Array(buffer), { disableFontFace: false });
  if (pdf.numPages > maxPdfPages) throw new AuthError(413, 'PDF_TOO_LONG', `Upload a PDF with no more than ${maxPdfPages} pages.`);
  const [textResult, textItemsResult] = await Promise.all([
    extractText(pdf, { mergePages: false }),
    extractTextItems(pdf),
  ]);
  const digitalPages = Array.isArray(textResult.text) ? textResult.text : [String(textResult.text || '')];
  const pageTexts = [];
  const renderedPages = new Map();
  const pageStarts = new Map();
  const ocrPages = [];
  let confidenceTotal = 0;
  let worker = null;
  try {
    for (let pageNumber = 1; pageNumber <= textResult.totalPages; pageNumber += 1) {
      const digitalText = String(digitalPages[pageNumber - 1] || '').trim();
      const pageProxy = await pdf.getPage(pageNumber);
      const pageViewport = pageProxy.getViewport({ scale: 1 });
      const digitalStarts = pdfQuestionStarts(textItemsResult.items?.[pageNumber - 1], pageViewport.height);
      const digitalQuality = pageExtractionScore(digitalText, pageNumber);
      const needsOcr = extractionMode === 'accurate' || digitalText.replace(/\s/g, '').length < 40 || digitalQuality.questionCount === 0 || digitalQuality.gaps > 0;
      let selectedText = digitalText;
      let selectedConfidence = 'Medium';
      let selectedStarts = digitalStarts;
      if (needsOcr && pageNumber <= maxScannedPdfPages) {
        const rendered = Buffer.from(await renderPageAsImage(pdf, pageNumber, { canvasImport: () => import('@napi-rs/canvas'), scale: 1.8 }));
        renderedPages.set(pageNumber, rendered);
        worker ||= await createOcrWorker(language);
        const recognized = await recognizeWithWorker(worker, rendered);
        const ocrQuality = pageExtractionScore(recognized.text, pageNumber);
        if (ocrQuality.score > digitalQuality.score || recognized.text.replace(/\s/g, '').length > digitalText.replace(/\s/g, '').length * 1.25) {
          selectedText = recognized.text;
          selectedConfidence = 'Low';
          ocrPages.push(pageNumber);
          confidenceTotal += recognized.confidence;
          selectedStarts = ocrQuestionStarts(recognized.lines, pageViewport.height * 1.8);
        }
      }
      pageTexts.push({ pageNumber, text: selectedText, confidence: selectedConfidence });
      pageStarts.set(pageNumber, selectedStarts);
    }
  } finally {
    if (worker) await worker.terminate();
  }
  const questions = finalizeQuestions(questionsFromExtractedPages(pageTexts, 'Medium'));
  const relevantPages = questions.flatMap((question) => question.sourcePages || [question.sourcePage]);
  for (const pageNumber of [...new Set(relevantPages)]) {
    if (!renderedPages.has(pageNumber)) {
      renderedPages.set(pageNumber, Buffer.from(await renderPageAsImage(pdf, pageNumber, { canvasImport: () => import('@napi-rs/canvas'), scale: 1.8 })));
    }
  }
  const questionImageResult = await attachQuestionRegionImages(questions, renderedPages, pageStarts);
  const sourcePreviewResult = await pdfSourcePreviews(pdf, relevantPages, renderedPages);
  const rawText = pageTexts.map((page) => `--- Page ${page.pageNumber} ---\n${page.text}`).join('\n\n').trim();
  const extractionMethod = !ocrPages.length ? 'PDF text' : ocrPages.length === textResult.totalPages ? 'Scanned PDF OCR' : 'PDF text + OCR';
  return {
    rawText,
    questions,
    sourcePages: sourcePreviewResult.previews,
    sourcePreviewOmitted: sourcePreviewResult.omitted,
    questionImageOmitted: questionImageResult.omitted,
    questionImageEstimated: questionImageResult.estimated,
    extractionMethod,
    totalPages: textResult.totalPages,
    ocrConfidence: ocrPages.length ? Number((confidenceTotal / ocrPages.length).toFixed(1)) : null,
  };
}

export async function extractUploadedTest(file, ocrLanguage = 'eng', extractionMode = 'accurate') {
  const language = allowedOcrLanguages.has(ocrLanguage) ? ocrLanguage : 'eng';
  let extraction;
  if (file.mimeType === 'text/csv') {
    const rawText = file.buffer.toString('utf8');
    extraction = { rawText, questions: finalizeQuestions(questionsFromCsv(rawText)), sourcePages: [], extractionMethod: 'Structured CSV', totalPages: null, ocrConfidence: null };
  } else if (file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    extraction = await extractWorkbook(file.buffer);
  } else if (file.mimeType === 'application/pdf') {
    extraction = await extractPdf(file.buffer, language, extractionMode === 'fast' ? 'fast' : 'accurate');
  } else {
    const recognized = await recognizeImage(file.buffer, language);
    const sourcePreview = await sourceImagePreview(file.buffer, 1);
    const questions = finalizeQuestions(questionsFromExtractedPages([{ pageNumber: 1, text: recognized.text, confidence: 'Low' }], 'Low'));
    const { loadImage } = await import('@napi-rs/canvas');
    const originalImage = await loadImage(file.buffer);
    const questionImageResult = await attachQuestionRegionImages(
      questions,
      new Map([[1, file.buffer]]),
      new Map([[1, ocrQuestionStarts(recognized.lines, originalImage.height)]]),
    );
    extraction = {
      rawText: recognized.text,
      questions,
      sourcePages: [sourcePreview],
      questionImageOmitted: questionImageResult.omitted,
      questionImageEstimated: questionImageResult.estimated,
      extractionMethod: 'Image OCR',
      totalPages: 1,
      ocrConfidence: Number(recognized.confidence.toFixed(1)),
    };
  }
  if (!extraction.rawText.trim()) throw new AuthError(422, 'NO_TEXT_FOUND', 'No readable text was found. Try a clearer scan or choose the correct OCR language.');
  if (!extraction.questions.length) throw new AuthError(422, 'NO_QUESTIONS_FOUND', 'Text was found, but no question blocks could be identified. Number questions as 1., 2., 3. for best results.');
  const withoutOptions = extraction.questions.filter((question) => question.options.length < 2).length;
  const withoutAnswers = extraction.questions.filter((question) => !question.answer).length;
  return {
    ...extraction,
    rawText: extraction.rawText.slice(0, maxRawTextLength),
    warnings: [
      ...(extraction.warnings || []),
      ...(withoutOptions ? [`${withoutOptions} question${withoutOptions === 1 ? '' : 's'} need option review.`] : []),
      ...(withoutAnswers ? [`${withoutAnswers} question${withoutAnswers === 1 ? '' : 's'} do not include a detected answer.`] : []),
      ...sourceSequenceWarnings(extraction.questions),
      ...(extraction.sourcePreviewOmitted ? [`${extraction.sourcePreviewOmitted} source-page preview${extraction.sourcePreviewOmitted === 1 ? '' : 's'} could not be embedded because of the preview-size limit; their questions were still extracted.`] : []),
      ...(extraction.questionImageOmitted ? [`${extraction.questionImageOmitted} question image${extraction.questionImageOmitted === 1 ? '' : 's'} could not be embedded because of the image-size limit. Review the retained source page.`] : []),
      ...(extraction.questionImageEstimated ? [`${extraction.questionImageEstimated} question crop${extraction.questionImageEstimated === 1 ? '' : 's'} used estimated boundaries. Compare with the retained source page before publishing.`] : []),
    ],
  };
}

async function staffContext(request) {
  const user = await sessionUser(request);
  if (!user) throw new AuthError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to import test papers.');
  if (!['administrator', 'principal', 'teacher'].includes(user.role)) throw new AuthError(403, 'STAFF_ACCESS_REQUIRED', 'Only institute staff can import test papers.');
  return { user, instituteId: instituteIdForUser(user), ownerId: objectId(user.id, 'account identifier') };
}

function instituteFilter(instituteId) {
  return { $or: [{ instituteId }, { instituteId: { $exists: false } }] };
}

async function collections() {
  const db = await getTestingDatabase();
  if (!indexPromise) {
    indexPromise = Promise.all([
      db.collection(VIJETHA_COLLECTIONS.testImports).createIndex({ instituteId: 1, course: 1, createdAt: -1 }),
      db.collection(VIJETHA_COLLECTIONS.testImports).createIndex({ instituteId: 1, sourceHash: 1 }, { unique: true }),
    ]).catch((error) => { indexPromise = null; throw error; });
  }
  await indexPromise;
  return { db, imports: db.collection(VIJETHA_COLLECTIONS.testImports) };
}

function publicImport(document, includeContent = false) {
  return {
    id: String(document._id),
    course: document.course,
    title: document.title,
    fileName: document.fileName,
    mimeType: document.mimeType,
    size: document.size,
    extractionMethod: document.extractionMethod,
    extractionMode: document.extractionMode || 'accurate',
    ocrLanguage: document.ocrLanguage,
    ocrConfidence: document.ocrConfidence,
    totalPages: document.totalPages,
    questionCount: document.questionCount,
    warnings: document.warnings || [],
    status: document.status,
    createdByName: document.createdByName,
    createdAt: document.createdAt?.toISOString?.() || null,
    ...(includeContent ? { rawText: document.rawText, questions: document.questions || [], sourcePages: document.sourcePages || [] } : {}),
  };
}

export async function listTestImports(request, query = {}) {
  const { instituteId } = await staffContext(request);
  const course = normalizeCourse(query.course);
  const { imports } = await collections();
  if (query.id) {
    const row = await imports.findOne({ _id: objectId(query.id, 'test import identifier'), course, ...instituteFilter(instituteId) });
    if (!row) throw new AuthError(404, 'TEST_IMPORT_NOT_FOUND', 'The imported test was not found.');
    return [publicImport(row, true)];
  }
  const rows = await imports.find({ course, ...instituteFilter(instituteId) }).sort({ createdAt: -1 }).limit(150).toArray();
  return rows.map((row) => publicImport(row));
}

function normalizeTestImportInput(input = {}) {
  const course = normalizeCourse(input.course);
  const language = allowedOcrLanguages.has(input.ocrLanguage) ? input.ocrLanguage : 'eng';
  const extractionMode = input.extractionMode === 'fast' ? 'fast' : 'accurate';
  const file = decodeTestImportFile(input.file || {});
  const title = cleanText(input.title || file.filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), { min: 3, max: 120 });
  const sourceHash = createHash('sha256').update(file.buffer).digest('hex');
  return { course, language, extractionMode, file, title, sourceHash };
}

async function extractNormalizedTestImport(normalized) {
  let extracted;
  try {
    extracted = await extractUploadedTest(normalized.file, normalized.language, normalized.extractionMode);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    console.error('Test import extraction failed:', error?.name || 'Error', error?.message || 'unknown');
    throw new AuthError(422, 'EXTRACTION_FAILED', 'The file could not be extracted. Try a clearer or smaller document.');
  }
  return extracted;
}

export async function previewTestImport(input = {}) {
  const normalized = normalizeTestImportInput(input);
  const extracted = await extractNormalizedTestImport(normalized);
  const { course, language, extractionMode, file, title, sourceHash } = normalized;
  const now = new Date();
  const document = {
    _id: `preview-${sourceHash.slice(0, 16)}`,
    course,
    title,
    fileName: file.filename,
    mimeType: file.mimeType,
    size: file.size,
    ocrLanguage: language,
    extractionMode,
    extractionMethod: extracted.extractionMethod,
    ocrConfidence: extracted.ocrConfidence,
    totalPages: extracted.totalPages,
    rawText: extracted.rawText,
    questions: extracted.questions,
    sourcePages: extracted.sourcePages || [],
    questionCount: extracted.questions.length,
    warnings: extracted.warnings,
    status: extracted.warnings.length ? 'review' : 'ready',
    createdByName: 'Demo preview',
    createdAt: now,
  };
  return { ...publicImport(document, true), persisted: false };
}

export async function createTestImport(request, input = {}) {
  const { user, instituteId, ownerId } = await staffContext(request);
  const normalized = normalizeTestImportInput(input);
  const { course, language, extractionMode, file, title, sourceHash } = normalized;
  const { db, imports } = await collections();
  const policies = await loadInstitutePolicies(db, instituteId);
  if (user.role === 'teacher' && !policies.teacherCanUploadQuestions) throw new AuthError(403, 'TEACHER_UPLOAD_DISABLED', 'The principal has disabled teacher question uploads.');
  const existing = await imports.findOne({ sourceHash, ...instituteFilter(instituteId) }, { projection: { _id: 1, createdAt: 1 } });
  const extracted = await extractNormalizedTestImport(normalized);
  const now = new Date();
  const document = {
    instituteId,
    ownerId,
    course,
    title,
    fileName: file.filename,
    mimeType: file.mimeType,
    size: file.size,
    sourceHash,
    ocrLanguage: language,
    extractionMode,
    extractionMethod: extracted.extractionMethod,
    ocrConfidence: extracted.ocrConfidence,
    totalPages: extracted.totalPages,
    rawText: extracted.rawText,
    questions: extracted.questions,
    sourcePages: extracted.sourcePages || [],
    questionCount: extracted.questions.length,
    warnings: extracted.warnings,
    status: extracted.warnings.length ? 'review' : 'ready',
    createdById: ownerId,
    createdByName: user.name,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (existing) {
    await imports.updateOne({ _id: existing._id }, { $set: document });
    return { ...publicImport({ ...document, _id: existing._id }, true), reprocessed: true };
  }
  try {
    const result = await imports.insertOne(document);
    return publicImport({ ...document, _id: result.insertedId }, true);
  } catch (error) {
    if (error?.code === 11000) throw new AuthError(409, 'DUPLICATE_TEST_IMPORT', 'This exact file has already been imported for the institute.');
    throw error;
  }
}

export async function deleteTestImport(request, id) {
  const { user, instituteId } = await staffContext(request);
  if (!['administrator', 'principal'].includes(user.role)) throw new AuthError(403, 'PRINCIPAL_REQUIRED', 'Only the principal can delete imported tests.');
  const { imports } = await collections();
  const result = await imports.deleteOne({ _id: objectId(id, 'test import identifier'), ...instituteFilter(instituteId) });
  if (!result.deletedCount) throw new AuthError(404, 'TEST_IMPORT_NOT_FOUND', 'The imported test was not found.');
}

export const testImportLimits = {
  maxFileBytes,
  maxQuestions,
  maxRawTextLength,
  maxPdfPages,
  maxScannedPdfPages,
  allowedMimeTypes: [...allowedMimeTypes],
  allowedOcrLanguages: [...allowedOcrLanguages],
};
