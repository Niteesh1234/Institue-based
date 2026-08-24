import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogContract, deploymentMetadata, loadAggregation, loadCatalog, loadValidationReport } from './vercel-catalog.js';
import registerHandler from './api/auth/register.js';
import requestOtpHandler from './api/auth/request-otp.js';
import verifyOtpHandler from './api/auth/verify-otp.js';
import loginHandler from './api/auth/login.js';
import sessionHandler from './api/auth/session.js';
import logoutHandler from './api/auth/logout.js';
import studentsHandler from './api/students.js';

const port = Number(process.env.PORT || 5174);
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.join(rootDirectory, 'dist');

const json = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
  response.end(JSON.stringify(body));
};

const contentTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const authHandlers = new Map([
  ['/api/auth/register', registerHandler],
  ['/api/auth/request-otp', requestOtpHandler],
  ['/api/auth/verify-otp', verifyOtpHandler],
  ['/api/auth/login', loginHandler],
  ['/api/auth/session', sessionHandler],
  ['/api/auth/logout', logoutHandler]
]);

function runApiHandler(handler, request, response, url) {
  request.query = Object.fromEntries(url.searchParams.entries());
  response.status = (statusCode) => { response.statusCode = statusCode; return response; };
  response.json = (body) => {
    if (!response.headersSent) response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(body));
  };
  return handler(request, response);
}

async function serveApplication(url, response) {
  const requestedPath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const resolvedPath = path.resolve(distDirectory, requestedPath);
  const safePath = resolvedPath.startsWith(`${distDirectory}${path.sep}`) ? resolvedPath : path.join(distDirectory, 'index.html');
  try {
    const body = await readFile(safePath);
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(safePath)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    if (path.extname(requestedPath)) { response.writeHead(404); response.end('Not found'); return; }
    const body = await readFile(path.join(distDirectory, 'index.html'));
    response.writeHead(200, { 'Content-Type': contentTypes['.html'] });
    response.end(body);
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  const url = new URL(request.url, `http://${request.headers.host}`);
  const course = url.searchParams.get('course') || 'jnvst';
  if (authHandlers.has(url.pathname)) return runApiHandler(authHandlers.get(url.pathname), request, response, url);
  if (url.pathname === '/api/students') return runApiHandler(studentsHandler, request, response, url);
  if (url.pathname === '/api/health') return json(response, 200, { service: 'vijetha-testing-api', database: deploymentMetadata.databaseName, moduleVersion: deploymentMetadata.moduleVersion, modules: deploymentMetadata.modules, status: deploymentMetadata.hasMongo ? 'configured' : 'preview' });
  if (url.pathname === '/api/full-test-catalog' || url.pathname === '/api/test-catalog') {
    try {
      const catalog = await loadCatalog({ course, refresh: url.searchParams.get('refresh') === '1', includeQuestions: false });
      const level = url.searchParams.get('level') || 'all';
      const tests = level === 'all' ? catalog.tests : catalog.tests.filter((test) => test.level === level.toLowerCase());
      return json(response, 200, { source: catalog.source, format: 'Validated syllabus-aligned full tests', contract: catalogContract(course), tests });
    } catch (error) { return json(response, 503, { error: error.message }); }
  }
  if (url.pathname === '/api/full-test') {
    try {
      const testId = url.searchParams.get('id');
      if (!testId) return json(response, 400, { error: 'A test id is required.' });
      const catalog = await loadCatalog({ course, testId, includeQuestions: true, refresh: url.searchParams.get('refresh') === '1' });
      if (!catalog.tests[0]) return json(response, 404, { error: `Test ${testId} was not found.` });
      return json(response, 200, { source: catalog.source, test: catalog.tests[0] });
    } catch (error) { return json(response, 503, { error: error.message }); }
  }
  if (url.pathname === '/api/question-aggregation') {
    try { return json(response, 200, { source: deploymentMetadata.hasMongo ? `Testing.${course}_questions` : 'Validated in-memory preview', aggregation: await loadAggregation(course) }); }
    catch (error) { return json(response, 503, { error: error.message }); }
  }
  if (url.pathname === '/api/validation-report') {
    try { return json(response, 200, await loadValidationReport(course)); }
    catch (error) { return json(response, 503, { error: error.message }); }
  }
  if (request.method === 'GET') return serveApplication(url, response);
  response.writeHead(405); response.end('Method not allowed');
});

server.listen(port, () => console.log(`Vijetha multi-exam API running at http://localhost:${port}`));
