import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  createDefaultValueMigration,
  createMigrationRegistry,
  createPathMoveMigration,
  createVersionedEnvelope
} from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');
const repoRoot = path.basename(path.dirname(packageDir)) === 'packages'
  ? path.resolve(packageDir, '..', '..')
  : packageDir;
const args = parseArgs(process.argv.slice(2));
const count = readPositiveInt(args.count, 20000);
const rounds = readPositiveInt(args.rounds, 30);
const outPath = args.out ? path.resolve(repoRoot, args.out) : null;

const registry = createMigrationRegistry({
  id: 'bench-state',
  currentVersion: '4',
  migrations: [
    createPathMoveMigration({ id: 'v1-v2-title', from: '1', to: '2', read: '/title', write: '/name' }),
    createPathMoveMigration({ id: 'v2-v3-items', from: '2', to: '3', read: '/items', write: '/records' }),
    createDefaultValueMigration({ id: 'v3-v4-meta', from: '3', to: '4', path: '/meta/imported', value: true })
  ]
});

const rows = [
  measure('plan-chain-3', () => registry.plan('1').migrations.length),
  measure('explain-chain-3', () => registry.explain(makeState(0)).stepCount),
  measure('migrate-small-object-chain-3', () => registry.migrate(makeState(1)).data.records.length),
  measure('migrate-envelope-chain-3', () => registry.migrate(createVersionedEnvelope('1', makeState(2))).data.records.length),
  measure('migrate-dry-run-chain-3', () => registry.migrate(makeState(3), { dryRun: true }).data.records.length),
  measure('migrate-batch-' + count, () => {
    let total = 0;
    for (let i = 0; i < count; i++) total += registry.migrate(makeState(i)).data.records.length;
    return total;
  }, Math.max(3, Math.floor(rounds / 5)))
];

const report = {
  package: '@shapeshift-labs/frontier-migrations',
  version: readPackageVersion(),
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform + ' ' + process.arch,
  count,
  rounds,
  rows
};

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
}

console.log(report.package + ' package benchmark');
console.log('Node ' + report.node + ' on ' + report.platform + ', count=' + count + ', rounds=' + rounds);
console.log('These are Frontier-only package measurements, not competitor comparisons.');
console.log('');
console.log(padRight('Fixture', 34) + padLeft('Median', 12) + padLeft('p95', 12));
for (const row of rows) {
  console.log(padRight(row.fixture, 34) + padLeft(formatUs(row.medianUs), 12) + padLeft(formatUs(row.p95Us), 12));
}
if (outPath) console.log('\nwrote ' + path.relative(repoRoot, outPath));

function makeState(index) {
  return {
    $version: '1',
    title: 'document ' + index,
    items: [
      { id: 'a' + index, value: index },
      { id: 'b' + index, value: index + 1 },
      { id: 'c' + index, value: index + 2 }
    ],
    meta: {}
  };
}

function measure(fixture, fn, localRounds = rounds) {
  const values = [];
  let sink = 0;
  for (let round = 0; round < localRounds; round++) {
    const started = performance.now();
    sink += fn();
    values[values.length] = (performance.now() - started) * 1000;
  }
  if (sink === -1) console.log('sink=' + sink);
  values.sort((left, right) => left - right);
  return {
    fixture,
    medianUs: percentile(values, 0.5),
    p95Us: percentile(values, 0.95)
  };
}

function percentile(values, p) {
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))] ?? 0;
}

function formatUs(value) {
  if (value >= 1000) return (value / 1000).toFixed(2) + ' ms';
  return value.toFixed(2) + ' us';
}

function padRight(value, width) {
  return String(value).padEnd(width, ' ');
}

function padLeft(value, width) {
  return String(value).padStart(width, ' ');
}

function readPackageVersion() {
  return JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')).version;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--count') out.count = argv[++i];
    else if (arg === '--rounds') out.rounds = argv[++i];
    else if (arg === '--out') out.out = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npm run bench -- [--count 20000] [--rounds 30] [--out benchmarks/results/frontier-migrations-package-bench-latest.json]');
      process.exit(0);
    }
  }
  return out;
}

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
