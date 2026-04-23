#!/usr/bin/env node

/**
 * ADM-055: Post-Deployment Verification
 * Gates 5-8: Health Monitoring, E2E, Performance, Business Continuity
 */

const TARGET = process.env.DEPLOY_TARGET ?? 'https://aurex.in';
const API_TARGET = process.env.API_TARGET ?? 'https://api.aurex.in';

let failures = 0;

async function gate(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name} — ${err.message}`);
    failures++;
  }
}

async function fetchJSON(url, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { data: await res.json(), headers: res.headers, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

console.log('=== ADM-055: Post-Deployment Gates ===\n');

// Gate 5: Health Monitoring
console.log('[Gate 5] Service Health');
await gate('API health endpoint', async () => {
  const { data } = await fetchJSON(`${API_TARGET}/api/v1/health`);
  if (data.status !== 'healthy') throw new Error(`Unhealthy: ${JSON.stringify(data)}`);
});
await gate('API readiness', async () => {
  const { data } = await fetchJSON(`${API_TARGET}/api/v1/health/ready`);
  if (!data.ready) throw new Error('Not ready');
});

// Gate 6: End-to-End
console.log('\n[Gate 6] End-to-End Functionality');
await gate('Frontend loads', async () => {
  const res = await fetch(TARGET);
  if (!res.ok) throw new Error(`Frontend HTTP ${res.status}`);
  const html = await res.text();
  if (!html.includes('Aurex')) throw new Error('Frontend content missing');
});
await gate('API returns JSON (not HTML)', async () => {
  const res = await fetch(`${API_TARGET}/api/v1/health`);
  const ct = res.headers.get('content-type');
  if (!ct?.includes('application/json')) throw new Error(`Got ${ct}, expected JSON`);
});

// Gate 7: Performance (ADM-057)
console.log('\n[Gate 7] Performance');
await gate('API response < 500ms', async () => {
  const start = Date.now();
  await fetchJSON(`${API_TARGET}/api/v1/health`);
  const ms = Date.now() - start;
  if (ms > 500) throw new Error(`${ms}ms exceeds 500ms threshold`);
  console.log(`    (${ms}ms)`);
});

// Gate 8: Security Headers (ADM-052/054/057)
console.log('\n[Gate 8] Security Headers');
await gate('HSTS header present', async () => {
  const res = await fetch(TARGET);
  const hsts = res.headers.get('strict-transport-security');
  if (!hsts?.includes('max-age=')) throw new Error('HSTS missing');
});
await gate('X-Frame-Options present', async () => {
  const res = await fetch(TARGET);
  if (!res.headers.get('x-frame-options')) throw new Error('X-Frame-Options missing');
});
await gate('X-Content-Type-Options present', async () => {
  const res = await fetch(TARGET);
  if (!res.headers.get('x-content-type-options')) throw new Error('X-Content-Type-Options missing');
});

console.log(`\n=== Results: ${failures} failures ===`);
if (failures > 0) {
  console.error('Post-deployment gates FAILED — consider rollback');
  process.exit(1);
}
console.log('All post-deployment gates PASSED');
