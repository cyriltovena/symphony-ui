import type {
  IssueAttempts,
  IssueResponse,
  IssueRetryState,
  IssueRunningState,
  RateLimitCredits,
  RateLimits,
  RecentEvent,
  RetryingSession,
  RunningSession,
  StateResponse,
  TokenTotals,
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
