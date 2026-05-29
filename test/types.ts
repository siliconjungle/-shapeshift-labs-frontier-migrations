import {
  createMigrationRegistry,
  createVersionedEnvelope,
  type FrontierMigration,
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
