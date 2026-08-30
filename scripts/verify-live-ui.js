const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9231';
const targetUrl = process.argv[2] || 'https://vijetha-jnvst-testing.vercel.app';

const target = await fetch(`${endpoint}/json/new?${encodeURIComponent(targetUrl)}`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const exceptions = [];
const failedRequests = [];
const responses = [];
let id = 0;

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails?.text || 'Runtime exception');
  if (message.method === 'Network.loadingFailed') failedRequests.push(message.params.errorText);
  if (message.method === 'Network.responseReceived') responses.push({ url: message.params.response.url, status: message.params.response.status });
});

function send(method, params = {}) {
  const messageId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
}

await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
await send('Page.navigate', { url: targetUrl });
await new Promise((resolve) => setTimeout(resolve, 1000));
await evaluate(`localStorage.setItem('vijetha-language', 'en'); location.reload(); true`);
await new Promise((resolve) => setTimeout(resolve, 6000));

const landing = await evaluate(`({
  title: document.title,
  textLength: document.body.innerText.trim().length,
  hasBrand: /vijetha/i.test(document.body.innerText),
  overlay: Boolean(document.querySelector('.vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]')),
  buttons: Array.from(document.querySelectorAll('button')).map((button) => button.innerText.trim()).filter(Boolean).slice(0, 20)
})`);

await evaluate(`(() => {
  const button = Array.from(document.querySelectorAll('button')).find((item) => /institute login|login/i.test(item.innerText));
  if (button) { button.click(); return true; }
  return false;
})()`);
await new Promise((resolve) => setTimeout(resolve, 800));
await evaluate(`(() => {
  const button = Array.from(document.querySelectorAll('button')).find((item) => /continue to demo|demo/i.test(item.innerText));
  if (button) { button.click(); return true; }
  return false;
})()`);
await new Promise((resolve) => setTimeout(resolve, 7000));

const desktop = await evaluate(`({
  textLength: document.body.innerText.trim().length,
  dashboard: /dashboard/i.test(document.body.innerText),
  tests: /mock tests/i.test(document.body.innerText),
  courses: ['JNVST', 'AISSEE', 'RMS CET'].filter((name) => document.body.innerText.includes(name)),
  loading: /Loading the .*database|Connecting to/i.test(document.body.innerText),
  overlay: Boolean(document.querySelector('.vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]')),
  horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2
})`);

await evaluate(`(() => {
  const button = Array.from(document.querySelectorAll('button')).find((item) => /mock tests/i.test(item.innerText));
  if (button) { button.click(); return true; }
  return false;
})()`);
await new Promise((resolve) => setTimeout(resolve, 1800));
const mockTests = await evaluate(`({
  hasThirty: /JNVST mock tests/i.test(document.body.innerText) && /10 full tests/i.test(document.body.innerText),
  hasDifficulty: ['EASY', 'MEDIUM', 'CHALLENGING'].every((level) =>
    Array.from(document.querySelectorAll('.mock-group')).some((group) => group.innerText.includes(level) && /10 full tests/i.test(group.innerText))
  ),
  databaseSource: /coach-exam\.jnvst_questions_Vijetha/i.test(document.body.innerText),
  loading: /Loading the .*database|Connecting to/i.test(document.body.innerText),
  overlay: Boolean(document.querySelector('.vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]'))
})`);

await evaluate(`(() => {
  const button = Array.from(document.querySelectorAll('.course-tabs button')).find((item) => /AISSEE/i.test(item.innerText));
  if (button) { button.click(); return true; }
  return false;
})()`);
await new Promise((resolve) => setTimeout(resolve, 6500));
const courseSwitch = await evaluate(`({
  aissee: /AISSEE/i.test(document.body.innerText),
  hasThirty: /AISSEE mock tests/i.test(document.body.innerText) && /10 full tests/i.test(document.body.innerText),
  databaseSource: /coach-exam\.sainik_questions_Vijetha/i.test(document.body.innerText),
  loading: /Loading the .*database|Connecting to/i.test(document.body.innerText),
  overlay: Boolean(document.querySelector('.vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]'))
})`);

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await new Promise((resolve) => setTimeout(resolve, 800));
const mobile = await evaluate(`({
  width: window.innerWidth,
  textLength: document.body.innerText.trim().length,
  horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
  overlay: Boolean(document.querySelector('.vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]'))
})`);

const apiResponses = responses.filter(({ url }) => url.includes('/api/'));
const requiredDatabaseCalls = apiResponses.filter(({ url, status }) => status === 200 && url.includes('/api/full-test-catalog'));
const audit = {
  landing,
  desktop,
  mockTests,
  courseSwitch,
  mobile,
  apiResponses,
  exceptions,
  failedRequests,
  passed: landing.textLength > 100
    && landing.hasBrand
    && !landing.overlay
    && desktop.dashboard
    && desktop.tests
    && desktop.courses.length === 3
    && !desktop.loading
    && !desktop.overlay
    && mockTests.hasThirty
    && mockTests.hasDifficulty
    && mockTests.databaseSource
    && !mockTests.loading
    && !mockTests.overlay
    && courseSwitch.aissee
    && courseSwitch.hasThirty
    && courseSwitch.databaseSource
    && !courseSwitch.loading
    && !courseSwitch.overlay
    && mobile.textLength > 100
    && !mobile.overlay
    && !mobile.horizontalOverflow
    && requiredDatabaseCalls.length >= 4
    && exceptions.length === 0,
};

console.log(JSON.stringify(audit, null, 2));
socket.close();
if (!audit.passed) process.exitCode = 1;
