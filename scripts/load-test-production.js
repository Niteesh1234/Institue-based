const baseUrl = String(process.env.LOAD_TEST_URL || process.argv[2] || 'http://localhost:4173').replace(/\/$/, '');
const concurrency = Math.max(1, Math.min(50, Number(process.env.LOAD_TEST_CONCURRENCY || 20)));
const total = Math.max(concurrency, Math.min(1000, Number(process.env.LOAD_TEST_REQUESTS || 120)));
const paths = [
  '/api/full-test-catalog?course=jnvst',
  '/api/full-test-catalog?course=sainik',
  '/api/full-test-catalog?course=rms',
  '/api/full-test?course=jnvst&id=TST-EAS-01',
  '/api/health',
];
const durations = [];
const failures = [];
let cursor = 0;

async function worker() {
  while (cursor < total) {
    const index = cursor++;
    const path = paths[index % paths.length];
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
      await response.arrayBuffer();
      durations.push(performance.now() - started);
      if (!response.ok) failures.push({ path, status: response.status });
    } catch (error) {
      durations.push(performance.now() - started);
      failures.push({ path, error: error.message });
    }
  }
}

const wallStarted = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
durations.sort((a, b) => a - b);
const percentile = (fraction) => Math.round(durations[Math.min(durations.length - 1, Math.floor(durations.length * fraction))] || 0);
const report = {
  status: failures.length ? 'failed' : 'passed',
  baseUrl,
  total,
  concurrency,
  failures: failures.slice(0, 10),
  latencyMs: { p50: percentile(0.5), p95: percentile(0.95), max: Math.round(durations.at(-1) || 0) },
  wallTimeMs: Math.round(performance.now() - wallStarted),
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
