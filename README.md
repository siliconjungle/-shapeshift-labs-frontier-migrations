# @shapeshift-labs/frontier-migrations

Boundary-first data migration, import normalization, and plugin/API version mapping primitives for Frontier state. The package keeps compatibility logic at the data-ingress edge so application code, renderers, caches, CRDT documents, and game systems consume the current shape.

- npm: [`@shapeshift-labs/frontier-migrations`](https://www.npmjs.com/package/@shapeshift-labs/frontier-migrations)
- source: [`siliconjungle/-shapeshift-labs-frontier-migrations`](https://github.com/siliconjungle/-shapeshift-labs-frontier-migrations)

## API Shape

```ts
import {
  createDefaultValueMigration,
  createMigrationRegistry,
  createPathMoveMigration,
  createPluginAdapter,
  createVersionedEnvelope
} from '@shapeshift-labs/frontier-migrations';

const migrations = createMigrationRegistry({
  id: 'app-state',
  currentVersion: '3',
  migrations: [
    createPathMoveMigration({
      id: 'todo.title',
      from: '1',
      to: '2',
      read: '/todos/0/text',
      write: '/todos/0/title'
    }),
    createDefaultValueMigration({
      id: 'todo.done',
      from: '2',
      to: '3',
      path: '/todos/0/done',
      value: false
    })
  ]
});

const inbound = createVersionedEnvelope('1', {
  todos: [{ id: 'a', text: 'Ship migrations' }]
});

const { data, report } = migrations.migrate(inbound, {
  source: 'idb:app-state',
  actor: 'local-user'
});

// Application state only sees the current shape.
state.commit(data);
console.log(report.steps.map((step) => step.id));

const pluginAdapter = createPluginAdapter({
  plugin: 'calendar',
  api: 'v1',
  registry: migrations,
  mapInput(payload) {
    return {
      $version: '1',
      todos: [{ id: payload.id, text: payload.label }]
    };
  }
});

const currentPayload = pluginAdapter.map({ id: 'plugin:1', label: 'Import me' });
```

## DOM Snapshot And Compiled UI Migration

`frontier-migrations` also handles serialized renderer artifacts without depending on `frontier-dom`. DOM wire versions stay untouched; app/UI data versions live in `source.dataVersion`, `manifest.source.dataVersion`, or an explicit migration artifact wrapper.

```ts
import {
  createMigrationArtifact,
  createMigrationRegistry,
  createPathMoveMigration,
  migrateArtifact,
  migrateDomCompiledView,
  migrateDomSerializedState
} from '@shapeshift-labs/frontier-migrations';

const uiMigrations = createMigrationRegistry({
  id: 'todo-ui',
  currentVersion: 'ui@2',
  migrations: [
    createPathMoveMigration({
      id: 'snapshot.todo-title',
      from: 'ui@1',
      to: 'ui@2',
      read: '/snapshot/todos/0/text',
      write: '/snapshot/todos/0/title'
    })
  ]
});

const migratedState = migrateDomSerializedState(uiMigrations, serializedDomState);
app.hydrate(migratedState.data);

const migratedCompiledView = migrateDomCompiledView(uiMigrations, compiledView, {
  dataVersionPaths: ['/manifest/source/dataVersion']
});
app.hydrate(migratedCompiledView.data);

const artifact = createMigrationArtifact('frontier.dom.compiled', 'ui@1', compiledView);
const migratedArtifact = migrateArtifact(uiMigrations, artifact);
```

This makes UI-state versioning the same boundary workflow as database snapshots, plugin payloads, CRDT/server snapshots, and cached app state: import old data, migrate once, then let the app and renderer consume only the current shape.

## Design Notes

`frontier-migrations` deliberately owns the import boundary, not long-lived backwards-compatible app branches.

- The app runtime should operate on current data only.
- Importers can read raw database snapshots, CRDT/server snapshots, local cache payloads, plugin payloads, third-party API payloads, fixture files, serialized DOM state, compiled DOM views, and render manifests.
- `createMigrationRegistry(...)` plans deterministic version paths and throws on missing, cyclic, or ambiguous chains.
- `migrate(...)` is sync and allocation-light for local storage and plugin adapters.
- `migrateAsync(...)` supports async migration steps for boundary work that must consult external data.
- `createVersionedEnvelope(...)` keeps durable snapshots self-describing without forcing a particular database schema.
- `createMigrationArtifact(...)` keeps compiled renderer artifacts and other non-state payloads self-describing when their native format has its own wire-format version.
- `migrateDomSerializedState(...)`, `migrateDomCompiledView(...)`, and `migrateDomRenderManifest(...)` are structural helpers; they do not import `frontier-dom` and they preserve DOM `version`/manifest `version` fields.
- `versionPath`, `getVersion`, and `setVersion` let state-cache, SQL, IndexedDB, file, CRDT, event-log, and server importers keep version metadata wherever their storage contract needs it.
- `validate(...)` is structural, so `frontier-schema` or application validators can check old and current shapes without becoming package dependencies.
- Reports include source/plugin/API/actor metadata, exact steps, checksums, reads, writes, warnings, dry-run state, and timings for logging, event replay, Playwright/AI probes, and devtools.
- Plugin adapters treat external API shape mapping as the same boundary workflow as stored-state migration.

## Related Packages

The published Frontier package family is generated from one shared package catalog so READMEs stay in sync across packages:

- [`@shapeshift-labs/frontier`](https://www.npmjs.com/package/@shapeshift-labs/frontier): Core JSON diff/apply, compact patch tuples, JSON Pointer, equality, clone, validation, Unicode helpers, and tiny dependency-free runtime budget/scheduler primitives.
- [`@shapeshift-labs/frontier-query`](https://www.npmjs.com/package/@shapeshift-labs/frontier-query): Shared query-key, selector path, condition, entity identity, and table-shape primitives.
- [`@shapeshift-labs/frontier-codec`](https://www.npmjs.com/package/@shapeshift-labs/frontier-codec): Patch serialization, binary frames, canonical JSON, and patch-history codecs.
- [`@shapeshift-labs/frontier-engine`](https://www.npmjs.com/package/@shapeshift-labs/frontier-engine): Stateful planned diff engine, adaptive profiles, schema plans, and engine-level history helpers.
- [`@shapeshift-labs/frontier-state`](https://www.npmjs.com/package/@shapeshift-labs/frontier-state): Patch-routed app-state subscriptions, owned commits, maintained views, and path mapping.
- [`@shapeshift-labs/frontier-state-cache`](https://www.npmjs.com/package/@shapeshift-labs/frontier-state-cache): Normalized query-result cache with entity/query watchers, persistence, change logs, optimistic layers, scheduled persistence, and mutation bridge.
- [`@shapeshift-labs/frontier-state-cache-idb`](https://www.npmjs.com/package/@shapeshift-labs/frontier-state-cache-idb): IndexedDB persistence adapter for Frontier state-cache snapshots and durable change logs.
- [`@shapeshift-labs/frontier-state-cache-file`](https://www.npmjs.com/package/@shapeshift-labs/frontier-state-cache-file): Structured file persistence adapter for Frontier state-cache snapshots and change logs.
- [`@shapeshift-labs/frontier-state-cache-sql`](https://www.npmjs.com/package/@shapeshift-labs/frontier-state-cache-sql): SQL persistence adapter for Frontier state-cache snapshots and change logs.
- [`@shapeshift-labs/frontier-schema`](https://www.npmjs.com/package/@shapeshift-labs/frontier-schema): JSON Schema validation, Frontier profile generation, CloudEvent envelopes, and query/table schema helpers.
- [`@shapeshift-labs/frontier-event-log`](https://www.npmjs.com/package/@shapeshift-labs/frontier-event-log): Bounded event logs, replay cursors, consumer acknowledgements, keyed compaction, checkpoints, and Frontier patch event records.
- [`@shapeshift-labs/frontier-inspect`](https://www.npmjs.com/package/@shapeshift-labs/frontier-inspect): Cross-package inspection/evidence bundles, registry graph snapshots, feature/resource impact reports, timeline/event normalization, redaction, JSONL import/export, and AI-readable app feature maps.
- [`@shapeshift-labs/frontier-scheduler`](https://www.npmjs.com/package/@shapeshift-labs/frontier-scheduler): Deterministic work scheduling, lanes, cancellation, backpressure, frame policies, replay snapshots, and work graphs.
- [`@shapeshift-labs/frontier-logging`](https://www.npmjs.com/package/@shapeshift-labs/frontier-logging): Opt-in structured logging, browser telemetry, scheduled sinks, file sinks, exporters, benchmark traces, and Frontier patch/update summaries.
- [`@shapeshift-labs/frontier-mutation`](https://www.npmjs.com/package/@shapeshift-labs/frontier-mutation): Explicit mutation and selector plans compiled to Frontier patches or CRDT operations.
- [`@shapeshift-labs/frontier-virtual`](https://www.npmjs.com/package/@shapeshift-labs/frontier-virtual): DOM-neutral virtualization, layout providers, range materialization, grids, spatial/frustum indexes, patch invalidation, camera anchors, and serializable layout state.
- [`@shapeshift-labs/frontier-scene`](https://www.npmjs.com/package/@shapeshift-labs/frontier-scene): Patch-native 2D/3D scene graph, transform propagation, bounds queries, virtual/culling adapters, spatial invalidation, and camera/frustum materialization.
- [`@shapeshift-labs/frontier-pathfinding`](https://www.npmjs.com/package/@shapeshift-labs/frontier-pathfinding): Patch-native grid pathfinding, typed-array A*/Dijkstra search, flow fields, connected components, line-of-sight smoothing, dirty-cell invalidation, and scheduler-friendly path jobs.
- [`@shapeshift-labs/frontier-lod`](https://www.npmjs.com/package/@shapeshift-labs/frontier-lod): Patch-native level-of-detail and significance selection for rendering and computation workloads, compact typed hot paths, multi-observer selection, budget degradation, materialization frames, and scheduler work plans.
- [`@shapeshift-labs/frontier-route`](https://www.npmjs.com/package/@shapeshift-labs/frontier-route): DOM-neutral app/game route resources, route and scene manifests, match/resolve/transition planning, dependency metadata, sessions, registry graph output, and impact queries.
- [`@shapeshift-labs/frontier-dom`](https://www.npmjs.com/package/@shapeshift-labs/frontier-dom): Patch-native DOM and host renderer bindings, manifest hydration, JSX runtime/compiler helpers, SSR, devtools, and logging bridges.
- [`@shapeshift-labs/frontier-playwright`](https://www.npmjs.com/package/@shapeshift-labs/frontier-playwright): Playwright/headless automation probes for Frontier state, DOM, devtools, marks, and timeline queries.
- [`@shapeshift-labs/frontier-crdt`](https://www.npmjs.com/package/@shapeshift-labs/frontier-crdt): Native CRDT documents, update tooling, awareness, branches, conflict introspection, version frames, and undo.
- [`@shapeshift-labs/frontier-crdt-sync`](https://www.npmjs.com/package/@shapeshift-labs/frontier-crdt-sync): CRDT sync endpoints, repo/storage/provider contracts, scheduled sync work, document URLs, local networks, model checking, forensics, and text binding contracts.
- [`@shapeshift-labs/frontier-crdt-websocket`](https://www.npmjs.com/package/@shapeshift-labs/frontier-crdt-websocket): WebSocket client/server transports for Frontier CRDT sync providers.
- [`@shapeshift-labs/frontier-react`](https://www.npmjs.com/package/@shapeshift-labs/frontier-react): React external-store hooks and adapters for Frontier state, cache, and CRDT surfaces.
- [`@shapeshift-labs/frontier-richtext`](https://www.npmjs.com/package/@shapeshift-labs/frontier-richtext): Rich text Delta normalization/application, marks, embeds, ranges, and cursor/selection transforms for local editor integrations.
- [`@shapeshift-labs/frontier-realtime`](https://www.npmjs.com/package/@shapeshift-labs/frontier-realtime): Shared realtime command, tick, snapshot, prediction, reconciliation, interpolation, rollback, message, and delta primitives.
- [`@shapeshift-labs/frontier-realtime-server`](https://www.npmjs.com/package/@shapeshift-labs/frontier-realtime-server): Authoritative realtime room, tick, command validation, rate-limit, session, and snapshot-history runtime.
- [`@shapeshift-labs/frontier-realtime-websocket`](https://www.npmjs.com/package/@shapeshift-labs/frontier-realtime-websocket): WebSocket client, wire, and Node room-server transport for Frontier realtime.
- [`@shapeshift-labs/frontier-game`](https://www.npmjs.com/package/@shapeshift-labs/frontier-game): Game-facing entity, component, player, room, ownership, spatial interest, rollback, physics, and replication helpers above realtime.

Package source repositories:

- [`siliconjungle/-shapeshift-labs-frontier`](https://github.com/siliconjungle/-shapeshift-labs-frontier)
- [`siliconjungle/-shapeshift-labs-frontier-query`](https://github.com/siliconjungle/-shapeshift-labs-frontier-query)
- [`siliconjungle/-shapeshift-labs-frontier-codec`](https://github.com/siliconjungle/-shapeshift-labs-frontier-codec)
- [`siliconjungle/-shapeshift-labs-frontier-engine`](https://github.com/siliconjungle/-shapeshift-labs-frontier-engine)
- [`siliconjungle/-shapeshift-labs-frontier-state`](https://github.com/siliconjungle/-shapeshift-labs-frontier-state)
- [`siliconjungle/-shapeshift-labs-frontier-state-cache`](https://github.com/siliconjungle/-shapeshift-labs-frontier-state-cache)
- [`siliconjungle/-shapeshift-labs-frontier-state-cache-idb`](https://github.com/siliconjungle/-shapeshift-labs-frontier-state-cache-idb)
- [`siliconjungle/-shapeshift-labs-frontier-state-cache-file`](https://github.com/siliconjungle/-shapeshift-labs-frontier-state-cache-file)
- [`siliconjungle/-shapeshift-labs-frontier-state-cache-sql`](https://github.com/siliconjungle/-shapeshift-labs-frontier-state-cache-sql)
- [`siliconjungle/-shapeshift-labs-frontier-schema`](https://github.com/siliconjungle/-shapeshift-labs-frontier-schema)
- [`siliconjungle/-shapeshift-labs-frontier-migrations`](https://github.com/siliconjungle/-shapeshift-labs-frontier-migrations)
- [`siliconjungle/-shapeshift-labs-frontier-event-log`](https://github.com/siliconjungle/-shapeshift-labs-frontier-event-log)
- [`siliconjungle/-shapeshift-labs-frontier-inspect`](https://github.com/siliconjungle/-shapeshift-labs-frontier-inspect)
- [`siliconjungle/-shapeshift-labs-frontier-scheduler`](https://github.com/siliconjungle/-shapeshift-labs-frontier-scheduler)
- [`siliconjungle/-shapeshift-labs-frontier-logging`](https://github.com/siliconjungle/-shapeshift-labs-frontier-logging)
- [`siliconjungle/-shapeshift-labs-frontier-mutation`](https://github.com/siliconjungle/-shapeshift-labs-frontier-mutation)
- [`siliconjungle/-shapeshift-labs-frontier-virtual`](https://github.com/siliconjungle/-shapeshift-labs-frontier-virtual)
- [`siliconjungle/-shapeshift-labs-frontier-scene`](https://github.com/siliconjungle/-shapeshift-labs-frontier-scene)
- [`siliconjungle/-shapeshift-labs-frontier-pathfinding`](https://github.com/siliconjungle/-shapeshift-labs-frontier-pathfinding)
- [`siliconjungle/-shapeshift-labs-frontier-lod`](https://github.com/siliconjungle/-shapeshift-labs-frontier-lod)
- [`siliconjungle/-shapeshift-labs-frontier-route`](https://github.com/siliconjungle/-shapeshift-labs-frontier-route)
- [`siliconjungle/-shapeshift-labs-frontier-dom`](https://github.com/siliconjungle/-shapeshift-labs-frontier-dom)
- [`siliconjungle/-shapeshift-labs-frontier-playwright`](https://github.com/siliconjungle/-shapeshift-labs-frontier-playwright)
- [`siliconjungle/-shapeshift-labs-frontier-crdt`](https://github.com/siliconjungle/-shapeshift-labs-frontier-crdt)
- [`siliconjungle/-shapeshift-labs-frontier-crdt-sync`](https://github.com/siliconjungle/-shapeshift-labs-frontier-crdt-sync)
- [`siliconjungle/-shapeshift-labs-frontier-crdt-websocket`](https://github.com/siliconjungle/-shapeshift-labs-frontier-crdt-websocket)
- [`siliconjungle/-shapeshift-labs-frontier-react`](https://github.com/siliconjungle/-shapeshift-labs-frontier-react)
- [`siliconjungle/-shapeshift-labs-frontier-richtext`](https://github.com/siliconjungle/-shapeshift-labs-frontier-richtext)
- [`siliconjungle/-shapeshift-labs-frontier-realtime`](https://github.com/siliconjungle/-shapeshift-labs-frontier-realtime)
- [`siliconjungle/-shapeshift-labs-frontier-realtime-server`](https://github.com/siliconjungle/-shapeshift-labs-frontier-realtime-server)
- [`siliconjungle/-shapeshift-labs-frontier-realtime-websocket`](https://github.com/siliconjungle/-shapeshift-labs-frontier-realtime-websocket)
- [`siliconjungle/-shapeshift-labs-frontier-game`](https://github.com/siliconjungle/-shapeshift-labs-frontier-game)

## Install

```sh
npm install @shapeshift-labs/frontier-migrations
```

## Benchmarks

These are Frontier-only package measurements, not competitor comparisons.

Run package-local measurements:

```sh
npm run bench
```

The benchmark covers deterministic path planning, explain-only reports, small-object migration, versioned-envelope migration, dry-run migration, serialized DOM state migration, compiled DOM view migration, artifact-wrapper migration, and a repeated batch import fixture.

Latest local package benchmark on Node v26.1.0, darwin arm64, 10k imported objects and 20 rounds:

| Fixture | Median | p95 |
| --- | ---: | ---: |
| `plan-chain-3` | 25.92 us | 269.63 us |
| `explain-chain-3` | 37.63 us | 216.71 us |
| `migrate-small-object-chain-3` | 21.83 us | 63.29 us |
| `migrate-envelope-chain-3` | 24.33 us | 70.96 us |
| `migrate-dry-run-chain-3` | 19.33 us | 46.33 us |
| `migrate-dom-state-chain-3` | 24.63 us | 128.79 us |
| `migrate-dom-compiled-chain-3` | 23.92 us | 38.00 us |
| `migrate-artifact-chain-3` | 33.54 us | 139.83 us |
| `migrate-batch-10000` | 103.42 ms | 104.55 ms |
