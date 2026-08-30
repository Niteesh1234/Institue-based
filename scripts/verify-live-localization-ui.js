import { writeFile } from 'node:fs/promises';

const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9231';
const targetUrl = process.argv[2] || 'https://vijetha-jnvst-testing.vercel.app';

const target = await fetch(`${endpoint}/json/new?${encodeURIComponent(targetUrl)}`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const exceptions = [];
let id = 0;

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails?.text || 'Runtime exception');
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const messageId = ++id;
  pending.set(messageId, { resolve, reject });
  socket.send(JSON.stringify({ id: messageId, method, params }));
});
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const clickButton = (pattern) => evaluate(`(() => {
  const button = Array.from(document.querySelectorAll('button')).find((item) => new RegExp(${JSON.stringify(pattern)}, 'i').test(item.innerText));
  if (!button) return false;
  button.click();
  return true;
})()`);

await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
await send('Page.navigate', { url: targetUrl });
await wait(800);
await evaluate(`localStorage.setItem('vijetha-language', 'en'); location.reload(); true`);
await wait(2500);
const openedLogin = await clickButton('Institute login|Open secure workspace');
await wait(500);
const openedDemo = await clickButton('continue to demo|demo');
await wait(5500);
const openedMockTests = await clickButton('Mock Tests');
await wait(1200);
const openedFirstTest = await clickButton('Start first test');
await wait(6500);
async function selectLocale(locale) {
  return evaluate(`(() => {
    const select = document.querySelector('.runner-language-selector select');
    if (!select) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(select, ${JSON.stringify(locale)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function openFourthQuestion() {
  return evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('.question-palette button')).find((item) => item.textContent.trim() === '4');
    if (!button) return false;
    button.click();
    return true;
  })()`);
}

async function openQuestion(number) {
  return evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('.question-palette button')).find((item) => item.textContent.trim() === ${JSON.stringify(String(number))});
    if (!button) return false;
    button.click();
    return true;
  })()`);
}

async function runnerState() {
  return evaluate(`(() => {
    const card = document.querySelector('.runner-question-card');
    const values = {
      heading: document.querySelector('.runner-heading h2')?.innerText.trim() || '',
      skill: document.querySelector('.runner-syllabus-tag')?.innerText.trim() || '',
      stem: card?.querySelector('h1')?.innerText.trim() || '',
      options: Array.from(document.querySelectorAll('.runner-options button')).map((button) => button.innerText.trim()),
      overlay: Boolean(document.querySelector('.vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]')),
    };
    values.combined = [values.heading, values.skill, values.stem, ...values.options].join(' ');
    return values;
  })()`);
}

const forbidden = /\b(on|pattern|card|both|the|and|internal|marks|follow|rule|which|figure|comes|next|correct|incorrect|outline|rotation|count)\b/i;

await selectLocale('te');
await wait(500);
const openedFourthQuestionTelugu = await openFourthQuestion();
await wait(300);
const telugu = await runnerState();
await selectLocale('hi');
await wait(500);
const openedFourthQuestionHindi = await openFourthQuestion();
await wait(300);
const hindi = await runnerState();

const closedJnvstRunner = await evaluate(`(() => { const button = document.querySelector('.runner-close'); if (!button) return false; button.click(); return true; })()`);
await wait(400);
const selectedRms = await evaluate(`(() => {
  const button = Array.from(document.querySelectorAll('.course-tabs button')).find((item) => /RMS CET/i.test(item.innerText));
  if (!button) return false;
  button.click();
  return true;
})()`);
await wait(6500);
const openedRmsLibrary = await evaluate(`(() => {
  const button = Array.from(document.querySelectorAll('button')).find((item) => /Open test library/i.test(item.innerText));
  if (!button) return false;
  button.click();
  return true;
})()`);
await wait(600);
const filteredChallenging = await evaluate(`(() => {
  const select = document.querySelector('.catalog-toolbar select');
  if (!select) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(select, 'Challenging');
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
await wait(400);
const openedRmsChallengingFour = await evaluate(`(() => {
  const tests = Array.from(document.querySelectorAll('.test-grid .test-tile'));
  if (!tests[3]) return false;
  tests[3].click();
  return true;
})()`);
await wait(7000);
await selectLocale('te');
await wait(500);
const openedRmsQuestionTelugu = await openQuestion(47);
await wait(300);
const rmsTelugu = await runnerState();
await selectLocale('hi');
await wait(500);
const openedRmsQuestionHindi = await openQuestion(47);
await wait(300);
const rmsHindi = await runnerState();
const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const screenshotPath = '/tmp/vijetha-rms-question-47-hindi.png';
await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));

const report = {
  navigation: { openedLogin, openedDemo, openedMockTests, openedFirstTest },
  pageExcerpt: await evaluate(`document.body.innerText.slice(0, 1200)`),
  telugu,
  hindi,
  rmsQuestion47: { telugu: rmsTelugu, hindi: rmsHindi },
  screenshotPath,
  rmsNavigation: { closedJnvstRunner, selectedRms, openedRmsLibrary, filteredChallenging, openedRmsChallengingFour, openedRmsQuestionTelugu, openedRmsQuestionHindi },
  openedFourthQuestion: openedFourthQuestionTelugu && openedFourthQuestionHindi,
  exceptions,
  passed: openedFourthQuestionTelugu
    && openedFourthQuestionHindi
    && /[\u0C00-\u0C7F]/.test(telugu.combined)
    && /[\u0900-\u097F]/.test(hindi.combined)
    && !forbidden.test(telugu.combined)
    && !forbidden.test(hindi.combined)
    && telugu.options.length === 4
    && hindi.options.length === 4
    && !telugu.overlay
    && !hindi.overlay
    && Object.values({ closedJnvstRunner, selectedRms, openedRmsLibrary, filteredChallenging, openedRmsChallengingFour, openedRmsQuestionTelugu, openedRmsQuestionHindi }).every(Boolean)
    && /[\u0C00-\u0C7F]/.test(rmsTelugu.combined)
    && /[\u0900-\u097F]/.test(rmsHindi.combined)
    && !/\b(which|word|pronoun|said|will|visit|workshop)\b/i.test(rmsTelugu.combined)
    && !/\b(which|word|pronoun|said|will|visit|workshop)\b/i.test(rmsHindi.combined)
    && rmsTelugu.options.length === 4
    && rmsHindi.options.length === 4
    && !rmsTelugu.overlay
    && !rmsHindi.overlay
    && exceptions.length === 0,
};

console.log(JSON.stringify(report, null, 2));
socket.close();
if (!report.passed) process.exitCode = 1;
