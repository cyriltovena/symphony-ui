export interface TokenTotals {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export interface RunningSession {
  issue_id: string
  issue_identifier: string
  state: string
  session_id: string
  turn_count: number
  last_event: string
  last_message: string
  started_at: string
  last_event_at: string
  tokens: TokenTotals
}

export interface RetryingSession {
  issue_id: string
  issue_identifier: string
  attempt: number
  due_at: string
  error: string
}

export interface RateLimitCredits {
  balance: number | null
  has_credits: boolean
  unlimited: boolean
}

export interface RateLimits {
  credits: RateLimitCredits | null
  limit_id: string | null
  limit_name: string | null
  plan_type: string | null
  primary: string | null
  secondary: string | null
}

export interface StateResponse {
  generated_at: string
  counts: {
    running: number
    retrying: number
  }
  running: RunningSession[]
  retrying: RetryingSession[]
  codex_totals: TokenTotals & {
    seconds_running: number
  }
  rate_limits: RateLimits | null
}

export interface IssueRunningState {
  state: string
  session_id: string
  turn_count: number
  started_at: string
  last_event: string
  last_message: string
  last_event_at: string
  tokens: TokenTotals
}

export interface IssueRetryState {
  attempt: number
  due_at: string
  error: string
}

export interface RecentEvent {
  at: string
  event: string
  message: string
}

export interface IssueAttempts {
  restart_count: number
  current_retry_attempt: number
}

export interface IssueResponse {
  issue_identifier: string
  issue_id: string
  status: string
  workspace: {
    path: string
  }
  attempts: IssueAttempts
  running: IssueRunningState | null
  retry: IssueRetryState | null
  logs: {
    codex_session_logs: string[]
  }
  recent_events: RecentEvent[]
  last_error: string | null
  tracked: Record<string, unknown>
}

export type DiffBucketKind = 'committed' | 'staged' | 'unstaged' | 'untracked'

export type DiffChangeType =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'binary'
  | 'untracked'

export interface DiffFileArtifact {
  id: string
  path: string
  previous_path: string | null
  change_type: DiffChangeType
  additions: number
  deletions: number
  hunks: number
  patch: string | null
  is_binary: boolean
}

export interface DiffBucket {
  kind: DiffBucketKind
  label: string
  description: string
  summary: {
    file_count: number
    additions: number
    deletions: number
    hunk_count: number
  }
  files: DiffFileArtifact[]
}

export type TranscriptEntryKind = 'user' | 'assistant' | 'commentary' | 'tool' | 'system'

export interface TranscriptEntry {
  id: string
  timestamp: string | null
  kind: TranscriptEntryKind
  title: string
  source: string
  body: string
  details: string | null
  call_id: string | null
}

export interface TranscriptPayload {
  session_id: string | null
  session_file: string | null
  resolved_via: 'session_id' | 'workspace' | 'none'
  updated_at: string | null
  counts: {
    all: number
    messages: number
    commentary: number
    tools: number
    system: number
  }
  entries: TranscriptEntry[]
}

export interface WorkspaceArtifacts {
  path: string
  repo_root: string | null
  branch: string | null
  base_ref: string
  main_ref: string | null
  head_ref: string | null
  ahead_count: number
  behind_count: number
}

export interface PrInfo {
  number: number
  title: string
  url: string
  state: string
}

export interface IssueArtifactsResponse {
  workspace: WorkspaceArtifacts
  diff_buckets: DiffBucket[]
  transcript: TranscriptPayload
  pr?: PrInfo | null
}

export interface LocalWorkspace {
  identifier: string
  path: string
  branch: string | null
  pr?: PrInfo | null
}

export interface LocalWorkspacesResponse {
  root: string
  workspaces: LocalWorkspace[]
}
