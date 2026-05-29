import {
  createMigrationArtifact,
  createMigrationRegistry,
  createVersionedEnvelope,
  migrateArtifact,
  migrateDomCompiledView,
  migrateDomSerializedState,
  readDomDataVersion,
  type FrontierDomCompiledViewLike,
  type FrontierDomSerializedStateLike,
  type FrontierMigration,
  type FrontierMigrationArtifactResult,
  type FrontierMigrationResult
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
