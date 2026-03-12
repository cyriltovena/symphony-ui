import type { IssueResponse, StateResponse } from './api/types'

export const overviewFixture: StateResponse = {
  generated_at: '2026-03-12T12:42:10Z',
  counts: { running: 5, retrying: 0 },
  running: [
    {
      issue_id: '11f7d7bb-1ac8-435c-bdde-abd73d8a0873',
      issue_identifier: 'GRA-9',
      state: 'In Progress',
      session_id: '019ce210-0f82-7ad3-8061-a2f76996c394-019ce210-0fa2-7090-a657-94c8b55fdc2a',
      turn_count: 1,
      last_event: 'notification',
      last_message: 'item started: reasoning (rs_06327e9fe)',
      started_at: '2026-03-12T12:40:17Z',
      last_event_at: '2026-03-12T12:42:03Z',
      tokens: { input_tokens: 460609, output_tokens: 4538, total_tokens: 465147 },
    },
    {
      issue_id: '019ce210-0f82-7ad3-8061-a2f76996c394',
      issue_identifier: 'GRA-6',
      state: 'In Progress',
      session_id: '019ce206-972e-7013-a981-502f2a9cb8bb-019ce206-974c-7062-ab1d-ab1dec6ac8b1',
      turn_count: 1,
      last_event: 'notification',
      last_message: 'agent message streaming: ’m',
      started_at: '2026-03-12T12:29:49Z',
      last_event_at: '2026-03-12T12:42:09Z',
      tokens: { input_tokens: 7553709, output_tokens: 42122, total_tokens: 7595206 },
    },
  ],
  retrying: [],
  codex_totals: {
    input_tokens: 95491289,
    output_tokens: 385840,
    total_tokens: 95873541,
    seconds_running: 7217,
  },
  rate_limits: {
    credits: {
      balance: null,
      has_credits: true,
      unlimited: false,
    },
    limit_id: 'codex',
    limit_name: null,
    plan_type: 'business',
    primary: null,
    secondary: null,
  },
}

export const emptyOverviewFixture: StateResponse = {
  ...overviewFixture,
  counts: { running: 0, retrying: 0 },
  running: [],
  retrying: [],
}

export const retryingOverviewFixture: StateResponse = {
  ...overviewFixture,
  counts: { running: 3, retrying: 2 },
  retrying: [
    {
      issue_id: 'issue-retry-1',
      issue_identifier: 'GRA-22',
      attempt: 2,
      due_at: '2026-03-12T12:55:00Z',
      error: 'Rate limit reached while requesting refresh',
    },
    {
      issue_id: 'issue-retry-2',
      issue_identifier: 'GRA-27',
      attempt: 1,
      due_at: '2026-03-12T12:57:00Z',
      error: 'Workspace checkout failed',
    },
  ],
}

export const issueFixture: IssueResponse = {
  issue_identifier: 'GRA-6',
  issue_id: '11f7d7bb-1ac8-435c-bdde-abd73d8a0873',
  status: 'running',
  workspace: {
    path: '/Users/cyriltovena/code/symphony-workspaces/GRA-6',
  },
  attempts: {
    current_retry_attempt: 0,
    restart_count: 0,
  },
  running: {
    state: 'In Progress',
    session_id: '019ce206-972e-7013-a981-502f2a9cb8bb-019ce206-974c-7062-ab1d-ab1dec6ac8b1',
    turn_count: 1,
    started_at: '2026-03-12T12:29:49Z',
    last_event: 'notification',
    last_message: 'agent message streaming: ’m',
    last_event_at: '2026-03-12T12:42:09Z',
    tokens: {
      input_tokens: 7553709,
      output_tokens: 42122,
      total_tokens: 7595206,
    },
  },
  retry: null,
  logs: {
    codex_session_logs: [],
  },
  recent_events: [
    {
      at: '2026-03-12T12:42:09Z',
      event: 'notification',
      message: 'agent message streaming: ’m',
    },
  ],
  last_error: null,
  tracked: {},
}

export const issueErrorFixture: IssueResponse = {
  ...issueFixture,
  status: 'retrying',
  retry: {
    attempt: 2,
    due_at: '2026-03-12T12:55:00Z',
    error: 'Rate limit reached while requesting refresh',
  },
  last_error: 'Rate limit reached while requesting refresh',
  running: null,
  recent_events: [
    ...issueFixture.recent_events,
    {
      at: '2026-03-12T12:43:20Z',
      event: 'error',
      message: 'refresh failed: upstream rate limit',
    },
  ],
}
