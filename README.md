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
  createVersionedEnvelope,
  inspectMigrationRegistry
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

## Graph Diagnostics

Registries expose a serializable migration graph so CI, devtools, Playwright/AI probes, and release scripts can inspect the same version topology that runtime planning uses.

```ts
const graph = migrations.inspect();

console.log(graph.rootVersions);
console.log(graph.headVersions);
console.log(graph.issues);

// Tooling can inspect a registry definition without constructing a runtime boundary.
const status = inspectMigrationRegistry({
  id: 'plugin-api',
  currentVersion: '3',
  initialVersion: '1',
  migrations: [
    createPathMoveMigration({ id: 'plugin.v1-v2', from: '1', to: '2', read: '/label', write: '/title' }),
    createDefaultValueMigration({ id: 'plugin.v2-v3', from: '2', to: '3', path: '/enabled', value: true })
  ]
});
```

The graph reports duplicate migration ids, duplicate steps, cycles, unreachable targets, wildcard steps, multiple heads, and dead-end heads. Runtime registries reject error-level graph issues up front; warning-level issues remain inspectable for staged plugin/API import paths.

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

## Syncable State And Replay Logs

The same registry can migrate syncable containers while preserving heads, state vectors, updates, and replay metadata.

```ts
import {
  createPatchPathRewriteRule,
  migrateCrdtSnapshot,
  migrateEventLogSnapshot,
  migrateStateCacheSnapshot,
  migrateSyncableSnapshot
} from '@shapeshift-labs/frontier-migrations';

const stateMigrations = createMigrationRegistry({
  id: 'todo-state',
  currentVersion: '2',
  migrations: [
    createPathMoveMigration({
      id: 'todo.title',
      from: '1',
      to: '2',
      read: '/todos/0/text',
      write: '/todos/0/title'
    })
  ]
});

const migratedSync = migrateSyncableSnapshot(stateMigrations, {
  basis: { dataVersion: '1', heads, stateVector },
  snapshot: { todos: [{ id: 'a', text: 'Migrate me' }] }
});

const migratedCrdt = migrateCrdtSnapshot(stateMigrations, crdtSnapshot);
const migratedCache = migrateStateCacheSnapshot(cacheMigrations, cache.extract());

const pathRule = createPatchPathRewriteRule('/todos', '/tasks', { prefix: true });
const migratedLog = migrateEventLogSnapshot(stateMigrations, eventLogSnapshot, {
  patchPathRules: [pathRule]
});
```

`migrateSnapshotPayload(...)` is the generic primitive behind those helpers. It migrates one payload path inside a larger object, writes the current data version back to the container, and can append an inspectable migration history entry. The CRDT/sync/cache/event-log helpers only choose structural defaults:

- sync snapshots: `/snapshot`, `/state`, `/view`, `/data`, or `/cache`
- CRDT snapshots: `/view` first, then snapshot/state/data fallbacks
- state-cache snapshots: root payload, because `entities` and `queries` are the durable cache shape
- event-log snapshots: snapshot payload plus optional patch-path rewrites for replay records

## Design Notes

`frontier-migrations` deliberately owns the import boundary, not long-lived backwards-compatible app branches.

- The app runtime should operate on current data only.
- Importers can read raw database snapshots, CRDT/server snapshots, local cache payloads, plugin payloads, third-party API payloads, fixture files, serialized DOM state, compiled DOM views, and render manifests.
- `createMigrationRegistry(...)` plans deterministic version paths and throws on missing, cyclic, or ambiguous chains.
- `registry.inspect()` and `inspectMigrationRegistry(...)` expose Django/Alembic-style graph diagnostics for branch, head, cycle, wildcard, and unreachable-version checks.
- `migrate(...)` is sync and allocation-light for local storage and plugin adapters.
- `migrateAsync(...)` supports async migration steps for boundary work that must consult external data.
- `createVersionedEnvelope(...)` keeps durable snapshots self-describing without forcing a particular database schema.
- `createMigrationArtifact(...)` keeps compiled renderer artifacts and other non-state payloads self-describing when their native format has its own wire-format version.
- `migrateDomSerializedState(...)`, `migrateDomCompiledView(...)`, and `migrateDomRenderManifest(...)` are structural helpers; they do not import `frontier-dom` and they preserve DOM `version`/manifest `version` fields.
- `migrateSyncableSnapshot(...)`, `migrateCrdtSnapshot(...)`, `migrateStateCacheSnapshot(...)`, and `migrateEventLogSnapshot(...)` keep sync metadata intact while migrating the materialized payload to the current app shape.
- `rewritePatchPaths(...)` and `createPatchPathRewriteRule(...)` update Frontier patch/event-log path references when a schema migration moves a subtree.
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
- [`@shapeshift-labs/frontier-dataflow`](https://www.npmjs.com/package/@shapeshift-labs/frontier-dataflow): Serializable incremental dataflow and materialized-view graphs for Frontier apps, including selectors, dependency DAGs, filters, joins, aggregations, stale paths, recompute budgets, output patches, provenance records, and proof of why derived views changed.
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
- [`@shapeshift-labs/frontier-effects`](https://www.npmjs.com/package/@shapeshift-labs/frontier-effects): Serializable effect descriptors and resource graphs for Frontier apps, including fetch, storage, timers, navigation, workers, clipboard, broadcast, WebSocket, stream, policy metadata, runtime records, redaction, JSONL, proof helpers, and registry graph output.
- [`@shapeshift-labs/frontier-policy`](https://www.npmjs.com/package/@shapeshift-labs/frontier-policy): Serializable policy and capability decisions for Frontier apps, effects, views, sync, routes, traces, and AI tools.
- [`@shapeshift-labs/frontier-tools`](https://www.npmjs.com/package/@shapeshift-labs/frontier-tools): Serializable app action/tool manifests for AI-operable Frontier apps, including availability, validation, dry-run plans, patch previews, effect/tool constraints, execution records, rollback links, and registry graph output.
- [`@shapeshift-labs/frontier-sandbox`](https://www.npmjs.com/package/@shapeshift-labs/frontier-sandbox): Runtime-agnostic sandbox contracts for Frontier patch-producing actions, including manifests, declared reads/writes/capabilities, host-validated patch/effect/event/log results, dynamic source modules, source event replay, and structural runtime adapters.
- [`@shapeshift-labs/frontier-sandbox-quickjs`](https://www.npmjs.com/package/@shapeshift-labs/frontier-sandbox-quickjs): QuickJS/WebAssembly runtime adapter for Frontier sandbox actions, including invocation/runtime isolation modes, deadline and memory limits, dynamic source execution, and patch/effect result normalization.
- [`@shapeshift-labs/frontier-workflow`](https://www.npmjs.com/package/@shapeshift-labs/frontier-workflow): Serializable durable workflow/process manifests for Frontier apps, including steps, waits, approvals, timers, retries, expected patches, compensation, records, timelines, and registry graph output.
- [`@shapeshift-labs/frontier-worker`](https://www.npmjs.com/package/@shapeshift-labs/frontier-worker): Serializable worker and edge task descriptors for Frontier apps, including queues, idempotency keys, retry and timeout policy, declared reads/writes/effects, snapshots, patch outputs, produced assets, execution records, logs, trace links, proof hashes, dedupe indexes, and registry graph output.
- [`@shapeshift-labs/frontier-assets`](https://www.npmjs.com/package/@shapeshift-labs/frontier-assets): Serializable asset and content provenance graphs for Frontier apps, including source files, generated variants, thumbnails, LOD chunks, shader/material dependencies, transforms, hashes, owners, runtime consumers, review plans, registry graph output, and impact queries.
- [`@shapeshift-labs/frontier-triggers`](https://www.npmjs.com/package/@shapeshift-labs/frontier-triggers): Capability-gated event trigger registry, scoped event envelopes, listener/reaction rules, structured rejection, deterministic event-to-action scheduling, replay/provenance records, and registry graph output.
- [`@shapeshift-labs/frontier-virtual`](https://www.npmjs.com/package/@shapeshift-labs/frontier-virtual): DOM-neutral virtualization, layout providers, range materialization, grids, spatial/frustum indexes, patch invalidation, camera anchors, and serializable layout state.
- [`@shapeshift-labs/frontier-scene`](https://www.npmjs.com/package/@shapeshift-labs/frontier-scene): Patch-native 2D/3D scene graph, transform propagation, bounds queries, virtual/culling adapters, spatial invalidation, and camera/frustum materialization.
- [`@shapeshift-labs/frontier-pathfinding`](https://www.npmjs.com/package/@shapeshift-labs/frontier-pathfinding): Patch-native grid pathfinding, typed-array A*/Dijkstra search, flow fields, connected components, line-of-sight smoothing, dirty-cell invalidation, and scheduler-friendly path jobs.
- [`@shapeshift-labs/frontier-lod`](https://www.npmjs.com/package/@shapeshift-labs/frontier-lod): Patch-native level-of-detail and significance selection for rendering and computation workloads, compact typed hot paths, multi-observer selection, budget degradation, materialization frames, and scheduler work plans.
- [`@shapeshift-labs/frontier-route`](https://www.npmjs.com/package/@shapeshift-labs/frontier-route): DOM-neutral app/game route resources, route and scene manifests, match/resolve/transition planning, dependency metadata, sessions, registry graph output, and impact queries.
- [`@shapeshift-labs/frontier-trace`](https://www.npmjs.com/package/@shapeshift-labs/frontier-trace): Serializable traces, spans, events, causal links, W3C trace context helpers, timeline/resource/path queries, critical-path analysis, registry graph output, JSONL/proof helpers, Chrome trace export, and redaction for app-wide feature observability.
- [`@shapeshift-labs/frontier-manifest`](https://www.npmjs.com/package/@shapeshift-labs/frontier-manifest): Build/static feature manifests for owners, routes, actions, states, migrations, tests, source files, assets, resources, tasks, dependency metadata, registry graph output, feature maps, JSONL export, and impact queries.
- [`@shapeshift-labs/frontier-view`](https://www.npmjs.com/package/@shapeshift-labs/frontier-view): Renderer-neutral view manifests, type defaults, validation frames, action bindings, visual channels, virtual/LOD hints, and data-to-representation mapping for Frontier apps.
- [`@shapeshift-labs/frontier-dom`](https://www.npmjs.com/package/@shapeshift-labs/frontier-dom): Patch-native DOM and host renderer bindings, manifest hydration, JSX runtime/compiler helpers, SSR, devtools, and logging bridges.
- [`@shapeshift-labs/frontier-playwright`](https://www.npmjs.com/package/@shapeshift-labs/frontier-playwright): Playwright/headless automation probes for Frontier state, DOM, devtools, marks, and timeline queries.
- [`@shapeshift-labs/frontier-test`](https://www.npmjs.com/package/@shapeshift-labs/frontier-test): Serializable test/spec evidence manifests for Frontier apps, including fixtures, commands, expected patches/effects/routes/policies, coverage declarations, run plans, run records, report adapters, replay proofs, fuzzers, benchmarks, registry graph output, and impact queries.
- [`@shapeshift-labs/frontier-history`](https://www.npmjs.com/package/@shapeshift-labs/frontier-history): Serializable temporal explanation and causality records for Frontier apps, including field-change explanations, action/workflow/policy/effect/trace/test provenance, audit windows, undo planning, registry/provenance graph output, JSONL replay bundles, and proof hashes.
- [`@shapeshift-labs/frontier-application`](https://www.npmjs.com/package/@shapeshift-labs/frontier-application): Serializable whole-application graph and impact queries for Frontier apps, including features, owners, packages, routes, views, actions, mutations, state paths, effects, workers, assets, tests, traces, policies, workflows, migrations, benchmarks, registry graph output, feature maps, JSONL bundles, and proof hashes.
- [`@shapeshift-labs/frontier-linter`](https://www.npmjs.com/package/@shapeshift-labs/frontier-linter): Serializable Frontier lint rules, diagnostics, fixes, reports, and fast rule execution for package catalogs, registry graphs, application maps, manifests, traces, policies, workflows, workers, assets, tests, benchmarks, and source snippets.
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
- [`siliconjungle/siliconjungle--shapeshift-labs-frontier-dataflow`](https://github.com/siliconjungle/siliconjungle--shapeshift-labs-frontier-dataflow)
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
- [`siliconjungle/-shapeshift-labs-frontier-effects`](https://github.com/siliconjungle/-shapeshift-labs-frontier-effects)
- [`siliconjungle/-shapeshift-labs-frontier-policy`](https://github.com/siliconjungle/-shapeshift-labs-frontier-policy)
- [`siliconjungle/-shapeshift-labs-frontier-tools`](https://github.com/siliconjungle/-shapeshift-labs-frontier-tools)
- [`siliconjungle/-shapeshift-labs-frontier-sandbox`](https://github.com/siliconjungle/-shapeshift-labs-frontier-sandbox)
- [`siliconjungle/-shapeshift-labs-frontier-sandbox-quickjs`](https://github.com/siliconjungle/-shapeshift-labs-frontier-sandbox-quickjs)
- [`siliconjungle/-shapeshift-labs-frontier-workflow`](https://github.com/siliconjungle/-shapeshift-labs-frontier-workflow)
- [`siliconjungle/siliconjungle--shapeshift-labs-frontier-worker`](https://github.com/siliconjungle/siliconjungle--shapeshift-labs-frontier-worker)
- [`siliconjungle/-shapeshift-labs-frontier-assets`](https://github.com/siliconjungle/-shapeshift-labs-frontier-assets)
- [`siliconjungle/-shapeshift-labs-frontier-triggers`](https://github.com/siliconjungle/-shapeshift-labs-frontier-triggers)
- [`siliconjungle/-shapeshift-labs-frontier-virtual`](https://github.com/siliconjungle/-shapeshift-labs-frontier-virtual)
- [`siliconjungle/-shapeshift-labs-frontier-scene`](https://github.com/siliconjungle/-shapeshift-labs-frontier-scene)
- [`siliconjungle/-shapeshift-labs-frontier-pathfinding`](https://github.com/siliconjungle/-shapeshift-labs-frontier-pathfinding)
- [`siliconjungle/-shapeshift-labs-frontier-lod`](https://github.com/siliconjungle/-shapeshift-labs-frontier-lod)
- [`siliconjungle/-shapeshift-labs-frontier-route`](https://github.com/siliconjungle/-shapeshift-labs-frontier-route)
- [`siliconjungle/-shapeshift-labs-frontier-trace`](https://github.com/siliconjungle/-shapeshift-labs-frontier-trace)
- [`siliconjungle/-shapeshift-labs-frontier-manifest`](https://github.com/siliconjungle/-shapeshift-labs-frontier-manifest)
- [`siliconjungle/-shapeshift-labs-frontier-view`](https://github.com/siliconjungle/-shapeshift-labs-frontier-view)
- [`siliconjungle/-shapeshift-labs-frontier-dom`](https://github.com/siliconjungle/-shapeshift-labs-frontier-dom)
- [`siliconjungle/-shapeshift-labs-frontier-playwright`](https://github.com/siliconjungle/-shapeshift-labs-frontier-playwright)
- [`siliconjungle/-shapeshift-labs-frontier-test`](https://github.com/siliconjungle/-shapeshift-labs-frontier-test)
- [`siliconjungle/siliconjungle--shapeshift-labs-frontier-history`](https://github.com/siliconjungle/siliconjungle--shapeshift-labs-frontier-history)
- [`siliconjungle/siliconjungle--shapeshift-labs-frontier-application`](https://github.com/siliconjungle/siliconjungle--shapeshift-labs-frontier-application)
- [`siliconjungle/-shapeshift-labs-frontier-linter`](https://github.com/siliconjungle/-shapeshift-labs-frontier-linter)
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

The benchmark covers deterministic path planning, explain-only reports, small-object migration, versioned-envelope migration, dry-run migration, serialized DOM state migration, compiled DOM view migration, artifact-wrapper migration, syncable snapshot migration, patch-path rewriting, and a repeated batch import fixture.

Latest local package benchmark on Node v26.1.0, darwin arm64, 10k imported objects and 20 rounds:

| Fixture | Median | p95 |
| --- | ---: | ---: |
| `plan-chain-3` | 25.50 us | 229.12 us |
| `explain-chain-3` | 35.92 us | 166.21 us |
| `migrate-small-object-chain-3` | 20.83 us | 82.67 us |
| `migrate-envelope-chain-3` | 22.04 us | 29.58 us |
| `migrate-dry-run-chain-3` | 19.21 us | 40.08 us |
| `migrate-dom-state-chain-3` | 23.92 us | 114.92 us |
| `migrate-dom-compiled-chain-3` | 22.83 us | 34.29 us |
| `migrate-artifact-chain-3` | 26.83 us | 38.71 us |
| `migrate-sync-snapshot-chain-3` | 29.38 us | 91.88 us |
| `rewrite-patch-paths-100` | 159.96 us | 287.42 us |
| `migrate-batch-10000` | 93.92 ms | 94.10 ms |
