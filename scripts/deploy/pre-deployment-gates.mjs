#!/usr/bin/env node

/**
 * ADM-055: Pre-Deployment Gating Checklist
 * Gates 1-4: Infrastructure, Application Health, Core Functionality, Security
 */

import { execSync } from 'child_process';
import fs from 'node:fs';

const TARGET = process.env.DEPLOY_TARGET ?? 'https://aurex.in';
const API_TARGET = process.env.API_TARGET ?? 'https://api.aurex.in';

let failures = 0;

function gate(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name} — ${err.message}`);
    failures++;
  }
}

function exec(cmd) {
  return execSync(cmd, { encoding: 'utf-8', timeout: 30_000 }).trim();
}

console.log('=== ADM-055: Pre-Deployment Gates ===\n');

// Gate 1: Infrastructure
console.log('[Gate 1] Infrastructure Readiness');
gate('Build artifacts exist (API)', () => {
  if (!fs.existsSync('apps/api/dist')) throw new Error('apps/api/dist missing — run pnpm build');
});
gate('Build artifacts exist (Web)', () => {
  if (!fs.existsSync('apps/web/dist')) throw new Error('apps/web/dist missing — run pnpm build');
});

// Gate 2: Application Health
console.log('\n[Gate 2] Application Health');
gate('Package.json valid', () => {
  JSON.parse(exec('cat package.json'));
});
gate('No TypeScript errors', () => {
  exec('pnpm typecheck 2>&1');
});

// Gate 3: Core Functionality
console.log('\n[Gate 3] Core Functionality');
gate('Tests passing', () => {
  exec('pnpm test 2>&1');
});

// Gate 4: Security
console.log('\n[Gate 4] Security Posture');
gate('No hardcoded secrets', () => {
  // Scan .ts/.tsx in apps/ and packages/ for AWS keys, OpenAI-style keys,
  // and literal password/secret assignments. Shelling out is fragile because
  // the pattern contains both quote styles, so we walk the tree in Node.
  const patterns = [
    /AKIA[0-9A-Z]{16}/,
    /sk-[A-Za-z0-9]{20,}/,
    /(?:password|secret|api[_-]?key)\s*[:=]\s*["'][^"']{4,}["']/i,
  ];
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        const body = fs.readFileSync(full, 'utf-8');
        if (patterns.some((re) => re.test(body))) hits.push(full);
      }
    }
  };
  for (const root of ['apps', 'packages']) {
    if (fs.existsSync(root)) walk(root);
  }
  if (hits.length) throw new Error(`Potential secrets in: ${hits.join(', ')}`);
});
gate('.env not committed', () => {
  const tracked = exec('git ls-files .env .env.local .env.production 2>/dev/null || true');
  if (tracked) throw new Error('.env files tracked by git');
});

console.log(`\n=== Results: ${failures} failures ===`);
if (failures > 0) {
  console.error('Pre-deployment gates FAILED — deployment blocked');
  process.exit(1);
}
console.log('All pre-deployment gates PASSED');
