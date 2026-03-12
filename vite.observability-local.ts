import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { readdir, readFile, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect } from 'vite'

type DiffBucketKind = 'committed' | 'staged' | 'unstaged' | 'untracked'
type DiffChangeType = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'binary' | 'untracked'
type TranscriptEntryKind = 'user' | 'assistant' | 'commentary' | 'tool' | 'system'

interface DiffFileArtifact {
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

interface DiffBucket {
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

interface TranscriptEntry {
  id: string
  timestamp: string | null
  kind: TranscriptEntryKind
  title: string
  source: string
  body: string
  details: string | null
  call_id: string | null
}

interface TranscriptPayload {
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

interface WorkspacePayload {
  path: string
  repo_root: string | null
  branch: string | null
  base_ref: string
  main_ref: string | null
  head_ref: string | null
  ahead_count: number
  behind_count: number
}

interface IssueArtifactsPayload {
  workspace: WorkspacePayload
  diff_buckets: DiffBucket[]
  transcript: TranscriptPayload
  pr: PrInfo | null
}

interface ExecResult {
  stdout: string
  stderr: string
}

interface SessionMatch {
  filePath: string
  resolvedVia: TranscriptPayload['resolved_via']
}

interface SessionMeta {
  id: string | null
  cwd: string | null
  modelProvider: string | null
  source: string | null
}

const CODEX_SESSIONS_ROOT = join(homedir(), '.codex', 'sessions')
const DEFAULT_WORKSPACE_ROOT = join(homedir(), 'code', 'symphony-workspaces')
const DIFF_BUCKET_ORDER: DiffBucketKind[] = ['committed', 'staged', 'unstaged', 'untracked']
const ISSUE_DIR_PATTERN = /^[A-Z]+-\d+$/

export function observabilityLocalApiMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url || req.method !== 'GET') {
      return next()
    }

    const url = new URL(req.url, 'http://127.0.0.1')

    if (url.pathname === '/api/local/workspaces') {
      try {
        const root = url.searchParams.get('root') ?? process.env.SYMPHONY_WORKSPACE_ROOT ?? DEFAULT_WORKSPACE_ROOT
        const payload = await scanWorkspaces(root)
        return sendJson(res, 200, payload)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to scan workspaces'
        return sendJson(res, 500, { error: message })
      }
    }

    const artifactMatch = url.pathname.match(/^\/api\/local\/issues\/([^/]+)\/artifacts$/)
    if (!artifactMatch) {
      return next()
    }

    const issueIdentifier = decodeURIComponent(artifactMatch[1] ?? '')
    const workspacePath = url.searchParams.get('workspacePath')
    const sessionId = url.searchParams.get('sessionId')

    if (!workspacePath) {
      return sendJson(res, 400, { error: 'Missing workspacePath query parameter' })
    }

    try {
      const payload = await buildIssueArtifacts(issueIdentifier, workspacePath, sessionId)
      return sendJson(res, 200, payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown local artifact error'
      return sendJson(res, 500, { error: message })
    }
  }
}

interface PrInfo {
  number: number
  title: string
  url: string
  state: string
}

async function lookupPr(workspacePath: string, branch: string | null): Promise<PrInfo | null> {
  if (!branch || branch === 'main' || branch === 'master') {
    return null
  }
  try {
    const result = await execFileText('gh', [
      'pr', 'list',
      '--head', branch,
      '--json', 'url,number,title,state',
      '--limit', '1',
    ], workspacePath)
    const parsed = JSON.parse(result.stdout.trim()) as unknown
    if (Array.isArray(parsed) && parsed.length > 0 && isRecord(parsed[0])) {
      const pr = parsed[0]
      return {
        number: typeof pr.number === 'number' ? pr.number : 0,
        title: typeof pr.title === 'string' ? pr.title : '',
        url: typeof pr.url === 'string' ? pr.url : '',
        state: typeof pr.state === 'string' ? pr.state : '',
      }
    }
  } catch {
    /* gh not available or not a github repo */
  }
  return null
}

async function scanWorkspaces(root: string) {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return { root, workspaces: [] }
  }

  const issueDirs = entries.filter((e) => e.isDirectory() && ISSUE_DIR_PATTERN.test(e.name))
  const workspaces = await Promise.all(
    issueDirs.map(async (entry) => {
      const fullPath = join(root, entry.name)
      let branch: string | null = null
      try {
        branch = (await gitText(fullPath, ['rev-parse', '--abbrev-ref', 'HEAD'])) || null
      } catch {
        /* not a git repo */
      }
      const pr = await lookupPr(fullPath, branch)
      return { identifier: entry.name, path: fullPath, branch, pr }
    }),
  )

  workspaces.sort((a, b) => a.identifier.localeCompare(b.identifier))
  return { root, workspaces }
}

async function buildIssueArtifacts(
  issueIdentifier: string,
  workspacePath: string,
  sessionId: string | null,
): Promise<IssueArtifactsPayload> {
  const [workspace, transcript] = await Promise.all([
    loadWorkspaceArtifacts(workspacePath),
    loadTranscript(issueIdentifier, workspacePath, sessionId),
  ])

  const pr = await lookupPr(workspacePath, workspace.workspace.branch)

  return {
    workspace: workspace.workspace,
    diff_buckets: workspace.diffBuckets,
    transcript,
    pr,
  }
}

async function loadWorkspaceArtifacts(workspacePath: string) {
  const isRepo = await pathExists(join(workspacePath, '.git'))
  if (!isRepo) {
    return {
      workspace: {
        path: workspacePath,
        repo_root: null,
        branch: null,
        base_ref: 'main',
        main_ref: null,
        head_ref: null,
        ahead_count: 0,
        behind_count: 0,
      },
      diffBuckets: DIFF_BUCKET_ORDER.map((kind) => emptyDiffBucket(kind, kind === 'committed'
        ? 'No git repository found at the issue workspace.'
        : 'This workspace does not expose git diff data.')),
    }
  }

  const [repoRoot, branch, headRef, mainRef, branchCounts, committedPatch, stagedPatch, unstagedPatch, statusText] =
    await Promise.all([
      gitText(workspacePath, ['rev-parse', '--show-toplevel']),
      gitText(workspacePath, ['rev-parse', '--abbrev-ref', 'HEAD']),
      gitText(workspacePath, ['rev-parse', 'HEAD']),
      resolveMainRef(workspacePath),
      resolveBranchCounts(workspacePath),
      gitText(workspacePath, ['diff', '--patch', '--find-renames', '--no-ext-diff', '--binary', 'main...HEAD']),
      gitText(workspacePath, ['diff', '--patch', '--find-renames', '--no-ext-diff', '--binary', '--cached']),
      gitText(workspacePath, ['diff', '--patch', '--find-renames', '--no-ext-diff', '--binary']),
      gitText(workspacePath, ['status', '--porcelain=v1', '--untracked-files=all']),
    ])

  const untrackedFiles = parseUntrackedFiles(statusText)
  const diffBuckets: DiffBucket[] = [
    buildDiffBucket('committed', 'Committed vs main', 'Branch delta against `main`.', committedPatch),
    buildDiffBucket('staged', 'Staged', 'Index changes not committed yet.', stagedPatch),
    buildDiffBucket('unstaged', 'Unstaged', 'Working tree changes not in the index.', unstagedPatch),
    buildUntrackedBucket(untrackedFiles),
  ]

  return {
    workspace: {
      path: workspacePath,
      repo_root: repoRoot || workspacePath,
      branch: branch || null,
      base_ref: 'main',
      main_ref: mainRef,
      head_ref: headRef || null,
      ahead_count: branchCounts.ahead,
      behind_count: branchCounts.behind,
    },
    diffBuckets,
  }
}

async function loadTranscript(
  issueIdentifier: string,
  workspacePath: string,
  sessionId: string | null,
): Promise<TranscriptPayload> {
  const match = await resolveSessionFile(workspacePath, sessionId)
  if (!match) {
    return {
      session_id: sessionId,
      session_file: null,
      resolved_via: 'none',
      updated_at: null,
      counts: { all: 0, messages: 0, commentary: 0, tools: 0, system: 0 },
      entries: [
        {
          id: `system:${issueIdentifier}:missing-session`,
          timestamp: null,
          kind: 'system',
          title: 'No Codex session linked',
          source: 'session_lookup',
          body: 'The issue payload points to a workspace, but no matching session file was found under ~/.codex/sessions.',
          details: null,
          call_id: null,
        },
      ],
    }
  }

  const fileContents = await readFile(match.filePath, 'utf8')
  const lines = fileContents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const entries: TranscriptEntry[] = []
  const pendingToolEntries = new Map<string, number>()
  let sessionMeta: SessionMeta = {
    id: sessionId,
    cwd: workspacePath,
    modelProvider: null,
    source: null,
  }

  for (const line of lines) {
    let record: unknown
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }

    if (!isRecord(record)) {
      continue
    }

    const timestamp = readOptionalString(record.timestamp)
    const recordType = readOptionalString(record.type)
    const payload = isRecord(record.payload) ? record.payload : null

    if (recordType === 'session_meta' && payload) {
      sessionMeta = {
        id: readOptionalString(payload.id),
        cwd: readOptionalString(payload.cwd),
        modelProvider: readOptionalString(payload.model_provider),
        source: readOptionalString(payload.source),
      }

      entries.push({
        id: `system:${entries.length}:session-meta`,
        timestamp,
        kind: 'system',
        title: 'Session opened',
        source: 'session_meta',
        body: [sessionMeta.cwd, sessionMeta.modelProvider, sessionMeta.source].filter(Boolean).join(' • '),
        details: null,
        call_id: null,
      })
      continue
    }

    if (recordType === 'turn_context' && payload) {
      const model = readOptionalString(payload.model)
      const effort = readOptionalString(payload.effort)
      entries.push({
        id: `system:${entries.length}:turn-context`,
        timestamp,
        kind: 'system',
        title: 'Turn context',
        source: 'turn_context',
        body: [model, effort].filter(Boolean).join(' • '),
        details: null,
        call_id: null,
      })
      continue
    }

    if (recordType === 'compacted') {
      entries.push({
        id: `system:${entries.length}:compacted`,
        timestamp,
        kind: 'system',
        title: 'Context compacted',
        source: 'compacted',
        body: 'Codex compacted the live context during this session.',
        details: null,
        call_id: null,
      })
      continue
    }

    if (recordType !== 'response_item' || !payload) {
      continue
    }

    const payloadType = readOptionalString(payload.type)
    if (payloadType === 'message') {
      const role = readOptionalString(payload.role)
      if (role === 'developer') {
        continue
      }

      const body = extractMessageText(payload.content)
      if (!body) {
        continue
      }

      const phase = readOptionalString(payload.phase)
      const kind: TranscriptEntryKind =
        role === 'user'
          ? 'user'
          : phase === 'commentary'
            ? 'commentary'
            : role === 'assistant'
              ? 'assistant'
              : 'system'

      entries.push({
        id: `message:${entries.length}`,
        timestamp,
        kind,
        title: formatMessageTitle(kind),
        source: phase ?? role ?? 'message',
        body,
        details: null,
        call_id: null,
      })
      continue
    }

    if (payloadType === 'function_call' || payloadType === 'custom_tool_call') {
      const callId = readOptionalString(payload.call_id) ?? `tool:${entries.length}`
      const toolName = readOptionalString(payload.name) ?? 'tool'
      const input = payloadType === 'custom_tool_call'
        ? readOptionalString(payload.input)
        : formatToolArguments(readOptionalString(payload.arguments))

      pendingToolEntries.set(callId, entries.length)
      entries.push({
        id: `tool:${callId}`,
        timestamp,
        kind: 'tool',
        title: toolName,
        source: payloadType,
        body: input ?? 'No tool input recorded.',
        details: null,
        call_id: callId,
      })
      continue
    }

    if (payloadType === 'function_call_output' || payloadType === 'custom_tool_call_output') {
      const callId = readOptionalString(payload.call_id)
      const output = readOptionalString(payload.output) ?? 'No tool output recorded.'
      const existingIndex = callId ? pendingToolEntries.get(callId) : undefined

      if (existingIndex !== undefined) {
        const existingEntry = entries[existingIndex]
        existingEntry.details = output
      } else {
        entries.push({
          id: `tool-output:${callId ?? entries.length}`,
          timestamp,
          kind: 'tool',
          title: 'Tool output',
          source: payloadType,
          body: output,
          details: null,
          call_id: callId ?? null,
        })
      }
    }
  }

  const sessionStats = await stat(match.filePath)
  const counts = entries.reduce(
    (accumulator, entry) => {
      accumulator.all += 1
      if (entry.kind === 'tool') {
        accumulator.tools += 1
      } else if (entry.kind === 'commentary') {
        accumulator.commentary += 1
      } else if (entry.kind === 'assistant' || entry.kind === 'user') {
        accumulator.messages += 1
      } else {
        accumulator.system += 1
      }

      return accumulator
    },
    { all: 0, messages: 0, commentary: 0, tools: 0, system: 0 },
  )

  return {
    session_id: sessionMeta.id ?? sessionId,
    session_file: match.filePath,
    resolved_via: match.resolvedVia,
    updated_at: sessionStats.mtime.toISOString(),
    counts,
    entries,
  }
}

function buildDiffBucket(kind: DiffBucketKind, label: string, description: string, patch: string): DiffBucket {
  const files = parsePatchFiles(patch)
  const summary = summarizeDiffFiles(files)

  return {
    kind,
    label,
    description,
    summary,
    files,
  }
}

function buildUntrackedBucket(paths: string[]): DiffBucket {
  const files = paths.map((pathValue, index) => ({
    id: `untracked:${index}:${pathValue}`,
    path: pathValue,
    previous_path: null,
    change_type: 'untracked' as const,
    additions: 0,
    deletions: 0,
    hunks: 0,
    patch: null,
    is_binary: false,
  }))

  return {
    kind: 'untracked',
    label: 'Untracked',
    description: 'Files present in the workspace but not added to git yet.',
    summary: summarizeDiffFiles(files),
    files,
  }
}

function emptyDiffBucket(kind: DiffBucketKind, description: string): DiffBucket {
  return {
    kind,
    label: capitalize(kind),
    description,
    summary: { file_count: 0, additions: 0, deletions: 0, hunk_count: 0 },
    files: [],
  }
}

function parsePatchFiles(patch: string): DiffFileArtifact[] {
  if (!patch.trim()) {
    return []
  }

  const lines = patch.split('\n')
  const files: DiffFileArtifact[] = []
  let current: string[] = []

  const flush = () => {
    if (current.length === 0) {
      return
    }

    const parsed = buildDiffFile(current)
    if (parsed) {
      files.push(parsed)
    }
    current = []
  }

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      flush()
    }
    current.push(line)
  }
  flush()

  return files
}

function buildDiffFile(lines: string[]): DiffFileArtifact | null {
  const header = lines[0]
  if (!header?.startsWith('diff --git ')) {
    return null
  }

  const headerMatch = /^diff --git a\/(.+) b\/(.+)$/.exec(header)
  let previousPath = headerMatch?.[1] ?? null
  let nextPath = headerMatch?.[2] ?? null
  let changeType: DiffChangeType = 'modified'
  let additions = 0
  let deletions = 0
  let hunks = 0
  let isBinary = false

  for (const line of lines.slice(1)) {
    if (line.startsWith('rename from ')) {
      previousPath = line.slice('rename from '.length)
      changeType = 'renamed'
    } else if (line.startsWith('rename to ')) {
      nextPath = line.slice('rename to '.length)
    } else if (line.startsWith('copy from ')) {
      previousPath = line.slice('copy from '.length)
      changeType = 'copied'
    } else if (line.startsWith('copy to ')) {
      nextPath = line.slice('copy to '.length)
    } else if (line.startsWith('new file mode ')) {
      changeType = 'added'
    } else if (line.startsWith('deleted file mode ')) {
      changeType = 'deleted'
    } else if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      isBinary = true
      changeType = 'binary'
    } else if (line.startsWith('@@')) {
      hunks += 1
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      additions += 1
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions += 1
    }
  }

  const pathValue = nextPath ?? previousPath
  if (!pathValue) {
    return null
  }

  return {
    id: `${changeType}:${pathValue}`,
    path: pathValue,
    previous_path: previousPath && previousPath !== pathValue ? previousPath : null,
    change_type: changeType,
    additions,
    deletions,
    hunks,
    patch: lines.join('\n'),
    is_binary: isBinary,
  }
}

function summarizeDiffFiles(files: DiffFileArtifact[]) {
  return files.reduce(
    (accumulator, file) => {
      accumulator.file_count += 1
      accumulator.additions += file.additions
      accumulator.deletions += file.deletions
      accumulator.hunk_count += file.hunks
      return accumulator
    },
    { file_count: 0, additions: 0, deletions: 0, hunk_count: 0 },
  )
}

function parseUntrackedFiles(statusText: string): string[] {
  return statusText
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith('?? '))
    .map((line) => line.slice(3))
}

async function resolveSessionFile(
  workspacePath: string,
  sessionId: string | null,
): Promise<SessionMatch | null> {
  const sessionPrefix = sessionId?.slice(0, 36) ?? null
  const files = await listSessionFiles()

  if (sessionPrefix) {
    const directMatch = files.find((filePath) => basename(filePath).includes(sessionPrefix))
    if (directMatch) {
      return {
        filePath: directMatch,
        resolvedVia: 'session_id',
      }
    }
  }

  const rankedFiles = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      stats: await stat(filePath),
    })),
  )

  rankedFiles.sort((left, right) => right.stats.mtimeMs - left.stats.mtimeMs)

  for (const candidate of rankedFiles.slice(0, 250)) {
    const firstLine = await readFirstLine(candidate.filePath)
    if (!firstLine) {
      continue
    }

    try {
      const parsed = JSON.parse(firstLine) as unknown
      if (!isRecord(parsed) || parsed.type !== 'session_meta' || !isRecord(parsed.payload)) {
        continue
      }

      if (parsed.payload.cwd === workspacePath) {
        return {
          filePath: candidate.filePath,
          resolvedVia: 'workspace',
        }
      }
    } catch {
      continue
    }
  }

  return null
}

async function listSessionFiles() {
  const files: string[] = []
  await walkDirectory(CODEX_SESSIONS_ROOT, files)
  return files.filter((filePath) => filePath.endsWith('.jsonl'))
}

async function walkDirectory(directoryPath: string, files: string[]) {
  let entries
  try {
    entries = await readdir(directoryPath, { withFileTypes: true })
  } catch {
    return
  }

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(directoryPath, entry.name)
      if (entry.isDirectory()) {
        await walkDirectory(fullPath, files)
        return
      }

      if (entry.isFile()) {
        files.push(fullPath)
      }
    }),
  )
}

async function readFirstLine(filePath: string): Promise<string | null> {
  const content = await readFile(filePath, 'utf8')
  const line = content.split('\n', 1)[0]?.trim()
  return line?.length ? line : null
}

async function resolveMainRef(workspacePath: string) {
  try {
    return await gitText(workspacePath, ['rev-parse', 'main'])
  } catch {
    return null
  }
}

async function resolveBranchCounts(workspacePath: string) {
  try {
    const output = await gitText(workspacePath, ['rev-list', '--left-right', '--count', 'main...HEAD'])
    const [behindRaw = '0', aheadRaw = '0'] = output.trim().split(/\s+/)
    return {
      behind: Number.parseInt(behindRaw, 10) || 0,
      ahead: Number.parseInt(aheadRaw, 10) || 0,
    }
  } catch {
    return { behind: 0, ahead: 0 }
  }
}

async function gitText(workspacePath: string, args: string[]) {
  const result = await execFileText('git', ['-C', workspacePath, ...args])
  return result.stdout.trim()
}

function execFileText(command: string, args: string[], cwd?: string) {
  return new Promise<ExecResult>((resolve, reject) => {
    execFile(command, args, { maxBuffer: 32 * 1024 * 1024, cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message))
        return
      }

      resolve({ stdout, stderr })
    })
  })
}

async function pathExists(pathValue: string) {
  try {
    await stat(pathValue)
    return true
  } catch {
    return false
  }
}

function extractMessageText(content: unknown): string | null {
  if (!Array.isArray(content)) {
    return null
  }

  const parts = content
    .map((item) => {
      if (!isRecord(item)) {
        return null
      }

      const value = readOptionalString(item.text)
      return value && value.trim() ? value : null
    })
    .filter((item): item is string => item !== null)

  return parts.length > 0 ? parts.join('\n\n') : null
}

function formatToolArguments(value: string | null) {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return JSON.stringify(parsed, null, 2)
  } catch {
    return value
  }
}

function formatMessageTitle(kind: TranscriptEntryKind) {
  switch (kind) {
    case 'assistant':
      return 'Assistant response'
    case 'commentary':
      return 'Commentary update'
    case 'user':
      return 'User prompt'
    case 'tool':
      return 'Tool trace'
    default:
      return 'System event'
  }
}

function sendJson(res: ServerResponse<IncomingMessage>, statusCode: number, payload: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function capitalize(value: string) {
  return `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`
}
