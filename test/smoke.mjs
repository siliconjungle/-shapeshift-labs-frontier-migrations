import assert from 'node:assert';
import {
  createDefaultValueMigration,
  createInMemoryMigrationLedger,
  createMigrationBoundary,
  createMigrationRegistry,
  createPathMoveMigration,
  createPluginAdapter,
  createRenameFieldMigration,
  createVersionedEnvelope,
  readMigrationPath
} from '../dist/index.js';

const registry = createMigrationRegistry({
  id: 'app-state',
  currentVersion: 3,
  initialVersion: 1,
  migrations: [
    createRenameFieldMigration({
      id: 'todo.rename-title',
      from: 1,
      to: 2,
      path: '/todos/0',
      fromField: 'text',
      toField: 'title'
    }),
    createDefaultValueMigration({
      id: 'todo.add-done',
      from: 2,
      to: 3,
      path: '/todos/0/done',
      value: false
    })
  ]
});

const imported = { $version: 1, todos: [{ id: 'a', text: 'ship migrations' }] };
const result = registry.migrate(imported, { source: 'idb:app-state', actor: 'local-user' });
assert.strictEqual(result.kind, 'frontier.migration.result');
assert.strictEqual(result.version, '3');
assert.strictEqual(result.data.$version, '3');
assert.deepStrictEqual(result.data.todos, [{ id: 'a', title: 'ship migrations', done: false }]);
assert.strictEqual(result.report.fromVersion, '1');
assert.strictEqual(result.report.toVersion, '3');
assert.strictEqual(result.report.stepCount, 2);
assert.strictEqual(result.report.steps[0].id, 'todo.rename-title');
assert.strictEqual(result.envelope.dataVersion, '3');

const dryInput = { $version: 1, todos: [{ id: 'b', text: 'keep original' }] };
const dry = registry.migrate(dryInput, { dryRun: true });
assert.deepStrictEqual(dryInput, { $version: 1, todos: [{ id: 'b', text: 'keep original' }] });
assert.strictEqual(dry.data.$version, '3');

const plan = registry.plan(1);
assert.deepStrictEqual(plan.checksums, result.report.steps.map((step) => step.checksum));

const envelope = createVersionedEnvelope(1, { todos: [{ id: 'c', text: 'from server' }] }, { source: 'server-snapshot' });
const fromEnvelope = registry.migrate(envelope);
assert.deepStrictEqual(fromEnvelope.data.todos[0], { id: 'c', title: 'from server', done: false });
assert.strictEqual(envelope.data.todos[0].text, 'from server');

const ledger = createInMemoryMigrationLedger();
ledger.append(result.report);
assert.strictEqual(ledger.bySource('idb:app-state').length, 1);

const boundary = createMigrationBoundary({
  source: 'file:snapshot',
  registry,
  read() {
    return { $version: 1, todos: [{ id: 'd', text: 'from boundary' }] };
  }
});
const fromBoundary = await boundary.importAsync();
assert.strictEqual(fromBoundary.data.todos[0].title, 'from boundary');

const pluginRegistry = createMigrationRegistry({
  id: 'plugin-payload',
  currentVersion: 'app@2',
  initialVersion: 'plugin@1',
  versionPath: false,
  migrations: [
    createPathMoveMigration({
      id: 'plugin.map-label',
      from: 'plugin@1',
      to: 'app@2',
      read: '/label',
      write: '/title'
    })
  ]
});
const adapter = createPluginAdapter({
  plugin: 'calendar',
  api: 'v1',
  registry: pluginRegistry,
  mapInput(input) {
    return { label: input.name };
  }
});
const mapped = adapter.map({ name: 'planning' });
assert.deepStrictEqual(mapped, { title: 'planning' });

const validated = createMigrationRegistry({
  id: 'validated',
  currentVersion: '2',
  initialVersion: '1',
  migrations: [
    {
      id: 'warn-and-upgrade',
      from: '1',
      to: '2',
      reads: ['/name'],
      writes: ['/name'],
      up(data, ctx) {
        ctx.warn('legacy display name imported', { path: '/name' });
        return data;
      }
    }
  ],
  validate(data, version, phase) {
    assert.ok(version === '1' || version === '2');
    assert.ok(phase === 'before' || phase === 'after');
    assert.strictEqual(typeof readMigrationPath(data, '/name'), 'string');
  }
}).migrate({ $version: '1', name: 'Ada' });
assert.strictEqual(validated.report.warnings.length, 1);

assert.throws(
  () => createMigrationRegistry({ currentVersion: 2, migrations: [] }).migrate({ value: true }),
  /Imported data has no version/
);

console.log('frontier migrations smoke passed');
