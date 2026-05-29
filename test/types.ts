import {
  createMigrationArtifact,
  createMigrationRegistry,
  createPatchPathRewriteRule,
  createVersionedEnvelope,
  migrateArtifact,
  migrateDomCompiledView,
  migrateDomSerializedState,
  migrateSyncableSnapshot,
  readDomDataVersion,
  rewritePatchPath,
  type FrontierDomCompiledViewLike,
  type FrontierDomSerializedStateLike,
  type FrontierMigration,
  type FrontierMigrationArtifactResult,
  type FrontierMigrationResult,
  type FrontierSnapshotMigrationResult,
  type FrontierSyncableSnapshotLike
} from '../dist/index.js';

interface CurrentState {
  $version: string;
  todos: Array<{ id: string; title: string; done: boolean }>;
}

const migration: FrontierMigration<{ $version: string; todos: Array<{ text: string }> }, CurrentState> = {
  id: 'todo.v1-v2',
  from: '1',
  to: '2',
  up(input, ctx) {
    ctx.write('/todos/0/done', false);
    return {
      $version: '2',
      todos: input.todos.map((todo, index) => ({ id: String(index), title: todo.text, done: false }))
    };
  }
};

const registry = createMigrationRegistry<CurrentState>({
  currentVersion: '2',
  migrations: [migration]
});

const result: FrontierMigrationResult<CurrentState> = registry.migrate(createVersionedEnvelope('1', {
  $version: '1',
  todos: [{ text: 'typed' }]
}));

result.data.todos[0].done satisfies boolean;

const domRegistry = createMigrationRegistry<FrontierDomSerializedStateLike>({
  currentVersion: '2',
  migrations: [
    {
      id: 'dom.v1-v2',
      from: '1',
      to: '2',
      up(input) {
        return input;
      }
    }
  ]
});

const domState = {
  kind: 'frontier.dom.state',
  version: 1,
  manifest: { version: 1, source: { dataVersion: '1' } },
  source: { dataVersion: '1' },
  snapshot: { todos: [] }
} satisfies FrontierDomSerializedStateLike;

const domResult = migrateDomSerializedState(domRegistry, domState);
domResult.data.kind satisfies 'frontier.dom.state';
readDomDataVersion(domResult.data) satisfies string | undefined;

const compiledRegistry = createMigrationRegistry<FrontierDomCompiledViewLike>({
  currentVersion: '2',
  initialVersion: '1',
  migrations: []
});
const compiled = {
  html: '<h1>Hello</h1>',
  manifest: { version: 1, source: { dataVersion: '1' } }
} satisfies FrontierDomCompiledViewLike;

const compiledResult = migrateDomCompiledView(compiledRegistry, compiled);
compiledResult.data.html satisfies string;

const artifact = createMigrationArtifact('frontier.dom.compiled', '1', compiled);
const artifactResult: FrontierMigrationArtifactResult<FrontierDomCompiledViewLike> = migrateArtifact(compiledRegistry, artifact);
artifactResult.artifact.artifactKind satisfies string;

interface CurrentPayload {
  todos: Array<{ id: string; title: string }>;
}

const syncRegistry = createMigrationRegistry<CurrentPayload>({
  currentVersion: '2',
  migrations: [
    {
      id: 'sync.v1-v2',
      from: '1',
      to: '2',
      up(input: { todos: Array<{ id: string; text: string }> }) {
        return { todos: input.todos.map((todo) => ({ id: todo.id, title: todo.text })) };
      }
    }
  ]
});

const syncSnapshot = {
  basis: { dataVersion: '1', heads: ['a:1'], stateVector: { a: 1 } },
  snapshot: { todos: [{ id: 'a', text: 'typed sync' }] }
} satisfies FrontierSyncableSnapshotLike;

const syncResult: FrontierSnapshotMigrationResult<typeof syncSnapshot, CurrentPayload> = migrateSyncableSnapshot(syncRegistry, syncSnapshot);
syncResult.payload.todos[0].title satisfies string;

const rule = createPatchPathRewriteRule('/todos', '/tasks', { prefix: true });
const rewrittenPath = rewritePatchPath(['todos', 0, 'text'], [rule]);
rewrittenPath satisfies string | readonly (string | number)[];
