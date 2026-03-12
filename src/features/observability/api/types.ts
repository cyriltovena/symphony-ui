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
