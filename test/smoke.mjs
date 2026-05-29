import assert from 'node:assert';
import {
  createDefaultValueMigration,
  createMigrationArtifact,
  createInMemoryMigrationLedger,
  createMigrationBoundary,
  createMigrationRegistry,
  createPathMoveMigration,
  createPatchPathRewriteRule,
  createPluginAdapter,
  createRenameFieldMigration,
  createVersionedEnvelope,
  migrateArtifact,
  migrateCrdtSnapshot,
  migrateDomCompiledView,
  migrateDomRenderManifest,
  migrateDomSerializedState,
  migrateEventLogSnapshot,
  inspectMigrationRegistry,
  migrateSnapshotPayload,
  migrateStateCacheSnapshot,
  migrateSyncableSnapshot,
  readArtifactVersion,
  readDomDataVersion,
  readMigrationPath,
  rewritePatchPath,
  rewritePatchPaths
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

const graph = registry.inspect();
assert.strictEqual(graph.kind, 'frontier.migration.graph');
assert.strictEqual(graph.valid, true);
assert.deepStrictEqual(graph.rootVersions, ['1']);
assert.deepStrictEqual(graph.headVersions, ['3']);
assert.deepStrictEqual(graph.nodes.map((node) => node.version), ['1', '2', '3']);
assert.strictEqual(graph.edges.length, 2);
assert.strictEqual(graph.edges[0].migrationId, 'todo.rename-title');

const inspected = inspectMigrationRegistry({
  id: 'branched',
  currentVersion: '3',
  migrations: [
    createPathMoveMigration({ id: 'branch-main', from: '1', to: '2', read: '/a', write: '/b' }),
    createPathMoveMigration({ id: 'branch-alt', from: '1', to: 'alt', read: '/a', write: '/c' })
  ]
});
assert.strictEqual(inspected.valid, true);
assert.ok(inspected.issues.some((issue) => issue.code === 'multiple-heads'));
assert.ok(inspected.issues.some((issue) => issue.code === 'dead-end' && issue.version === 'alt'));

assert.throws(() => createMigrationRegistry({
  id: 'duplicate-id',
  currentVersion: '3',
  migrations: [
    createPathMoveMigration({ id: 'dup', from: '1', to: '2', read: '/a', write: '/b' }),
    createPathMoveMigration({ id: 'dup', from: '2', to: '3', read: '/b', write: '/c' })
  ]
}), /duplicate migration id/);

assert.throws(() => registry.plan('3', { targetVersion: '1' }), /No migration step from 3 to 1/);

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

const asyncRegistry = createMigrationRegistry({
  id: 'async-state',
  currentVersion: '2',
  migrations: [
    {
      id: 'async-title',
      from: '1',
      to: '2',
      async up(data, ctx) {
        ctx.rename('/text', '/title');
        return data;
      }
    }
  ]
});
assert.throws(() => asyncRegistry.migrate({ $version: '1', text: 'sync call' }), /returned a promise/);
const asyncResult = await asyncRegistry.migrateAsync({ $version: '1', text: 'async call' });
assert.deepStrictEqual(asyncResult.data, { $version: '2', title: 'async call' });

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

const domRegistry = createMigrationRegistry({
  id: 'dom-ui-state',
  currentVersion: 'ui@2',
  migrations: [
    createPathMoveMigration({
      id: 'dom.snapshot-title',
      from: 'ui@1',
      to: 'ui@2',
      read: '/snapshot/todos/0/text',
      write: '/snapshot/todos/0/title'
    }),
    createDefaultValueMigration({
      id: 'dom.add-hydration-mode',
      from: 'ui@2',
      to: 'ui@3',
      path: '/source/hydrationMode',
      value: 'resume'
    })
  ]
});

const serializedDomState = {
  kind: 'frontier.dom.state',
  version: 1,
  manifest: {
    version: 1,
    source: { dataVersion: 'ui@1' },
    bindings: []
  },
  source: { dataVersion: 'ui@1' },
  html: '<li>old</li>',
  snapshot: { todos: [{ id: 'a', text: 'old' }] },
  layout: []
};
const domStateResult = migrateDomSerializedState(domRegistry, serializedDomState, { targetVersion: 'ui@3' });
assert.strictEqual(domStateResult.data.version, 1);
assert.strictEqual(domStateResult.data.manifest.version, 1);
assert.strictEqual(domStateResult.data.source.dataVersion, 'ui@3');
assert.strictEqual(domStateResult.data.manifest.source.dataVersion, 'ui@3');
assert.strictEqual(domStateResult.data.source.hydrationMode, 'resume');
assert.deepStrictEqual(domStateResult.data.snapshot.todos[0], { id: 'a', title: 'old' });
assert.strictEqual(domStateResult.report.source, 'frontier.dom.state');
assert.strictEqual(readDomDataVersion(domStateResult.data), 'ui@3');

const compiledRegistry = createMigrationRegistry({
  id: 'dom-compiled',
  currentVersion: 'ui@2',
  migrations: [
    createPathMoveMigration({
      id: 'compiled.binding-path',
      from: 'ui@1',
      to: 'ui@2',
      read: '/manifest/bindings/0/text',
      write: '/manifest/bindings/0/content'
    })
  ]
});
const compiled = {
  html: '<button>Save</button>',
  manifest: {
    version: 1,
    source: { dataVersion: 'ui@1' },
    bindings: [{ id: 'button-text', text: '/label' }]
  }
};
const compiledResult = migrateDomCompiledView(compiledRegistry, compiled);
assert.strictEqual(compiledResult.data.manifest.version, 1);
assert.strictEqual(compiledResult.data.manifest.source.dataVersion, 'ui@2');
assert.deepStrictEqual(compiledResult.data.manifest.bindings[0], { id: 'button-text', content: '/label' });

const manifestRegistry = createMigrationRegistry({
  id: 'dom-manifest',
  currentVersion: 'ui@2',
  migrations: [
    createPathMoveMigration({
      id: 'manifest.binding-path',
      from: 'ui@1',
      to: 'ui@2',
      read: '/bindings/0/text',
      write: '/bindings/0/content'
    })
  ]
});
const manifest = {
  version: 1,
  source: { dataVersion: 'ui@1' },
  bindings: [{ id: 'title', text: '/oldTitle' }]
};
const manifestResult = migrateDomRenderManifest(manifestRegistry, manifest);
assert.strictEqual(manifestResult.data.version, 1);
assert.strictEqual(manifestResult.data.source.dataVersion, 'ui@2');
assert.deepStrictEqual(manifestResult.data.bindings[0], { id: 'title', content: '/oldTitle' });

const artifact = createMigrationArtifact('frontier.dom.compiled', 'ui@1', {
  html: '<p>Label</p>',
  manifest: { version: 1, bindings: [{ id: 'p', text: '/label' }] }
}, { source: 'build:manifest' });
const artifactResult = migrateArtifact(compiledRegistry, artifact);
assert.strictEqual(readArtifactVersion(artifactResult.artifact), 'ui@2');
assert.strictEqual(artifactResult.artifact.artifactKind, 'frontier.dom.compiled');
assert.deepStrictEqual(artifactResult.artifact.payload.manifest.bindings[0], { id: 'p', content: '/label' });
assert.strictEqual(artifact.payload.manifest.bindings[0].text, '/label');

const syncRegistry = createMigrationRegistry({
  id: 'sync-state',
  currentVersion: '2',
  migrations: [
    createPathMoveMigration({
      id: 'sync.todo-title',
      from: '1',
      to: '2',
      read: '/todos/0/text',
      write: '/todos/0/title'
    })
  ]
});
const syncSnapshot = {
  kind: 'frontier.sync.snapshot',
  basis: {
    dataVersion: '1',
    heads: ['a:1'],
    stateVector: { a: 1 }
  },
  snapshot: {
    todos: [{ id: 'a', text: 'sync me' }]
  }
};
const syncResult = migrateSyncableSnapshot(syncRegistry, syncSnapshot);
assert.strictEqual(syncResult.payloadPath, '/snapshot');
assert.deepStrictEqual(syncResult.payload, { todos: [{ id: 'a', title: 'sync me' }] });
assert.strictEqual(syncResult.data.basis.dataVersion, '2');
assert.deepStrictEqual(syncResult.data.basis.heads, ['a:1']);
assert.deepStrictEqual(syncResult.data.basis.stateVector, { a: 1 });
assert.strictEqual(syncResult.data.metadata.dataVersion, '2');
assert.strictEqual(syncResult.data.metadata.migrations[0].registryId, 'sync-state');

const crdtSnapshot = {
  version: { actors: { a: 1 } },
  heads: ['a:1'],
  stateVector: { a: 1 },
  update: new Uint8Array([1, 2, 3]),
  metadata: { dataVersion: '1' },
  view: { todos: [{ id: 'crdt', text: 'from crdt' }] }
};
const crdtResult = migrateCrdtSnapshot(syncRegistry, crdtSnapshot);
assert.strictEqual(crdtResult.payloadPath, '/view');
assert.deepStrictEqual(crdtResult.data.view.todos[0], { id: 'crdt', title: 'from crdt' });
assert.strictEqual(crdtResult.data.metadata.dataVersion, '2');
assert.deepStrictEqual(crdtResult.data.heads, ['a:1']);
assert.deepStrictEqual(Array.from(crdtResult.data.update), [1, 2, 3]);

const cacheRegistry = createMigrationRegistry({
  id: 'cache-state',
  currentVersion: '2',
  migrations: [
    createPathMoveMigration({
      id: 'cache.entity-title',
      from: '1',
      to: '2',
      read: '/entities/Todo:a/text',
      write: '/entities/Todo:a/title'
    })
  ]
});
const cacheSnapshot = {
  metadata: { dataVersion: '1' },
  entities: { 'Todo:a': { id: 'a', text: 'cached' } },
  queries: []
};
const cacheResult = migrateStateCacheSnapshot(cacheRegistry, cacheSnapshot);
assert.strictEqual(cacheResult.payloadPath, false);
assert.deepStrictEqual(cacheResult.data.entities['Todo:a'], { id: 'a', title: 'cached' });
assert.strictEqual(cacheResult.data.metadata.dataVersion, '2');

const directSnapshot = {
  meta: { version: '1' },
  body: { todos: [{ id: 'direct', text: 'body' }] }
};
const directResult = migrateSnapshotPayload(syncRegistry, directSnapshot, {
  payloadPath: '/body',
  dataVersionPaths: ['/meta/version'],
  writeDataVersionPaths: ['/meta/version'],
  appendHistory: '/meta/migrations'
});
assert.deepStrictEqual(directResult.data.body.todos[0], { id: 'direct', title: 'body' });
assert.strictEqual(directResult.data.meta.version, '2');
assert.strictEqual(directResult.data.meta.migrations[0].toVersion, '2');

const rewriteRule = createPatchPathRewriteRule('/todos', '/tasks', { prefix: true });
assert.deepStrictEqual(rewritePatchPath(['todos', 0, 'text'], [rewriteRule]), ['tasks', 0, 'text']);
assert.strictEqual(rewritePatchPath('/todos/0/text', [rewriteRule]), '/tasks/0/text');
const patchLog = [
  [0, ['todos', 0, 'text'], 'x'],
  { patch: [[0, '/todos/1/text', 'y']], paths: [['todos', 2, 'text']] }
];
const rewrittenLog = rewritePatchPaths(patchLog, [rewriteRule]);
assert.deepStrictEqual(rewrittenLog[0][1], ['tasks', 0, 'text']);
assert.deepStrictEqual(rewrittenLog[1].patch[0][1], '/tasks/1/text');
assert.deepStrictEqual(rewrittenLog[1].paths[0], ['tasks', 2, 'text']);
assert.deepStrictEqual(patchLog[0][1], ['todos', 0, 'text']);
assert.deepStrictEqual(patchLog[1].patch[0][1], '/todos/1/text');
assert.deepStrictEqual(patchLog[1].paths[0], ['todos', 2, 'text']);

const eventLogSnapshot = {
  metadata: { dataVersion: '1' },
  snapshot: { todos: [{ id: 'event', text: 'from event' }] },
  events: [
    { id: 'e1', patch: [[0, ['todos', 0, 'text'], 'later']] }
  ]
};
const eventResult = migrateEventLogSnapshot(syncRegistry, eventLogSnapshot, {
  patchPathRules: [rewriteRule]
});
assert.deepStrictEqual(eventResult.data.snapshot.todos[0], { id: 'event', title: 'from event' });
assert.deepStrictEqual(eventResult.data.events[0].patch[0][1], ['tasks', 0, 'text']);

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
