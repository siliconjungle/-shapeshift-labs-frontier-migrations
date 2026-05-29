export type FrontierMigrationVersion = string | number;
export type FrontierMigrationPathPart = string | number;
export type FrontierMigrationPath = string | readonly FrontierMigrationPathPart[];
export type FrontierMigrationDirection = 'up';
export type FrontierMigrationPhase = 'before' | 'after';

export interface FrontierMigrationStepTrace {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly direction: FrontierMigrationDirection;
  readonly checksum: string;
  readonly reads: readonly FrontierMigrationPath[];
  readonly writes: readonly FrontierMigrationPath[];
  readonly elapsedMs: number;
}

export interface FrontierMigrationWarning {
  readonly stepId?: string;
  readonly message: string;
  readonly path?: FrontierMigrationPath;
  readonly detail?: unknown;
}

export interface FrontierMigrationReport {
  readonly kind: 'frontier.migration.report';
  readonly registryId: string;
  readonly source?: string;
  readonly plugin?: string;
  readonly api?: string;
  readonly actor?: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly targetVersion: string;
  readonly changed: boolean;
  readonly dryRun: boolean;
  readonly stepCount: number;
  readonly steps: readonly FrontierMigrationStepTrace[];
  readonly warnings: readonly FrontierMigrationWarning[];
  readonly elapsedMs: number;
  readonly metadata?: unknown;
}

export interface FrontierMigrationResult<T = unknown> {
  readonly kind: 'frontier.migration.result';
  readonly data: T;
  readonly version: string;
  readonly changed: boolean;
  readonly report: FrontierMigrationReport;
  readonly envelope: FrontierMigrationEnvelope<T>;
}

export interface FrontierMigrationEnvelope<T = unknown> {
  readonly kind: 'frontier.migration.envelope';
  readonly envelopeVersion: 1;
  readonly dataVersion: string;
  readonly data: T;
  readonly source?: string;
  readonly plugin?: string;
  readonly api?: string;
  readonly metadata?: unknown;
}

export type FrontierMigrationArtifactKind =
  | 'state'
  | 'frontier.dom.state'
  | 'frontier.dom.compiled'
  | 'frontier.dom.manifest'
  | (string & {});

export interface FrontierMigrationArtifact<T = unknown> {
  readonly kind: 'frontier.migration.artifact';
  readonly artifactVersion: string;
  readonly artifactKind: FrontierMigrationArtifactKind;
  readonly payload: T;
  readonly source?: string;
  readonly plugin?: string;
  readonly api?: string;
  readonly metadata?: unknown;
}

export interface FrontierMigrationArtifactResult<T = unknown> extends FrontierMigrationResult<T> {
  readonly artifact: FrontierMigrationArtifact<T>;
}

export interface FrontierDomSerializedStateLike {
  readonly kind: 'frontier.dom.state';
  readonly version: number;
  readonly manifest: unknown;
  readonly source?: unknown;
  readonly html?: string;
  readonly snapshot?: unknown;
  readonly layout?: unknown;
  readonly [key: string]: unknown;
}

export interface FrontierDomCompiledViewLike {
  readonly html: string;
  readonly manifest: unknown;
  readonly diagnostics?: unknown;
  readonly [key: string]: unknown;
}

export interface FrontierDomRenderManifestLike {
  readonly version?: unknown;
  readonly source?: unknown;
  readonly [key: string]: unknown;
}

export interface FrontierDomMigrationOptions extends FrontierMigrationRunOptions {
  readonly dataVersionPaths?: readonly FrontierMigrationPath[];
}

export interface FrontierMigrationContext<T = unknown> {
  readonly registryId: string;
  readonly migrationId: string;
  readonly source?: string;
  readonly plugin?: string;
  readonly api?: string;
  readonly actor?: string;
  readonly metadata?: unknown;
  readonly dryRun: boolean;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly targetVersion: string;
  readonly stepIndex: number;
  readonly stepCount: number;
  read(path: FrontierMigrationPath, fallback?: unknown): unknown;
  write(path: FrontierMigrationPath, value: unknown): void;
  remove(path: FrontierMigrationPath): void;
  rename(from: FrontierMigrationPath, to: FrontierMigrationPath, fallback?: unknown): void;
  warn(message: string, detail?: Omit<FrontierMigrationWarning, 'message' | 'stepId'>): void;
}

export interface FrontierMigration<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly from: FrontierMigrationVersion | readonly FrontierMigrationVersion[] | '*';
  readonly to: FrontierMigrationVersion;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly reads?: readonly FrontierMigrationPath[];
  readonly writes?: readonly FrontierMigrationPath[];
  readonly checksum?: string;
  readonly irreversible?: boolean;
  up(input: TInput, ctx: FrontierMigrationContext<TInput>): TOutput | void | Promise<TOutput | void>;
  down?: (input: TOutput, ctx: FrontierMigrationContext<TOutput>) => TInput | void | Promise<TInput | void>;
}

export interface FrontierMigrationRegistryOptions {
  readonly id?: string;
  readonly currentVersion: FrontierMigrationVersion;
  readonly initialVersion?: FrontierMigrationVersion;
  readonly versionPath?: FrontierMigrationPath | false;
  readonly migrations?: readonly FrontierMigration<any, any>[];
  readonly clone?: <T>(value: T) => T;
  readonly getVersion?: (data: unknown, options: FrontierMigrationRunOptions) => FrontierMigrationVersion | undefined;
  readonly setVersion?: (data: unknown, version: string, options: FrontierMigrationRunOptions) => void;
  readonly validate?: (data: unknown, version: string, phase: FrontierMigrationPhase, context: FrontierMigrationValidationContext) => void;
}

export interface FrontierMigrationValidationContext {
  readonly registryId: string;
  readonly source?: string;
  readonly plugin?: string;
  readonly api?: string;
  readonly metadata?: unknown;
}

export interface FrontierMigrationRunOptions {
  readonly source?: string;
  readonly plugin?: string;
  readonly api?: string;
  readonly actor?: string;
  readonly metadata?: unknown;
  readonly targetVersion?: FrontierMigrationVersion;
  readonly initialVersion?: FrontierMigrationVersion;
  readonly versionPath?: FrontierMigrationPath | false;
  readonly dryRun?: boolean;
  readonly writeVersion?: boolean;
  readonly clone?: <T>(value: T) => T;
  readonly getVersion?: (data: unknown, options: FrontierMigrationRunOptions) => FrontierMigrationVersion | undefined;
  readonly setVersion?: (data: unknown, version: string, options: FrontierMigrationRunOptions) => void;
  readonly validate?: (data: unknown, version: string, phase: FrontierMigrationPhase, context: FrontierMigrationValidationContext) => void;
  readonly onStep?: (step: FrontierMigrationStepTrace) => void;
  readonly onReport?: (report: FrontierMigrationReport) => void;
}

export interface FrontierMigrationPlan {
  readonly kind: 'frontier.migration.plan';
  readonly registryId: string;
  readonly fromVersion: string;
  readonly targetVersion: string;
  readonly migrations: readonly FrontierMigration<any, any>[];
  readonly checksums: readonly string[];
}

export interface FrontierMigrationRegistry<TCurrent = unknown> {
  readonly id: string;
  readonly currentVersion: string;
  readonly migrations: readonly FrontierMigration<any, any>[];
  plan(fromVersion: FrontierMigrationVersion, options?: Pick<FrontierMigrationRunOptions, 'targetVersion'>): FrontierMigrationPlan;
  explain(input: unknown, options?: FrontierMigrationRunOptions): FrontierMigrationReport;
  migrate<T = unknown>(input: T, options?: FrontierMigrationRunOptions): FrontierMigrationResult<TCurrent>;
  migrateAsync<T = unknown>(input: T, options?: FrontierMigrationRunOptions): Promise<FrontierMigrationResult<TCurrent>>;
  boundary<T = unknown>(boundary: FrontierMigrationBoundaryOptions<T, TCurrent>): FrontierMigrationBoundary<T, TCurrent>;
  adapter<T = unknown>(adapter: FrontierPluginAdapterOptions<T, TCurrent>): FrontierPluginAdapter<T, TCurrent>;
}

export interface FrontierMigrationBoundaryOptions<TInput = unknown, TCurrent = unknown> {
  readonly source?: string;
  readonly read?: () => TInput | Promise<TInput>;
  readonly write?: (data: TCurrent, result: FrontierMigrationResult<TCurrent>) => void | Promise<void>;
  readonly options?: FrontierMigrationRunOptions;
}

export interface FrontierMigrationBoundary<TInput = unknown, TCurrent = unknown> {
  readonly source?: string;
  import(input: TInput, options?: FrontierMigrationRunOptions): FrontierMigrationResult<TCurrent>;
  importAsync(input?: TInput, options?: FrontierMigrationRunOptions): Promise<FrontierMigrationResult<TCurrent>>;
}

export interface FrontierPluginAdapterOptions<TInput = unknown, TCurrent = unknown> {
  readonly plugin: string;
  readonly api?: string;
  readonly source?: string;
  readonly mapInput?: (input: TInput) => unknown;
  readonly mapOutput?: (result: FrontierMigrationResult<TCurrent>) => unknown;
  readonly options?: FrontierMigrationRunOptions;
}

export interface FrontierPluginAdapter<TInput = unknown, TCurrent = unknown> {
  readonly plugin: string;
  readonly api?: string;
  adapt(input: TInput, options?: FrontierMigrationRunOptions): FrontierMigrationResult<TCurrent>;
  adaptAsync(input: TInput, options?: FrontierMigrationRunOptions): Promise<FrontierMigrationResult<TCurrent>>;
  map(input: TInput, options?: FrontierMigrationRunOptions): unknown;
}

export interface FrontierMigrationLedgerRecord {
  readonly id: string;
  readonly report: FrontierMigrationReport;
}

export interface FrontierMigrationLedger {
  readonly records: readonly FrontierMigrationLedgerRecord[];
  append(report: FrontierMigrationReport): FrontierMigrationLedgerRecord;
  bySource(source: string): readonly FrontierMigrationLedgerRecord[];
  clear(): void;
}

export interface RenameFieldMigrationOptions {
  readonly id: string;
  readonly from: FrontierMigrationVersion | readonly FrontierMigrationVersion[] | '*';
  readonly to: FrontierMigrationVersion;
  readonly path: FrontierMigrationPath;
  readonly fromField: FrontierMigrationPathPart;
  readonly toField: FrontierMigrationPathPart;
  readonly description?: string;
}

export interface DefaultValueMigrationOptions {
  readonly id: string;
  readonly from: FrontierMigrationVersion | readonly FrontierMigrationVersion[] | '*';
  readonly to: FrontierMigrationVersion;
  readonly path: FrontierMigrationPath;
  readonly value: unknown | (() => unknown);
  readonly description?: string;
}

export interface PathMoveMigrationOptions {
  readonly id: string;
  readonly from: FrontierMigrationVersion | readonly FrontierMigrationVersion[] | '*';
  readonly to: FrontierMigrationVersion;
  readonly read: FrontierMigrationPath;
  readonly write: FrontierMigrationPath;
  readonly fallback?: unknown;
  readonly description?: string;
}

export class FrontierMigrationError extends Error {
  readonly code: string;
  readonly detail?: unknown;

  constructor(code: string, message: string, detail?: unknown) {
    super(message);
    this.name = 'FrontierMigrationError';
    this.code = code;
    this.detail = detail;
  }
}

const ENVELOPE_KIND = 'frontier.migration.envelope';
const ARTIFACT_KIND = 'frontier.migration.artifact';
const RESULT_KIND = 'frontier.migration.result';
const REPORT_KIND = 'frontier.migration.report';
const PLAN_KIND = 'frontier.migration.plan';
const DEFAULT_VERSION_PATH: readonly FrontierMigrationPathPart[] = ['$version'];
const DOM_STATE_VERSION_PATHS: readonly FrontierMigrationPath[] = ['/source/dataVersion', '/manifest/source/dataVersion', '/metadata/dataVersion'];
const DOM_STATE_WRITE_PATHS: readonly FrontierMigrationPath[] = ['/source/dataVersion'];
const DOM_STATE_MIRROR_PATHS: readonly FrontierMigrationPath[] = ['/manifest/source/dataVersion'];
const DOM_COMPILED_VERSION_PATHS: readonly FrontierMigrationPath[] = ['/manifest/source/dataVersion', '/source/dataVersion', '/metadata/dataVersion'];
const DOM_COMPILED_WRITE_PATHS: readonly FrontierMigrationPath[] = ['/manifest/source/dataVersion'];
const DOM_MANIFEST_VERSION_PATHS: readonly FrontierMigrationPath[] = ['/source/dataVersion', '/metadata/dataVersion'];
const DOM_MANIFEST_WRITE_PATHS: readonly FrontierMigrationPath[] = ['/source/dataVersion'];

export function createMigrationRegistry<TCurrent = unknown>(
  options: FrontierMigrationRegistryOptions
): FrontierMigrationRegistry<TCurrent> {
  const registryId = options.id || 'frontier.migrations';
  const currentVersion = normalizeVersion(options.currentVersion);
  const migrations = Object.freeze((options.migrations || []).slice());
  assertMigrationGraph(registryId, migrations);

  function plan(fromVersion: FrontierMigrationVersion, planOptions: Pick<FrontierMigrationRunOptions, 'targetVersion'> = {}): FrontierMigrationPlan {
    const start = normalizeVersion(fromVersion);
    const target = normalizeVersion(planOptions.targetVersion ?? currentVersion);
    const path = planMigrationPath(registryId, migrations, start, target);
    return {
      kind: PLAN_KIND,
      registryId,
      fromVersion: start,
      targetVersion: target,
      migrations: path,
      checksums: path.map(createMigrationChecksum)
    };
  }

  function explain(input: unknown, runOptions: FrontierMigrationRunOptions = {}): FrontierMigrationReport {
    const resolved = resolveInput(input, options, runOptions);
    const target = normalizeVersion(runOptions.targetVersion ?? currentVersion);
    const migrationPlan = plan(resolved.fromVersion, { targetVersion: target });
    return createReport({
      registryId,
      options: runOptions,
      fromVersion: resolved.fromVersion,
      targetVersion: target,
      toVersion: migrationPlan.migrations.length === 0 ? resolved.fromVersion : target,
      changed: migrationPlan.migrations.length > 0,
      dryRun: runOptions.dryRun === true,
      steps: migrationPlan.migrations.map((migration) => ({
        id: migration.id,
        from: primaryFromVersion(migration.from, resolved.fromVersion),
        to: normalizeVersion(migration.to),
        direction: 'up',
        checksum: createMigrationChecksum(migration),
        reads: migration.reads || [],
        writes: migration.writes || [],
        elapsedMs: 0
      })),
      warnings: [],
      elapsedMs: 0
    });
  }

  function migrate<T = unknown>(input: T, runOptions: FrontierMigrationRunOptions = {}): FrontierMigrationResult<TCurrent> {
    return runMigrationsSync<TCurrent>(registryId, currentVersion, migrations, input, options, runOptions);
  }

  async function migrateAsync<T = unknown>(
    input: T,
    runOptions: FrontierMigrationRunOptions = {}
  ): Promise<FrontierMigrationResult<TCurrent>> {
    return runMigrationsAsync<TCurrent>(registryId, currentVersion, migrations, input, options, runOptions);
  }

  function boundary<T = unknown>(boundaryOptions: FrontierMigrationBoundaryOptions<T, TCurrent>): FrontierMigrationBoundary<T, TCurrent> {
    return createMigrationBoundary<T, TCurrent>({
      ...boundaryOptions,
      registry: registry as FrontierMigrationRegistry<TCurrent>
    });
  }

  function adapter<T = unknown>(adapterOptions: FrontierPluginAdapterOptions<T, TCurrent>): FrontierPluginAdapter<T, TCurrent> {
    return createPluginAdapter<T, TCurrent>({
      ...adapterOptions,
      registry: registry as FrontierMigrationRegistry<TCurrent>
    });
  }

  const registry: FrontierMigrationRegistry<TCurrent> = {
    id: registryId,
    currentVersion,
    migrations,
    plan,
    explain,
    migrate,
    migrateAsync,
    boundary,
    adapter
  };
  return registry;
}

export function migrateToCurrent<TCurrent = unknown>(
  input: unknown,
  options: FrontierMigrationRegistryOptions & FrontierMigrationRunOptions
): FrontierMigrationResult<TCurrent> {
  return createMigrationRegistry<TCurrent>(options).migrate(input, options);
}

export function migrateToCurrentAsync<TCurrent = unknown>(
  input: unknown,
  options: FrontierMigrationRegistryOptions & FrontierMigrationRunOptions
): Promise<FrontierMigrationResult<TCurrent>> {
  return createMigrationRegistry<TCurrent>(options).migrateAsync(input, options);
}

export function createMigrationBoundary<TInput = unknown, TCurrent = unknown>(
  options: FrontierMigrationBoundaryOptions<TInput, TCurrent> & { readonly registry: FrontierMigrationRegistry<TCurrent> }
): FrontierMigrationBoundary<TInput, TCurrent> {
  return {
    source: options.source,
    import(input: TInput, runOptions: FrontierMigrationRunOptions = {}) {
      const result = options.registry.migrate<TInput>(input, mergeRunOptions(options.options, {
        ...runOptions,
        source: runOptions.source ?? options.source
      }));
      if (options.write) {
        const written = options.write(result.data, result);
        if (isPromiseLike(written)) {
          throw new FrontierMigrationError('async-write-in-sync-boundary', 'Migration boundary write returned a promise; use importAsync().');
        }
      }
      return result;
    },
    async importAsync(input?: TInput, runOptions: FrontierMigrationRunOptions = {}) {
      const inbound = input === undefined
        ? await readRequired(options)
        : input;
      const result = await options.registry.migrateAsync<TInput>(inbound, mergeRunOptions(options.options, {
        ...runOptions,
        source: runOptions.source ?? options.source
      }));
      if (options.write) await options.write(result.data, result);
      return result;
    }
  };
}

export function createPluginAdapter<TInput = unknown, TCurrent = unknown>(
  options: FrontierPluginAdapterOptions<TInput, TCurrent> & { readonly registry: FrontierMigrationRegistry<TCurrent> }
): FrontierPluginAdapter<TInput, TCurrent> {
  const baseOptions = mergeRunOptions(options.options, {
    source: options.source ?? 'plugin',
    plugin: options.plugin,
    api: options.api
  });
  return {
    plugin: options.plugin,
    api: options.api,
    adapt(input: TInput, runOptions: FrontierMigrationRunOptions = {}) {
      return options.registry.migrate(options.mapInput ? options.mapInput(input) : input, mergeRunOptions(baseOptions, runOptions));
    },
    async adaptAsync(input: TInput, runOptions: FrontierMigrationRunOptions = {}) {
      return options.registry.migrateAsync(options.mapInput ? options.mapInput(input) : input, mergeRunOptions(baseOptions, runOptions));
    },
    map(input: TInput, runOptions: FrontierMigrationRunOptions = {}) {
      const result = options.registry.migrate(options.mapInput ? options.mapInput(input) : input, mergeRunOptions(baseOptions, runOptions));
      return options.mapOutput ? options.mapOutput(result) : result.data;
    }
  };
}

export function createVersionedEnvelope<T>(
  dataVersion: FrontierMigrationVersion,
  data: T,
  options: Pick<FrontierMigrationEnvelope<T>, 'source' | 'plugin' | 'api' | 'metadata'> = {}
): FrontierMigrationEnvelope<T> {
  return {
    kind: ENVELOPE_KIND,
    envelopeVersion: 1,
    dataVersion: normalizeVersion(dataVersion),
    data,
    ...definedObject(options)
  };
}

export function isVersionedEnvelope(value: unknown): value is FrontierMigrationEnvelope {
  return isObject(value)
    && (value as { kind?: unknown }).kind === ENVELOPE_KIND
    && (value as { envelopeVersion?: unknown }).envelopeVersion === 1
    && typeof (value as { dataVersion?: unknown }).dataVersion === 'string'
    && 'data' in value;
}

export function readEnvelopeVersion(value: unknown): string | undefined {
  return isVersionedEnvelope(value) ? value.dataVersion : undefined;
}

export function createMigrationArtifact<T>(
  artifactKind: FrontierMigrationArtifactKind,
  artifactVersion: FrontierMigrationVersion,
  payload: T,
  options: Pick<FrontierMigrationArtifact<T>, 'source' | 'plugin' | 'api' | 'metadata'> = {}
): FrontierMigrationArtifact<T> {
  return {
    kind: ARTIFACT_KIND,
    artifactVersion: normalizeVersion(artifactVersion),
    artifactKind,
    payload,
    ...definedObject(options)
  };
}

export function isMigrationArtifact(value: unknown): value is FrontierMigrationArtifact {
  return isObject(value)
    && (value as { kind?: unknown }).kind === ARTIFACT_KIND
    && typeof (value as { artifactVersion?: unknown }).artifactVersion === 'string'
    && typeof (value as { artifactKind?: unknown }).artifactKind === 'string'
    && 'payload' in value;
}

export function readArtifactVersion(value: unknown): string | undefined {
  return isMigrationArtifact(value) ? value.artifactVersion : undefined;
}

export function migrateArtifact<TCurrent = unknown, TPayload = unknown>(
  registry: FrontierMigrationRegistry<TCurrent>,
  artifact: FrontierMigrationArtifact<TPayload>,
  options: FrontierMigrationRunOptions = {}
): FrontierMigrationArtifactResult<TCurrent> {
  const envelope = createVersionedEnvelope(artifact.artifactVersion, artifact.payload, {
    source: artifact.source ?? artifact.artifactKind,
    plugin: artifact.plugin,
    api: artifact.api,
    metadata: artifact.metadata
  });
  const result = registry.migrate<FrontierMigrationEnvelope<TPayload>>(envelope, artifactRunOptions(artifact, options));
  return {
    ...result,
    artifact: createMigrationArtifact(artifact.artifactKind, result.version, result.data, {
      source: result.report.source,
      plugin: result.report.plugin,
      api: result.report.api,
      metadata: result.report.metadata ?? artifact.metadata
    })
  };
}

export async function migrateArtifactAsync<TCurrent = unknown, TPayload = unknown>(
  registry: FrontierMigrationRegistry<TCurrent>,
  artifact: FrontierMigrationArtifact<TPayload>,
  options: FrontierMigrationRunOptions = {}
): Promise<FrontierMigrationArtifactResult<TCurrent>> {
  const envelope = createVersionedEnvelope(artifact.artifactVersion, artifact.payload, {
    source: artifact.source ?? artifact.artifactKind,
    plugin: artifact.plugin,
    api: artifact.api,
    metadata: artifact.metadata
  });
  const result = await registry.migrateAsync<FrontierMigrationEnvelope<TPayload>>(envelope, artifactRunOptions(artifact, options));
  return {
    ...result,
    artifact: createMigrationArtifact(artifact.artifactKind, result.version, result.data, {
      source: result.report.source,
      plugin: result.report.plugin,
      api: result.report.api,
      metadata: result.report.metadata ?? artifact.metadata
    })
  };
}

export function readDomDataVersion(
  value: unknown,
  options: Pick<FrontierDomMigrationOptions, 'dataVersionPaths'> = {}
): string | undefined {
  const version = readFirstMigrationVersion(value, options.dataVersionPaths ?? DOM_STATE_VERSION_PATHS);
  return version === undefined ? undefined : normalizeVersion(version);
}

export function writeDomDataVersion(
  value: unknown,
  version: FrontierMigrationVersion,
  options: Pick<FrontierDomMigrationOptions, 'dataVersionPaths'> = {}
): void {
  writeMigrationVersionPaths(value, normalizeVersion(version), options.dataVersionPaths ?? DOM_STATE_WRITE_PATHS, []);
}

export function migrateDomSerializedState<TCurrent = FrontierDomSerializedStateLike>(
  registry: FrontierMigrationRegistry<TCurrent>,
  state: FrontierDomSerializedStateLike,
  options: FrontierDomMigrationOptions = {}
): FrontierMigrationResult<TCurrent> {
  return registry.migrate(state, domRunOptions('frontier.dom.state', DOM_STATE_VERSION_PATHS, DOM_STATE_WRITE_PATHS, DOM_STATE_MIRROR_PATHS, options));
}

export function migrateDomSerializedStateAsync<TCurrent = FrontierDomSerializedStateLike>(
  registry: FrontierMigrationRegistry<TCurrent>,
  state: FrontierDomSerializedStateLike,
  options: FrontierDomMigrationOptions = {}
): Promise<FrontierMigrationResult<TCurrent>> {
  return registry.migrateAsync(state, domRunOptions('frontier.dom.state', DOM_STATE_VERSION_PATHS, DOM_STATE_WRITE_PATHS, DOM_STATE_MIRROR_PATHS, options));
}

export function migrateDomCompiledView<TCurrent = FrontierDomCompiledViewLike>(
  registry: FrontierMigrationRegistry<TCurrent>,
  view: FrontierDomCompiledViewLike,
  options: FrontierDomMigrationOptions = {}
): FrontierMigrationResult<TCurrent> {
  return registry.migrate(view, domRunOptions('frontier.dom.compiled', DOM_COMPILED_VERSION_PATHS, DOM_COMPILED_WRITE_PATHS, [], options));
}

export function migrateDomCompiledViewAsync<TCurrent = FrontierDomCompiledViewLike>(
  registry: FrontierMigrationRegistry<TCurrent>,
  view: FrontierDomCompiledViewLike,
  options: FrontierDomMigrationOptions = {}
): Promise<FrontierMigrationResult<TCurrent>> {
  return registry.migrateAsync(view, domRunOptions('frontier.dom.compiled', DOM_COMPILED_VERSION_PATHS, DOM_COMPILED_WRITE_PATHS, [], options));
}

export function migrateDomRenderManifest<TCurrent = FrontierDomRenderManifestLike>(
  registry: FrontierMigrationRegistry<TCurrent>,
  manifest: FrontierDomRenderManifestLike,
  options: FrontierDomMigrationOptions = {}
): FrontierMigrationResult<TCurrent> {
  return registry.migrate(manifest, domRunOptions('frontier.dom.manifest', DOM_MANIFEST_VERSION_PATHS, DOM_MANIFEST_WRITE_PATHS, [], options));
}

export function migrateDomRenderManifestAsync<TCurrent = FrontierDomRenderManifestLike>(
  registry: FrontierMigrationRegistry<TCurrent>,
  manifest: FrontierDomRenderManifestLike,
  options: FrontierDomMigrationOptions = {}
): Promise<FrontierMigrationResult<TCurrent>> {
  return registry.migrateAsync(manifest, domRunOptions('frontier.dom.manifest', DOM_MANIFEST_VERSION_PATHS, DOM_MANIFEST_WRITE_PATHS, [], options));
}

export function normalizeMigrationVersion(version: FrontierMigrationVersion): string {
  return normalizeVersion(version);
}

export function parseMigrationPath(path: FrontierMigrationPath): FrontierMigrationPathPart[] {
  if (typeof path !== 'string') return path.slice();
  if (path === '') return [];
  if (path[0] === '/') {
    if (path === '/') return [''];
    return path.slice(1).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  }
  if (path.includes('.')) return path.split('.').filter((part) => part.length > 0);
  return [path];
}

export function readMigrationPath(root: unknown, path: FrontierMigrationPath, fallback?: unknown): unknown {
  const parts = parseMigrationPath(path);
  let cursor = root as Record<PropertyKey, unknown> | undefined | null;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return fallback;
    if (!(part in cursor)) return fallback;
    cursor = cursor[part] as Record<PropertyKey, unknown> | undefined | null;
  }
  return cursor === undefined ? fallback : cursor;
}

export function writeMigrationPath(root: unknown, path: FrontierMigrationPath, value: unknown): void {
  const parts = parseMigrationPath(path);
  if (parts.length === 0) {
    throw new FrontierMigrationError('root-write-not-supported', 'writeMigrationPath cannot replace the root object; return a new value from the migration instead.');
  }
  const parent = ensurePathParent(root, parts);
  parent[parts[parts.length - 1] as PropertyKey] = value;
}

export function removeMigrationPath(root: unknown, path: FrontierMigrationPath): void {
  const parts = parseMigrationPath(path);
  if (parts.length === 0) return;
  let cursor = root as Record<PropertyKey, unknown> | undefined | null;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cursor == null || typeof cursor !== 'object') return;
    cursor = cursor[parts[i] as PropertyKey] as Record<PropertyKey, unknown> | undefined | null;
  }
  if (cursor == null || typeof cursor !== 'object') return;
  const key = parts[parts.length - 1] as PropertyKey;
  if (Array.isArray(cursor) && typeof key === 'number') cursor.splice(key, 1);
  else delete cursor[key];
}

export function renameMigrationPath(root: unknown, from: FrontierMigrationPath, to: FrontierMigrationPath, fallback?: unknown): void {
  const value = readMigrationPath(root, from, fallback);
  if (value === fallback) return;
  writeMigrationPath(root, to, value);
  removeMigrationPath(root, from);
}

export function createRenameFieldMigration(options: RenameFieldMigrationOptions): FrontierMigration {
  const fromPath = appendPath(options.path, options.fromField);
  const toPath = appendPath(options.path, options.toField);
  return {
    id: options.id,
    from: options.from,
    to: options.to,
    description: options.description,
    reads: [fromPath],
    writes: [toPath],
    up(data, ctx) {
      ctx.rename(fromPath, toPath);
      return data;
    }
  };
}

export function createDefaultValueMigration(options: DefaultValueMigrationOptions): FrontierMigration {
  return {
    id: options.id,
    from: options.from,
    to: options.to,
    description: options.description,
    reads: [options.path],
    writes: [options.path],
    up(data, ctx) {
      if (ctx.read(options.path, undefined) === undefined) {
        ctx.write(options.path, typeof options.value === 'function' ? (options.value as () => unknown)() : cloneDefault(options.value));
      }
      return data;
    }
  };
}

export function createPathMoveMigration(options: PathMoveMigrationOptions): FrontierMigration {
  return {
    id: options.id,
    from: options.from,
    to: options.to,
    description: options.description,
    reads: [options.read],
    writes: [options.write],
    up(data, ctx) {
      ctx.rename(options.read, options.write, options.fallback);
      return data;
    }
  };
}

export function createMigrationChecksum(migration: Pick<FrontierMigration, 'id' | 'from' | 'to' | 'description' | 'reads' | 'writes'>): string {
  const text = stableStringify({
    id: migration.id,
    from: migration.from,
    to: normalizeVersion(migration.to),
    description: migration.description || '',
    reads: (migration.reads || []).map(pathKey),
    writes: (migration.writes || []).map(pathKey)
  });
  return fnv1a(text);
}

export function createInMemoryMigrationLedger(): FrontierMigrationLedger {
  const records: FrontierMigrationLedgerRecord[] = [];
  return {
    get records() {
      return records.slice();
    },
    append(report) {
      const record = {
        id: `${report.registryId}:${report.source || 'unknown'}:${report.fromVersion}->${report.toVersion}:${records.length}`,
        report
      };
      records.push(record);
      return record;
    },
    bySource(source) {
      return records.filter((record) => record.report.source === source);
    },
    clear() {
      records.length = 0;
    }
  };
}

function runMigrationsSync<TCurrent>(
  registryId: string,
  currentVersion: string,
  migrations: readonly FrontierMigration[],
  input: unknown,
  registryOptions: FrontierMigrationRegistryOptions,
  runOptions: FrontierMigrationRunOptions
): FrontierMigrationResult<TCurrent> {
  const started = now();
  const warnings: FrontierMigrationWarning[] = [];
  const resolved = resolveInput(input, registryOptions, runOptions);
  const targetVersion = normalizeVersion(runOptions.targetVersion ?? currentVersion);
  const migrationPlan = planMigrationPath(registryId, migrations, resolved.fromVersion, targetVersion);
  const data = runOptions.dryRun === true || isVersionedEnvelope(input)
    ? cloneWithOptions(resolved.data, registryOptions, runOptions)
    : resolved.data;
  validateData(registryId, data, resolved.fromVersion, 'before', registryOptions, runOptions);

  const steps: FrontierMigrationStepTrace[] = [];
  let cursor = data;
  let version = resolved.fromVersion;
  for (let i = 0; i < migrationPlan.length; i++) {
    const migration = migrationPlan[i];
    const stepStarted = now();
    const toVersion = normalizeVersion(migration.to);
    const ctx = createMigrationContext(registryId, migration, cursor, {
      ...runOptions,
      dryRun: runOptions.dryRun === true
    }, {
      fromVersion: version,
      toVersion,
      targetVersion,
      stepIndex: i,
      stepCount: migrationPlan.length,
      warnings
    });
    const output = migration.up(cursor, ctx);
    if (isPromiseLike(output)) {
      throw new FrontierMigrationError('async-migration-in-sync-run', `Migration ${migration.id} returned a promise; use migrateAsync().`);
    }
    if (output !== undefined) cursor = output;
    const fromTraceVersion = version;
    version = toVersion;
    const trace = stepTrace(migration, primaryFromVersion(migration.from, fromTraceVersion), toVersion, stepStarted);
    steps.push(trace);
    runOptions.onStep?.(trace);
  }

  if (runOptions.writeVersion !== false) writeVersion(cursor, targetVersion, registryOptions, runOptions);
  validateData(registryId, cursor, targetVersion, 'after', registryOptions, runOptions);
  const report = createReport({
    registryId,
    options: runOptions,
    fromVersion: resolved.fromVersion,
    targetVersion,
    toVersion: targetVersion,
    changed: migrationPlan.length > 0,
    dryRun: runOptions.dryRun === true,
    steps,
    warnings,
    elapsedMs: now() - started
  });
  runOptions.onReport?.(report);
  return {
    kind: RESULT_KIND,
    data: cursor as TCurrent,
    version: targetVersion,
    changed: migrationPlan.length > 0,
    report,
    envelope: createVersionedEnvelope(targetVersion, cursor as TCurrent, {
      source: runOptions.source,
      plugin: runOptions.plugin,
      api: runOptions.api,
      metadata: runOptions.metadata
    })
  };
}

async function runMigrationsAsync<TCurrent>(
  registryId: string,
  currentVersion: string,
  migrations: readonly FrontierMigration[],
  input: unknown,
  registryOptions: FrontierMigrationRegistryOptions,
  runOptions: FrontierMigrationRunOptions
): Promise<FrontierMigrationResult<TCurrent>> {
  const started = now();
  const warnings: FrontierMigrationWarning[] = [];
  const resolved = resolveInput(input, registryOptions, runOptions);
  const targetVersion = normalizeVersion(runOptions.targetVersion ?? currentVersion);
  const migrationPlan = planMigrationPath(registryId, migrations, resolved.fromVersion, targetVersion);
  const data = runOptions.dryRun === true || isVersionedEnvelope(input)
    ? cloneWithOptions(resolved.data, registryOptions, runOptions)
    : resolved.data;
  validateData(registryId, data, resolved.fromVersion, 'before', registryOptions, runOptions);

  const steps: FrontierMigrationStepTrace[] = [];
  let cursor = data;
  let version = resolved.fromVersion;
  for (let i = 0; i < migrationPlan.length; i++) {
    const migration = migrationPlan[i];
    const stepStarted = now();
    const toVersion = normalizeVersion(migration.to);
    const ctx = createMigrationContext(registryId, migration, cursor, runOptions, {
      fromVersion: version,
      toVersion,
      targetVersion,
      stepIndex: i,
      stepCount: migrationPlan.length,
      warnings
    });
    const output = await migration.up(cursor, ctx);
    if (output !== undefined) cursor = output;
    const fromTraceVersion = version;
    version = toVersion;
    const trace = stepTrace(migration, primaryFromVersion(migration.from, fromTraceVersion), toVersion, stepStarted);
    steps.push(trace);
    runOptions.onStep?.(trace);
  }

  if (runOptions.writeVersion !== false) writeVersion(cursor, targetVersion, registryOptions, runOptions);
  validateData(registryId, cursor, targetVersion, 'after', registryOptions, runOptions);
  const report = createReport({
    registryId,
    options: runOptions,
    fromVersion: resolved.fromVersion,
    targetVersion,
    toVersion: targetVersion,
    changed: migrationPlan.length > 0,
    dryRun: runOptions.dryRun === true,
    steps,
    warnings,
    elapsedMs: now() - started
  });
  runOptions.onReport?.(report);
  return {
    kind: RESULT_KIND,
    data: cursor as TCurrent,
    version: targetVersion,
    changed: migrationPlan.length > 0,
    report,
    envelope: createVersionedEnvelope(targetVersion, cursor as TCurrent, {
      source: runOptions.source,
      plugin: runOptions.plugin,
      api: runOptions.api,
      metadata: runOptions.metadata
    })
  };
}

function resolveInput(
  input: unknown,
  registryOptions: FrontierMigrationRegistryOptions,
  runOptions: FrontierMigrationRunOptions
): { data: unknown; fromVersion: string } {
  if (isVersionedEnvelope(input)) {
    return { data: input.data, fromVersion: normalizeVersion(input.dataVersion) };
  }
  const data = input;
  const getVersion = runOptions.getVersion || registryOptions.getVersion;
  const explicit = getVersion?.(data, runOptions);
  if (explicit !== undefined) return { data, fromVersion: normalizeVersion(explicit) };
  const versionPath = runOptions.versionPath ?? registryOptions.versionPath ?? DEFAULT_VERSION_PATH;
  if (versionPath !== false) {
    const value = readMigrationPath(data, versionPath);
    if (typeof value === 'string' || typeof value === 'number') return { data, fromVersion: normalizeVersion(value) };
  }
  const fallback = runOptions.initialVersion ?? registryOptions.initialVersion;
  if (fallback !== undefined) return { data, fromVersion: normalizeVersion(fallback) };
  throw new FrontierMigrationError(
    'missing-version',
    'Imported data has no version. Provide an envelope, versionPath, getVersion, or initialVersion.'
  );
}

function planMigrationPath(
  registryId: string,
  migrations: readonly FrontierMigration<any, any>[],
  fromVersion: string,
  targetVersion: string
): FrontierMigration<any, any>[] {
  if (fromVersion === targetVersion) return [];
  const path: FrontierMigration[] = [];
  const visited = new Set<string>();
  let current = fromVersion;
  while (current !== targetVersion) {
    if (visited.has(current)) {
      throw new FrontierMigrationError('cycle', `Migration graph ${registryId} contains a cycle at version ${current}.`);
    }
    visited.add(current);
    const exact = migrations.filter((migration) => migrationMatchesFrom(migration, current));
    const candidates = exact.length > 0 ? exact : migrations.filter((migration) => migration.from === '*');
    if (candidates.length === 0) {
      throw new FrontierMigrationError('missing-step', `No migration step from ${current} to ${targetVersion}.`, { fromVersion, targetVersion, current });
    }
    const next = candidates.find((migration) => normalizeVersion(migration.to) === targetVersion) ?? candidates[0];
    if (candidates.length > 1 && !candidates.some((migration) => normalizeVersion(migration.to) === targetVersion)) {
      throw new FrontierMigrationError('ambiguous-step', `Multiple migration steps start at ${current}; add an explicit step to ${targetVersion} or split the registry.`, {
        current,
        candidates: candidates.map((migration) => migration.id)
      });
    }
    path.push(next);
    current = normalizeVersion(next.to);
  }
  return path;
}

function assertMigrationGraph(registryId: string, migrations: readonly FrontierMigration<any, any>[]): void {
  const seen = new Set<string>();
  for (const migration of migrations) {
    if (!migration.id) throw new FrontierMigrationError('invalid-migration', `Migration registry ${registryId} contains a migration without an id.`);
    const fromList = migration.from === '*'
      ? ['*']
      : typeof migration.from !== 'string' && typeof migration.from !== 'number'
        ? migration.from.map(normalizeVersion)
        : [normalizeVersion(migration.from)];
    const to = normalizeVersion(migration.to);
    for (const from of fromList) {
      const key = from + '->' + to;
      if (seen.has(key)) {
        throw new FrontierMigrationError('duplicate-step', `Migration registry ${registryId} contains duplicate step ${key}.`);
      }
      seen.add(key);
    }
  }
}

function createMigrationContext(
  registryId: string,
  migration: FrontierMigration<any, any>,
  data: unknown,
  options: FrontierMigrationRunOptions,
  step: {
    fromVersion: string;
    toVersion: string;
    targetVersion: string;
    stepIndex: number;
    stepCount: number;
    warnings: FrontierMigrationWarning[];
  }
): FrontierMigrationContext {
  return {
    registryId,
    migrationId: migration.id,
    source: options.source,
    plugin: options.plugin,
    api: options.api,
    actor: options.actor,
    metadata: options.metadata,
    dryRun: options.dryRun === true,
    fromVersion: step.fromVersion,
    toVersion: step.toVersion,
    targetVersion: step.targetVersion,
    stepIndex: step.stepIndex,
    stepCount: step.stepCount,
    read(path, fallback) {
      return readMigrationPath(data, path, fallback);
    },
    write(path, value) {
      writeMigrationPath(data, path, value);
    },
    remove(path) {
      removeMigrationPath(data, path);
    },
    rename(from, to, fallback) {
      renameMigrationPath(data, from, to, fallback);
    },
    warn(message, detail) {
      step.warnings.push({ stepId: migration.id, message, ...definedObject(detail || {}) });
    }
  };
}

function stepTrace(migration: FrontierMigration<any, any>, from: string, to: string, started: number): FrontierMigrationStepTrace {
  return {
    id: migration.id,
    from,
    to,
    direction: 'up',
    checksum: migration.checksum || createMigrationChecksum(migration),
    reads: migration.reads || [],
    writes: migration.writes || [],
    elapsedMs: now() - started
  };
}

function createReport(args: {
  registryId: string;
  options: FrontierMigrationRunOptions;
  fromVersion: string;
  toVersion: string;
  targetVersion: string;
  changed: boolean;
  dryRun: boolean;
  steps: readonly FrontierMigrationStepTrace[];
  warnings: readonly FrontierMigrationWarning[];
  elapsedMs: number;
}): FrontierMigrationReport {
  return {
    kind: REPORT_KIND,
    registryId: args.registryId,
    source: args.options.source,
    plugin: args.options.plugin,
    api: args.options.api,
    actor: args.options.actor,
    fromVersion: args.fromVersion,
    toVersion: args.toVersion,
    targetVersion: args.targetVersion,
    changed: args.changed,
    dryRun: args.dryRun,
    stepCount: args.steps.length,
    steps: args.steps,
    warnings: args.warnings,
    elapsedMs: args.elapsedMs,
    metadata: args.options.metadata
  };
}

function writeVersion(
  data: unknown,
  version: string,
  registryOptions: FrontierMigrationRegistryOptions,
  runOptions: FrontierMigrationRunOptions
): void {
  const setVersion = runOptions.setVersion || registryOptions.setVersion;
  if (setVersion) {
    setVersion(data, version, runOptions);
    return;
  }
  const versionPath = runOptions.versionPath ?? registryOptions.versionPath ?? DEFAULT_VERSION_PATH;
  if (versionPath !== false) writeMigrationPath(data, versionPath, version);
}

function validateData(
  registryId: string,
  data: unknown,
  version: string,
  phase: FrontierMigrationPhase,
  registryOptions: FrontierMigrationRegistryOptions,
  runOptions: FrontierMigrationRunOptions
): void {
  const validate = runOptions.validate || registryOptions.validate;
  if (!validate) return;
  validate(data, version, phase, {
    registryId,
    source: runOptions.source,
    plugin: runOptions.plugin,
    api: runOptions.api,
    metadata: runOptions.metadata
  });
}

function migrationMatchesFrom(migration: FrontierMigration<any, any>, version: string): boolean {
  if (migration.from === '*') return false;
  if (typeof migration.from !== 'string' && typeof migration.from !== 'number') {
    return migration.from.some((candidate) => normalizeVersion(candidate) === version);
  }
  return normalizeVersion(migration.from) === version;
}

function primaryFromVersion(from: FrontierMigration['from'], fallback: string): string {
  if (from === '*') return fallback;
  if (typeof from !== 'string' && typeof from !== 'number') return normalizeVersion(from[0] ?? fallback);
  return normalizeVersion(from);
}

function appendPath(path: FrontierMigrationPath, part: FrontierMigrationPathPart): FrontierMigrationPathPart[] {
  return [...parseMigrationPath(path), part];
}

function ensurePathParent(root: unknown, parts: readonly FrontierMigrationPathPart[]): Record<PropertyKey, unknown> {
  if (root == null || typeof root !== 'object') {
    throw new FrontierMigrationError('invalid-root', 'Migration path writes require an object or array root.');
  }
  let cursor = root as Record<PropertyKey, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i] as PropertyKey;
    const nextKey = parts[i + 1];
    let next = cursor[key];
    if (next == null || typeof next !== 'object') {
      next = typeof nextKey === 'number' ? [] : {};
      cursor[key] = next;
    }
    cursor = next as Record<PropertyKey, unknown>;
  }
  return cursor;
}

function cloneWithOptions<T>(value: T, registryOptions: FrontierMigrationRegistryOptions, runOptions: FrontierMigrationRunOptions): T {
  const clone = runOptions.clone || registryOptions.clone || defaultClone;
  return clone(value);
}

function defaultClone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneDefault(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;
  return defaultClone(value);
}

function normalizeVersion(version: FrontierMigrationVersion): string {
  if (typeof version !== 'string' && typeof version !== 'number') {
    throw new FrontierMigrationError('invalid-version', 'Migration versions must be strings or numbers.');
  }
  return String(version);
}

function pathKey(path: FrontierMigrationPath): string {
  return parseMigrationPath(path).map(String).join('/');
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return '{' + entries.map(([key, item]) => JSON.stringify(key) + ':' + stableStringify(item)).join(',') + '}';
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object';
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return isObject(value) && typeof (value as { then?: unknown }).then === 'function';
}

function definedObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(value) as Array<keyof T>) {
    if (value[key] !== undefined) out[key] = value[key];
  }
  return out;
}

function mergeRunOptions(
  base: FrontierMigrationRunOptions | undefined,
  next: FrontierMigrationRunOptions | undefined
): FrontierMigrationRunOptions {
  return { ...(base || {}), ...(next || {}) };
}

function artifactRunOptions<T>(
  artifact: FrontierMigrationArtifact<T>,
  options: FrontierMigrationRunOptions
): FrontierMigrationRunOptions {
  return {
    ...options,
    source: options.source ?? artifact.source ?? artifact.artifactKind,
    plugin: options.plugin ?? artifact.plugin,
    api: options.api ?? artifact.api,
    metadata: options.metadata ?? artifact.metadata,
    writeVersion: options.writeVersion ?? false,
    getVersion: options.getVersion ?? (() => artifact.artifactVersion)
  };
}

function domRunOptions(
  source: string,
  readPaths: readonly FrontierMigrationPath[],
  writePaths: readonly FrontierMigrationPath[],
  mirrorPaths: readonly FrontierMigrationPath[],
  options: FrontierDomMigrationOptions
): FrontierMigrationRunOptions {
  const userGetVersion = options.getVersion;
  const userSetVersion = options.setVersion;
  const customPaths = options.dataVersionPaths;
  const dataVersionPaths = customPaths ?? readPaths;
  const primaryWritePaths = customPaths ?? writePaths;
  const secondaryWritePaths = customPaths ? [] : mirrorPaths;
  return {
    ...options,
    source: options.source ?? source,
    versionPath: false,
    getVersion(data, runOptions) {
      const explicit = userGetVersion?.(data, runOptions);
      if (explicit !== undefined) return explicit;
      return readFirstMigrationVersion(data, dataVersionPaths);
    },
    setVersion(data, version, runOptions) {
      if (userSetVersion) {
        userSetVersion(data, version, runOptions);
        return;
      }
      writeMigrationVersionPaths(data, version, primaryWritePaths, secondaryWritePaths);
    }
  };
}

function readFirstMigrationVersion(data: unknown, paths: readonly FrontierMigrationPath[]): FrontierMigrationVersion | undefined {
  for (const path of paths) {
    const value = readMigrationPath(data, path);
    if (typeof value === 'string' || typeof value === 'number') return value;
  }
  return undefined;
}

function writeMigrationVersionPaths(
  data: unknown,
  version: string,
  paths: readonly FrontierMigrationPath[],
  mirrorPaths: readonly FrontierMigrationPath[]
): void {
  for (const path of paths) writeMigrationPath(data, path, version);
  for (const path of mirrorPaths) {
    if (migrationPathParentExists(data, path)) writeMigrationPath(data, path, version);
  }
}

function migrationPathParentExists(data: unknown, path: FrontierMigrationPath): boolean {
  const parts = parseMigrationPath(path);
  if (parts.length <= 1) return true;
  const parent = readMigrationPath(data, parts.slice(0, -1));
  return parent !== undefined && parent !== null && typeof parent === 'object';
}

async function readRequired<TInput, TCurrent>(options: FrontierMigrationBoundaryOptions<TInput, TCurrent>): Promise<TInput> {
  if (!options.read) {
    throw new FrontierMigrationError('missing-boundary-reader', 'Migration boundary importAsync() without input requires a read() function.');
  }
  return options.read();
}

function now(): number {
  const perf = globalThis.performance;
  return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
}
