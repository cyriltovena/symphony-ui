import type {
  DiffBucket,
  DiffBucketKind,
  DiffChangeType,
  DiffFileArtifact,
  IssueArtifactsResponse,
  IssueAttempts,
  IssueResponse,
  IssueRetryState,
  IssueRunningState,
  LocalWorkspace,
  LocalWorkspacesResponse,
  RateLimitCredits,
  RateLimits,
  RecentEvent,
  RetryingSession,
  RunningSession,
  StateResponse,
  TranscriptEntry,
  TranscriptEntryKind,
  TranscriptPayload,
  TokenTotals,
  WorkspaceArtifacts,
} from './types'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${field} to be a string`)
  }

  return value
}

function readNullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return readString(value, field)
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Expected ${field} to be a number`)
  }

  return value
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected ${field} to be a boolean`)
  }

  return value
}

function readArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${field} to be an array`)
  }

  return value
}

function readStringUnion<T extends string>(value: unknown, field: string, options: readonly T[]): T {
  const parsed = readString(value, field)
  if (!options.includes(parsed as T)) {
    throw new Error(`Expected ${field} to be one of: ${options.join(', ')}`)
  }

  return parsed as T
}

function readTokenTotals(value: unknown, field: string): TokenTotals {
  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    input_tokens: readNumber(value.input_tokens, `${field}.input_tokens`),
    output_tokens: readNumber(value.output_tokens, `${field}.output_tokens`),
    total_tokens: readNumber(value.total_tokens, `${field}.total_tokens`),
  }
}

function readRunningSession(value: unknown, field: string): RunningSession {
  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    issue_id: readString(value.issue_id, `${field}.issue_id`),
    issue_identifier: readString(value.issue_identifier, `${field}.issue_identifier`),
    state: readString(value.state, `${field}.state`),
    session_id: readString(value.session_id, `${field}.session_id`),
    turn_count: readNumber(value.turn_count, `${field}.turn_count`),
    last_event: readString(value.last_event, `${field}.last_event`),
    last_message: readString(value.last_message, `${field}.last_message`),
    started_at: readString(value.started_at, `${field}.started_at`),
    last_event_at: readString(value.last_event_at, `${field}.last_event_at`),
    tokens: readTokenTotals(value.tokens, `${field}.tokens`),
  }
}

function readRetryingSession(value: unknown, field: string): RetryingSession {
  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    issue_id: readString(value.issue_id, `${field}.issue_id`),
    issue_identifier: readString(value.issue_identifier, `${field}.issue_identifier`),
    attempt: readNumber(value.attempt, `${field}.attempt`),
    due_at: readString(value.due_at, `${field}.due_at`),
    error: readString(value.error, `${field}.error`),
  }
}

function readRateLimitCredits(value: unknown, field: string): RateLimitCredits | null {
  if (value === null || value === undefined) {
    return null
  }

  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    balance: value.balance === null ? null : readNumber(value.balance, `${field}.balance`),
    has_credits: readBoolean(value.has_credits, `${field}.has_credits`),
    unlimited: readBoolean(value.unlimited, `${field}.unlimited`),
  }
}

function readRateLimits(value: unknown, field: string): RateLimits | null {
  if (value === null || value === undefined) {
    return null
  }

  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    credits: readRateLimitCredits(value.credits, `${field}.credits`),
    limit_id: readNullableString(value.limit_id, `${field}.limit_id`),
    limit_name: readNullableString(value.limit_name, `${field}.limit_name`),
    plan_type: readNullableString(value.plan_type, `${field}.plan_type`),
    primary: readNullableString(value.primary, `${field}.primary`),
    secondary: readNullableString(value.secondary, `${field}.secondary`),
  }
}

function readRecentEvent(value: unknown, field: string): RecentEvent {
  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    at: readString(value.at, `${field}.at`),
    event: readString(value.event, `${field}.event`),
    message: readString(value.message, `${field}.message`),
  }
}

function readIssueAttempts(value: unknown, field: string): IssueAttempts {
  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    restart_count: readNumber(value.restart_count, `${field}.restart_count`),
    current_retry_attempt: readNumber(value.current_retry_attempt, `${field}.current_retry_attempt`),
  }
}

function readIssueRunningState(value: unknown, field: string): IssueRunningState | null {
  if (value === null || value === undefined) {
    return null
  }

  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    state: readString(value.state, `${field}.state`),
    session_id: readString(value.session_id, `${field}.session_id`),
    turn_count: readNumber(value.turn_count, `${field}.turn_count`),
    started_at: readString(value.started_at, `${field}.started_at`),
    last_event: readString(value.last_event, `${field}.last_event`),
    last_message: readString(value.last_message, `${field}.last_message`),
    last_event_at: readString(value.last_event_at, `${field}.last_event_at`),
    tokens: readTokenTotals(value.tokens, `${field}.tokens`),
  }
}

function readIssueRetryState(value: unknown, field: string): IssueRetryState | null {
  if (value === null || value === undefined) {
    return null
  }

  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    attempt: readNumber(value.attempt, `${field}.attempt`),
    due_at: readString(value.due_at, `${field}.due_at`),
    error: readString(value.error, `${field}.error`),
  }
}

function readDiffFileArtifact(value: unknown, field: string): DiffFileArtifact {
  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    id: readString(value.id, `${field}.id`),
    path: readString(value.path, `${field}.path`),
    previous_path: readNullableString(value.previous_path, `${field}.previous_path`),
    change_type: readStringUnion(value.change_type, `${field}.change_type`, [
      'added',
      'modified',
      'deleted',
      'renamed',
      'copied',
      'binary',
      'untracked',
    ] satisfies readonly DiffChangeType[]),
    additions: readNumber(value.additions, `${field}.additions`),
    deletions: readNumber(value.deletions, `${field}.deletions`),
    hunks: readNumber(value.hunks, `${field}.hunks`),
    patch: readNullableString(value.patch, `${field}.patch`),
    is_binary: readBoolean(value.is_binary, `${field}.is_binary`),
  }
}

function readDiffBucket(value: unknown, field: string): DiffBucket {
  if (!isRecord(value) || !isRecord(value.summary)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    kind: readStringUnion(value.kind, `${field}.kind`, [
      'committed',
      'staged',
      'unstaged',
      'untracked',
    ] satisfies readonly DiffBucketKind[]),
    label: readString(value.label, `${field}.label`),
    description: readString(value.description, `${field}.description`),
    summary: {
      file_count: readNumber(value.summary.file_count, `${field}.summary.file_count`),
      additions: readNumber(value.summary.additions, `${field}.summary.additions`),
      deletions: readNumber(value.summary.deletions, `${field}.summary.deletions`),
      hunk_count: readNumber(value.summary.hunk_count, `${field}.summary.hunk_count`),
    },
    files: readArray(value.files, `${field}.files`).map((entry, index) =>
      readDiffFileArtifact(entry, `${field}.files[${index}]`),
    ),
  }
}

function readTranscriptEntry(value: unknown, field: string): TranscriptEntry {
  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    id: readString(value.id, `${field}.id`),
    timestamp: readNullableString(value.timestamp, `${field}.timestamp`),
    kind: readStringUnion(value.kind, `${field}.kind`, [
      'user',
      'assistant',
      'commentary',
      'tool',
      'system',
    ] satisfies readonly TranscriptEntryKind[]),
    title: readString(value.title, `${field}.title`),
    source: readString(value.source, `${field}.source`),
    body: readString(value.body, `${field}.body`),
    details: readNullableString(value.details, `${field}.details`),
    call_id: readNullableString(value.call_id, `${field}.call_id`),
  }
}

function readTranscriptPayload(value: unknown, field: string): TranscriptPayload {
  if (!isRecord(value) || !isRecord(value.counts)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    session_id: readNullableString(value.session_id, `${field}.session_id`),
    session_file: readNullableString(value.session_file, `${field}.session_file`),
    resolved_via: readStringUnion(value.resolved_via, `${field}.resolved_via`, [
      'session_id',
      'workspace',
      'none',
    ] as const),
    updated_at: readNullableString(value.updated_at, `${field}.updated_at`),
    counts: {
      all: readNumber(value.counts.all, `${field}.counts.all`),
      messages: readNumber(value.counts.messages, `${field}.counts.messages`),
      commentary: readNumber(value.counts.commentary, `${field}.counts.commentary`),
      tools: readNumber(value.counts.tools, `${field}.counts.tools`),
      system: readNumber(value.counts.system, `${field}.counts.system`),
    },
    entries: readArray(value.entries, `${field}.entries`).map((entry, index) =>
      readTranscriptEntry(entry, `${field}.entries[${index}]`),
    ),
  }
}

function readWorkspaceArtifacts(value: unknown, field: string): WorkspaceArtifacts {
  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    path: readString(value.path, `${field}.path`),
    repo_root: readNullableString(value.repo_root, `${field}.repo_root`),
    branch: readNullableString(value.branch, `${field}.branch`),
    base_ref: readString(value.base_ref, `${field}.base_ref`),
    main_ref: readNullableString(value.main_ref, `${field}.main_ref`),
    head_ref: readNullableString(value.head_ref, `${field}.head_ref`),
    ahead_count: readNumber(value.ahead_count, `${field}.ahead_count`),
    behind_count: readNumber(value.behind_count, `${field}.behind_count`),
  }
}

export function parseStateResponse(value: unknown): StateResponse {
  if (!isRecord(value)) {
    throw new Error('Expected state response to be an object')
  }

  if (!isRecord(value.counts) || !isRecord(value.codex_totals)) {
    throw new Error('State response is missing counts or codex_totals')
  }

  return {
    generated_at: readString(value.generated_at, 'generated_at'),
    counts: {
      running: readNumber(value.counts.running, 'counts.running'),
      retrying: readNumber(value.counts.retrying, 'counts.retrying'),
    },
    running: readArray(value.running, 'running').map((entry, index) =>
      readRunningSession(entry, `running[${index}]`),
    ),
    retrying: readArray(value.retrying, 'retrying').map((entry, index) =>
      readRetryingSession(entry, `retrying[${index}]`),
    ),
    codex_totals: {
      ...readTokenTotals(value.codex_totals, 'codex_totals'),
      seconds_running: readNumber(value.codex_totals.seconds_running, 'codex_totals.seconds_running'),
    },
    rate_limits: readRateLimits(value.rate_limits, 'rate_limits'),
  }
}

export function parseIssueResponse(value: unknown): IssueResponse {
  if (!isRecord(value) || !isRecord(value.workspace) || !isRecord(value.logs)) {
    throw new Error('Expected issue response to be an object')
  }

  return {
    issue_identifier: readString(value.issue_identifier, 'issue_identifier'),
    issue_id: readString(value.issue_id, 'issue_id'),
    status: readString(value.status, 'status'),
    workspace: {
      path: readString(value.workspace.path, 'workspace.path'),
    },
    attempts: readIssueAttempts(value.attempts, 'attempts'),
    running: readIssueRunningState(value.running, 'running'),
    retry: readIssueRetryState(value.retry, 'retry'),
    logs: {
      codex_session_logs: readArray(value.logs.codex_session_logs, 'logs.codex_session_logs').map(
        (entry, index) => readString(entry, `logs.codex_session_logs[${index}]`),
      ),
    },
    recent_events: readArray(value.recent_events, 'recent_events').map((entry, index) =>
      readRecentEvent(entry, `recent_events[${index}]`),
    ),
    last_error: readNullableString(value.last_error, 'last_error'),
    tracked: isRecord(value.tracked) ? value.tracked : {},
  }
}

function readLocalWorkspace(value: unknown, field: string): LocalWorkspace {
  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`)
  }

  return {
    identifier: readString(value.identifier, `${field}.identifier`),
    path: readString(value.path, `${field}.path`),
    branch: readNullableString(value.branch, `${field}.branch`),
  }
}

export function parseLocalWorkspacesResponse(value: unknown): LocalWorkspacesResponse {
  if (!isRecord(value)) {
    throw new Error('Expected local workspaces response to be an object')
  }

  return {
    root: readString(value.root, 'root'),
    workspaces: readArray(value.workspaces, 'workspaces').map((entry, index) =>
      readLocalWorkspace(entry, `workspaces[${index}]`),
    ),
  }
}

export function parseIssueArtifactsResponse(value: unknown): IssueArtifactsResponse {
  if (!isRecord(value)) {
    throw new Error('Expected issue artifacts response to be an object')
  }

  return {
    workspace: readWorkspaceArtifacts(value.workspace, 'workspace'),
    diff_buckets: readArray(value.diff_buckets, 'diff_buckets').map((entry, index) =>
      readDiffBucket(entry, `diff_buckets[${index}]`),
    ),
    transcript: readTranscriptPayload(value.transcript, 'transcript'),
  }
}
