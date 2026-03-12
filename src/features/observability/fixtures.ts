import type { IssueArtifactsResponse, IssueResponse, StateResponse } from './api/types'

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

export const issueArtifactsFixture: IssueArtifactsResponse = {
  workspace: {
    path: '/Users/cyriltovena/code/symphony-workspaces/GRA-11',
    repo_root: '/Users/cyriltovena/code/symphony-workspaces/GRA-11',
    branch: 'gra-11-sdk-conformance-rework',
    base_ref: 'main',
    main_ref: '4b35c5fc5ff2d75a03d567fe4d15a80f9ca6f485',
    head_ref: '49a65286d1f0eebcb1fd8c0d1f0fdd1a10cdef00',
    ahead_count: 2,
    behind_count: 0,
  },
  diff_buckets: [
    {
      kind: 'committed',
      label: 'Committed vs main',
      description: 'Branch delta against `main`.',
      summary: {
        file_count: 2,
        additions: 34,
        deletions: 7,
        hunk_count: 4,
      },
      files: [
        {
          id: 'modified:sdks/js/openai.ts',
          path: 'sdks/js/openai.ts',
          previous_path: null,
          change_type: 'modified',
          additions: 18,
          deletions: 4,
          hunks: 2,
          is_binary: false,
          patch: `diff --git a/sdks/js/openai.ts b/sdks/js/openai.ts
index 1111111..2222222 100644
--- a/sdks/js/openai.ts
+++ b/sdks/js/openai.ts
@@ -12,6 +12,11 @@ export function createClient() {
-  return legacyClient
+  return createOpenAIClient({
+    transport: "fetch",
+    telemetry: true,
+  })
 }
@@ -42,6 +47,8 @@ export function runScenario() {
-  return executeScenario()
+  const result = executeScenario()
+  return normalizeScenarioResult(result)
 }`,
        },
        {
          id: 'added:sdks/python/tests/test_core_conformance.py',
          path: 'sdks/python/tests/test_core_conformance.py',
          previous_path: null,
          change_type: 'added',
          additions: 16,
          deletions: 3,
          hunks: 2,
          is_binary: false,
          patch: `diff --git a/sdks/python/tests/test_core_conformance.py b/sdks/python/tests/test_core_conformance.py
new file mode 100644
--- /dev/null
+++ b/sdks/python/tests/test_core_conformance.py
@@ -0,0 +1,9 @@
+def test_roundtrip():
+    result = run_core_roundtrip()
+    assert result.ok
+
+def test_shutdown():
+    outcome = run_shutdown_scenario()
+    assert outcome.exit_code == 0
@@ -0,0 +14,4 @@
+def test_validation():
+    validation = run_validation_scenario()
+    assert validation.passed`,
        },
      ],
    },
    {
      kind: 'staged',
      label: 'Staged',
      description: 'Index changes not committed yet.',
      summary: {
        file_count: 1,
        additions: 4,
        deletions: 1,
        hunk_count: 1,
      },
      files: [
        {
          id: 'modified:README.md',
          path: 'README.md',
          previous_path: null,
          change_type: 'modified',
          additions: 4,
          deletions: 1,
          hunks: 1,
          is_binary: false,
          patch: `diff --git a/README.md b/README.md
index 3333333..4444444 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,6 @@
-# SDK Conformance
+# SDK Conformance
+
+Updated validation notes for GRA-11.
+`,
        },
      ],
    },
    {
      kind: 'unstaged',
      label: 'Unstaged',
      description: 'Working tree changes not in the index.',
      summary: {
        file_count: 1,
        additions: 2,
        deletions: 2,
        hunk_count: 1,
      },
      files: [
        {
          id: 'modified:mise.toml',
          path: 'mise.toml',
          previous_path: null,
          change_type: 'modified',
          additions: 2,
          deletions: 2,
          hunks: 1,
          is_binary: false,
          patch: `diff --git a/mise.toml b/mise.toml
index 5555555..6666666 100644
--- a/mise.toml
+++ b/mise.toml
@@ -8,4 +8,4 @@
-lint = "npm run lint"
+lint = "pnpm lint"
-test = "npm run test"
+test = "pnpm test"`,
        },
      ],
    },
    {
      kind: 'untracked',
      label: 'Untracked',
      description: 'Files present in the workspace but not added to git yet.',
      summary: {
        file_count: 2,
        additions: 0,
        deletions: 0,
        hunk_count: 0,
      },
      files: [
        {
          id: 'untracked:.workpad-id',
          path: '.workpad-id',
          previous_path: null,
          change_type: 'untracked',
          additions: 0,
          deletions: 0,
          hunks: 0,
          is_binary: false,
          patch: null,
        },
        {
          id: 'untracked:workpad.md',
          path: 'workpad.md',
          previous_path: null,
          change_type: 'untracked',
          additions: 0,
          deletions: 0,
          hunks: 0,
          is_binary: false,
          patch: null,
        },
      ],
    },
  ],
  transcript: {
    session_id: '019ce25d-f0d8-7ab0-9b34-1197c3f15b70',
    session_file:
      '/Users/cyriltovena/.codex/sessions/2026/03/12/rollout-2026-03-12T15-05-33-019ce25d-f0d8-7ab0-9b34-1197c3f15b70.jsonl',
    resolved_via: 'session_id',
    updated_at: '2026-03-12T14:08:22Z',
    counts: {
      all: 11,
      messages: 5,
      commentary: 2,
      tools: 1,
      system: 1,
    },
    entries: [
      {
        id: 'system:0:session-meta',
        timestamp: '2026-03-12T14:05:36.845Z',
        kind: 'system',
        title: 'Session opened',
        source: 'session_meta',
        body: '/Users/cyriltovena/code/symphony-workspaces/GRA-11 • openai • vscode',
        details: null,
        call_id: null,
      },
      {
        id: 'message:agents-md',
        timestamp: '2026-03-12T14:05:37.000Z',
        kind: 'user',
        title: 'User prompt',
        source: 'user',
        body: '# AGENTS.md instructions for /Users/cyriltovena/code/symphony-workspaces/GRA-11\n\n<INSTRUCTIONS>\nAct like a high-performing senior engineer. Be concise, direct, decisive, and execution-focused.\n\nSolve problems with simple, maintainable, production-friendly solutions.\n</INSTRUCTIONS>',
        details: null,
        call_id: null,
      },
      {
        id: 'message:ticket',
        timestamp: '2026-03-12T14:05:38.000Z',
        kind: 'user',
        title: 'User prompt',
        source: 'user',
        body: 'You are working on a Linear ticket `GRA-11`\n\n\n\nIssue context:\nIdentifier: GRA-11\nTitle: Implement core conformance suites for the JS, Python, Java, and .NET SDKs\nCurrent status: Rework\nLabels: \nURL: https://linear.app/grafana-sigil/issue/GRA-11/implement-core-conformance-suites-for-the-js-python-java-and-net-sdks\n\nDescription:\n## Goal\nImplement a shared "core conformance" test suite that every SDK must pass.',
        details: null,
        call_id: null,
      },
      {
        id: 'message:1',
        timestamp: '2026-03-12T14:05:46.131Z',
        kind: 'commentary',
        title: 'Commentary update',
        source: 'commentary',
        body: 'Using `linear` first to fetch `GRA-11` state and existing workpad/PR context, then I’ll route through the required rework flow and sync the repo before any edits.',
        details: null,
        call_id: null,
      },
      {
        id: 'tool:call_l8asETPRCDj0XJmfNY0RmbVB',
        timestamp: '2026-03-12T14:05:46.152Z',
        kind: 'tool',
        title: 'exec_command',
        source: 'function_call',
        body: '{\n  "cmd": "git status --short --branch",\n  "workdir": "/Users/cyriltovena/code/symphony-workspaces/GRA-11"\n}',
        details:
          'Chunk ID: fb8cbb\nWall time: 0.0000 seconds\nProcess exited with code 0\nOriginal token count: 16\nOutput:\n## gra-11-core-conformance-suites\n?? .workpad-id\n?? workpad.md\n',
        call_id: 'call_l8asETPRCDj0XJmfNY0RmbVB',
      },
      {
        id: 'tool:call_patchExample001',
        timestamp: '2026-03-12T14:05:50.200Z',
        kind: 'tool',
        title: 'apply_patch',
        source: 'function_call',
        body: '--- a/sdks/js/openai.ts\n+++ b/sdks/js/openai.ts\n@@ -12,8 +12,14 @@ export function createClient() {\n-  return legacyClient\n+  const client = new OpenAIClient({\n+    apiKey: process.env.OPENAI_API_KEY,\n+    timeout: 30_000,\n+  })\n+  return client\n }\n \n export function getModels() {\n-  return []\n+  return client.models.list().then((res) => res.data)\n }',
        details: 'Patch applied successfully.',
        call_id: 'call_patchExample001',
      },
      {
        id: 'message:2',
        timestamp: '2026-03-12T14:05:54.185Z',
        kind: 'commentary',
        title: 'Commentary update',
        source: 'commentary',
        body: 'I found prior local workpad artifacts and an existing feature branch. Next I’m checking Linear state, active comments, and any attached PR so I can decide whether this run must reset from a fresh branch.',
        details: null,
        call_id: null,
      },
      {
        id: 'message:3',
        timestamp: '2026-03-12T14:06:01.650Z',
        kind: 'assistant',
        title: 'Assistant response',
        source: 'assistant',
        body: '`GRA-11` is in `Rework` with an open PR and an active old workpad, so I’m following the full reset path now: read the review signal that caused rework, then close the current PR, delete the old workpad, and restart from a fresh branch off `origin/main`.',
        details: null,
        call_id: null,
      },
      {
        id: 'message:sub1',
        timestamp: '2026-03-12T14:06:10.000Z',
        kind: 'user',
        title: 'User prompt',
        source: 'user',
        body: '<subagent_notification>\n{"agent_id":"019ce21f-5f1e-7852-b133-d43629f73325","status":{"completed":"**Current state**\\n\\nThe shipped conformance baseline is Go-only today."}}\n</subagent_notification>',
        details: null,
        call_id: null,
      },
      {
        id: 'message:sub2',
        timestamp: '2026-03-12T14:06:11.000Z',
        kind: 'user',
        title: 'User prompt',
        source: 'user',
        body: '<subagent_notification>\n{"agent_id":"019ce21f-5ea2-7e33-ac5e-be3672414750","status":{"completed":"**Current State**\\n\\nThe only shipped core conformance harness is Go."}}\n</subagent_notification>',
        details: null,
        call_id: null,
      },
    ],
  },
}
