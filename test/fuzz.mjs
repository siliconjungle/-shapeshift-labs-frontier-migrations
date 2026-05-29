import assert from 'node:assert';
import {
  createDefaultValueMigration,
  createMigrationRegistry,
  createPathMoveMigration,
  migrateDomSerializedState
} from '../dist/index.js';

const args = parseArgs(process.argv.slice(2));
const cases = readPositiveInt(args.cases, 300);
let seed = readPositiveInt(args.seed, 0x4d1a);

for (let i = 0; i < cases; i++) {
  const steps = randInt(1, 8);
  const initialField = 'value0';
  const input = {
    $version: '0',
    entity: {
      id: 'entity:' + i,
      [initialField]: randInt(0, 100000)
    }
  };
  const migrations = [];
  for (let step = 0; step < steps; step++) {
    migrations.push(createPathMoveMigration({
      id: 'move-' + step,
      from: String(step),
      to: String(step + 1),
      read: '/entity/value' + step,
      write: '/entity/value' + (step + 1)
    }));
  }
  migrations.push(createDefaultValueMigration({
    id: 'add-origin',
    from: String(steps),
    to: String(steps + 1),
    path: '/entity/origin',
    value: () => 'fuzz'
  }));

  const registry = createMigrationRegistry({
    id: 'fuzz-' + i,
    currentVersion: String(steps + 1),
    migrations
  });
  const result = registry.migrate(input);
  assert.strictEqual(result.version, String(steps + 1));
  assert.strictEqual(result.data.$version, String(steps + 1));
  assert.strictEqual(result.data.entity['value' + (steps + 1)], undefined);
  assert.strictEqual(result.data.entity['value' + steps], input.entity['value' + steps]);
  assert.strictEqual(result.data.entity.value0, undefined);
  assert.strictEqual(result.data.entity.origin, 'fuzz');
  assert.strictEqual(result.report.stepCount, steps + 1);

  const dryInput = {
    $version: '0',
    entity: {
      id: 'dry:' + i,
      value0: i
    }
  };
  const dry = registry.migrate(dryInput, { dryRun: true });
  assert.strictEqual(dryInput.$version, '0');
  assert.strictEqual(dryInput.entity.value0, i);
  assert.strictEqual(dry.data.$version, String(steps + 1));

  const domState = {
    kind: 'frontier.dom.state',
    version: 1,
    manifest: {
      version: 1,
      source: { dataVersion: '0' },
      bindings: []
    },
    source: { dataVersion: '0' },
    snapshot: {
      entity: {
        id: 'dom:' + i,
        value0: i
      }
    }
  };
  const domMigrations = [];
  for (let step = 0; step < steps; step++) {
    domMigrations.push(createPathMoveMigration({
      id: 'dom-move-' + step,
      from: String(step),
      to: String(step + 1),
      read: '/snapshot/entity/value' + step,
      write: '/snapshot/entity/value' + (step + 1)
    }));
  }
  const domRegistry = createMigrationRegistry({
    id: 'dom-fuzz-' + i,
    currentVersion: String(steps),
    migrations: domMigrations
  });
  const domResult = migrateDomSerializedState(domRegistry, domState);
  assert.strictEqual(domResult.data.version, 1);
  assert.strictEqual(domResult.data.source.dataVersion, String(steps));
  assert.strictEqual(domResult.data.manifest.source.dataVersion, String(steps));
  assert.strictEqual(domResult.data.snapshot.entity.value0, undefined);
  assert.strictEqual(domResult.data.snapshot.entity['value' + steps], i);
}

console.log(`frontier migrations fuzz passed: cases=${cases}`);

function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

function randInt(min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--cases') out.cases = argv[++i];
    else if (arg === '--seed') out.seed = argv[++i];
  }
  return out;
}

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
