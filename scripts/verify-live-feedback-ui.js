const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9231';
const targetUrl = process.argv[2] || 'https://vijetha-jnvst-testing.vercel.app';
const target = await fetch(`${endpoint}/json/new?${encodeURIComponent(targetUrl)}`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const exceptions = [];
let id = 0;
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); }
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails?.text || 'Runtime exception');
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const messageId = ++id; pending.set(messageId, { resolve, reject }); socket.send(JSON.stringify({ id: messageId, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
const click = (pattern) => evaluate(`(() => { const item = Array.from(document.querySelectorAll('button')).find((node) => new RegExp(${JSON.stringify(pattern)}, 'i').test(node.innerText)); if (!item) return false; item.click(); return true; })()`);
const navigate = (label) => evaluate(`(() => { const item = Array.from(document.querySelectorAll('.nav-item')).find((node) => node.innerText.trim().replace(/\\s+/g,' ') === ${JSON.stringify(label)} || node.innerText.trim().replace(/\\s+/g,' ').startsWith(${JSON.stringify(`${label} `)})); if (!item) return false; item.click(); return true; })()`);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await Promise.all([send('Page.enable'), send('Runtime.enable')]);
await send('Page.navigate', { url: targetUrl });
await wait(2500);
await click('Institute login|Open secure workspace');
await wait(500);
await click('continue to demo|demo');
await wait(4500);

await navigate('Students');
await wait(400);
await click('Add student');
await wait(250);
const addFormOpened = await evaluate(`Boolean(document.querySelector('.student-form-panel'))`);
await evaluate(`(() => { const inputs = document.querySelectorAll('.student-form input'); const set = (input,value) => { const previous=input.value; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,value); input._valueTracker?.setValue(previous); input.dispatchEvent(new Event('input',{bubbles:true})); }; if (inputs.length < 4) return false; set(inputs[0],'Load Test Student'); set(inputs[3],'Verification Guardian'); return true; })()`);
await evaluate(`document.querySelector('.student-form button[type=submit]')?.click()`);
await wait(400);
const studentAdded = await evaluate(`document.body.innerText.includes('Load Test Student')`);
const studentDiagnostic = await evaluate(`({ value: document.querySelector('.student-form input')?.value || '', formOpen: Boolean(document.querySelector('.student-form')), alert: document.querySelector('.student-form .auth-alert')?.innerText || '', studentsText: document.querySelector('.student-table')?.innerText.slice(-300) || '' })`);

const principalNavigated = await navigate('Principal Control');
await wait(350);
const principalControl = await evaluate(`({ principalOnly: document.body.innerText.includes('Printing and downloads: Principal only'), batchRule: document.body.innerText.includes('20 / 20 / 20'), maxTwelve: document.body.innerText.includes('/ 12'), approvalArea: document.body.innerText.includes('Approved teachers') })`);
const batchNavigated = await navigate('Batch Exams');
await wait(350);
const batchModule = await evaluate(`({ title: document.body.innerText.includes('20 / 20 / 20 batch exams'), finalSubmitCopy: document.body.innerText.includes('Answers remain hidden until final submission'), builder: document.body.innerText.includes('Generate and assign') })`);
const resourcesNavigated = await navigate('Notes & Tests');
await wait(1000);
const resourcesModule = await evaluate(`({ title: document.body.innerText.includes('Notes & test papers'), upload: document.body.innerText.includes('Upload resource') })`);
const pageText = await evaluate(`document.querySelector('.page-wrap')?.innerText.slice(0,300) || ''`);
const report = { addFormOpened, studentAdded, studentDiagnostic, principalNavigated, batchNavigated, resourcesNavigated, principalControl, batchModule, resourcesModule, pageText, exceptions, passed: addFormOpened && studentAdded && principalNavigated && batchNavigated && resourcesNavigated && Object.values(principalControl).every(Boolean) && Object.values(batchModule).every(Boolean) && Object.values(resourcesModule).every(Boolean) && !exceptions.length };
console.log(JSON.stringify(report, null, 2));
socket.close();
if (!report.passed) process.exitCode = 1;
