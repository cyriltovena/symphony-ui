import { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  File,
  FileCode2,
  Folder,
  FolderTree,
  GitBranch,
  Layers,
  Maximize2,
  MessageCircle,
  Minimize2,
  Sparkles,
  Terminal,
  User,
  Wrench,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { StatusPill } from '../components/StatusPill'
import { getIssueArtifacts, getIssueSnapshot, getLocalWorkspaces } from '../api/client'
import { usePolledResource, useTicker } from '../hooks'
import { getChangeTypeLabel, getDiffLineTone } from '../issue-artifacts'
import type {
  DiffBucket,
  DiffBucketKind,
  DiffFileArtifact,
  IssueArtifactsResponse,
  IssueResponse,
  TranscriptEntry,
} from '../api/types'
import {
  formatElapsed,
  formatNumber,
  formatTimestamp,
  truncateMiddle,
} from '../../../lib/formatters'

type PageTab = 'transcript' | 'changes' | 'details'

interface IssuePageData {
  issue: IssueResponse
  artifacts: IssueArtifactsResponse
}

interface TicketContext {
  identifier: string
  title: string
  status: string
  url: string | null
  labels: string | null
  description: string | null
}

interface SubagentNotificationData {
  agentId: string
  status: string
  message: string
}

type TranscriptGroup =
  | { type: 'message'; entry: TranscriptEntry }
  | { type: 'agent-work'; entries: TranscriptEntry[] }
  | { type: 'system'; entry: TranscriptEntry }
  | { type: 'subagent-batch'; entries: TranscriptEntry[] }
  | { type: 'agents-md'; entry: TranscriptEntry }
  | { type: 'ticket-context'; entry: TranscriptEntry; ticket: TicketContext }

const DIFF_BUCKETS: DiffBucketKind[] = ['committed', 'staged', 'unstaged', 'untracked']

/* ── Pattern detection ─────────────────────────────────────── */

function isSubagentNotification(body: string): boolean {
  return body.trimStart().startsWith('<subagent_notification>')
}

function isAgentsMd(body: string): boolean {
  return body.trimStart().startsWith('# AGENTS.md instructions')
}

function isTicketContext(body: string): boolean {
  return /You are working on a Linear ticket/.test(body)
}

function parseTicketContext(body: string): TicketContext | null {
  const ticketMatch = body.match(/You are working on a Linear ticket `([^`]+)`/)
  if (!ticketMatch) {
    return null
  }

  const identifier = ticketMatch[1]
  const titleMatch = body.match(/Title:\s*(.+)/)
  const statusMatch = body.match(/Current status:\s*(.+)/)
  const urlMatch = body.match(/URL:\s*(https?:\/\/\S+)/)
  const labelsMatch = body.match(/Labels:\s*(.+)/)

  const descIdx = body.indexOf('\nDescription:')
  const description = descIdx >= 0 ? body.slice(descIdx + '\nDescription:'.length).trim() : null

  return {
    identifier,
    title: titleMatch?.[1]?.trim() ?? identifier,
    status: statusMatch?.[1]?.trim() ?? 'Unknown',
    url: urlMatch?.[1]?.trim() ?? null,
    labels: labelsMatch?.[1]?.trim() || null,
    description: description || null,
  }
}

function parseSubagentNotification(body: string): SubagentNotificationData | null {
  const jsonMatch = body.match(/<subagent_notification>\s*([\s\S]*?)\s*<\/subagent_notification>/)
  if (!jsonMatch) {
    return null
  }

  try {
    const data = JSON.parse(jsonMatch[1]) as Record<string, unknown>
    const agentId = typeof data.agent_id === 'string' ? data.agent_id : 'unknown'
    const statusObj =
      typeof data.status === 'object' && data.status !== null
        ? (data.status as Record<string, unknown>)
        : {}
    const statusKey = Object.keys(statusObj)[0] ?? 'unknown'
    const statusMessage = statusObj[statusKey]

    return {
      agentId,
      status: statusKey,
      message: typeof statusMessage === 'string' ? statusMessage : JSON.stringify(statusMessage),
    }
  } catch {
    return null
  }
}

function extractTicketFromEntries(entries: TranscriptEntry[]): TicketContext | null {
  for (const entry of entries) {
    if (entry.kind === 'user' && isTicketContext(entry.body)) {
      return parseTicketContext(entry.body)
    }
  }
  return null
}

function resolveSessionId(issue: IssueResponse, transcriptSessionId: string | null): string | null {
  const raw = issue.running?.session_id ?? transcriptSessionId
  if (!raw) {
    return null
  }
  return raw.length > 36 ? raw.slice(0, 36) : raw
}

function ResumeCommand({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false)
  const command = `codex resume ${sessionId}`

  function handleCopy() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button type="button" className={`resume-cmd${copied ? ' resume-cmd--copied' : ''}`} title={command} onClick={handleCopy}>
      <Terminal size={11} />
      <code className="resume-cmd__text">
        {copied ? 'Copied!' : `resume ${sessionId.slice(0, 8)}…`}
      </code>
    </button>
  )
}

function ResumeCommandBlock({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false)
  const command = `codex resume ${sessionId}`

  function handleCopy() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button type="button" className={`resume-block${copied ? ' resume-block--copied' : ''}`} onClick={handleCopy}>
      <Terminal size={13} />
      <code className="resume-block__cmd">{command}</code>
      <span className="resume-block__hint">{copied ? 'Copied!' : 'Click to copy'}</span>
    </button>
  )
}

/* ── Main component ────────────────────────────────────────── */

export function IssuePage() {
  const { issueIdentifier = '' } = useParams()
  const now = useTicker(1000)
  const [activeTab, setActiveTab] = useState<PageTab>('transcript')

  const loader = useCallback(async (): Promise<IssuePageData> => {
    let issue: IssueResponse
    try {
      issue = await getIssueSnapshot(issueIdentifier)
    } catch {
      const ws = await getLocalWorkspaces()
      const match = ws.workspaces.find((w) => w.identifier === issueIdentifier)
      const workspacePath = match?.path ?? `${ws.root}/${issueIdentifier}`

      issue = {
        issue_identifier: issueIdentifier,
        issue_id: `local:${issueIdentifier}`,
        status: 'done',
        workspace: { path: workspacePath },
        attempts: { restart_count: 0, current_retry_attempt: 0 },
        running: null,
        retry: null,
        logs: { codex_session_logs: [] },
        recent_events: [],
        last_error: null,
        tracked: {},
      }
    }

    const artifacts = await getIssueArtifacts(
      issueIdentifier,
      issue.workspace.path,
      issue.running?.session_id ?? null,
    )
    return { issue, artifacts }
  }, [issueIdentifier])

  const { data, error, isLoading } = usePolledResource(loader, 5_000)

  const ticketContext = useMemo(
    () => (data ? extractTicketFromEntries(data.artifacts.transcript.entries) : null),
    [data],
  )

  useEffect(() => {
    if (ticketContext) {
      document.title = `${ticketContext.identifier} · ${ticketContext.title} — Symphony Monitor`
    } else {
      document.title = `${issueIdentifier} — Symphony Monitor`
    }
    return () => {
      document.title = 'Symphony Monitor'
    }
  }, [ticketContext, issueIdentifier])

  if (isLoading && !data) {
    return <div className="issue-loading">Loading {issueIdentifier}...</div>
  }

  if (error && !data) {
    return <div className="issue-error">Unable to load issue: {error}</div>
  }

  if (!data) {
    return null
  }

  const { issue, artifacts } = data
  const isRunning = issue.running !== null
  const sessionId = resolveSessionId(issue, artifacts.transcript.session_id)

  return (
    <div className="issue-page">
      <header className="issue-header">
        <div className="issue-header__left">
          <Link to="/" className="issue-header__back" aria-label="Back to overview">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="issue-header__id">{issue.issue_identifier}</h1>
          <StatusPill tone={issue.last_error ? 'error' : issue.retry ? 'warning' : 'success'}>
            {issue.status}
          </StatusPill>
          {ticketContext ? (
            <span className="issue-header__title">{ticketContext.title}</span>
          ) : null}
        </div>
        <div className="issue-header__right">
          {sessionId ? <ResumeCommand sessionId={sessionId} /> : null}
          {ticketContext?.url ? (
            <a
              className="issue-header__linear-link"
              href={ticketContext.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={12} />
              Linear
            </a>
          ) : null}
          {artifacts.workspace.branch ? (
            <span className="issue-header__branch">
              <GitBranch size={13} />
              {artifacts.workspace.branch}
            </span>
          ) : null}
          {issue.running ? (
            <span className="issue-header__elapsed">
              {formatElapsed(issue.running.started_at, now)}
            </span>
          ) : null}
          {issue.running ? (
            <span className="issue-header__live-dot" title="Session active" />
          ) : null}
        </div>
      </header>

      {issue.last_error ? (
        <div className="issue-alert">
          <AlertTriangle size={14} />
          <span>{issue.last_error}</span>
          {issue.retry ? (
            <span className="issue-alert__retry">
              Attempt {issue.retry.attempt} due {formatTimestamp(issue.retry.due_at)}
            </span>
          ) : null}
        </div>
      ) : null}

      <nav className="issue-tabs" role="tablist">
        {(['transcript', 'changes', 'details'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`issue-tab${activeTab === tab ? ' issue-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'transcript' ? <MessageCircle size={14} /> : null}
            {tab === 'changes' ? <FileCode2 size={14} /> : null}
            {tab === 'details' ? <Terminal size={14} /> : null}
            <span>{capitalize(tab)}</span>
            {tab === 'changes' ? (
              <span className="issue-tab__count">
                {artifacts.diff_buckets.reduce((sum, b) => sum + b.summary.file_count, 0)}
              </span>
            ) : null}
            {tab === 'transcript' ? (
              <span className="issue-tab__count">
                {artifacts.transcript.counts.all}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="issue-content">
        {activeTab === 'transcript' ? (
          <TranscriptTab entries={artifacts.transcript.entries} isLive={isRunning} />
        ) : null}
        {activeTab === 'changes' ? (
          <ChangesTab diffBuckets={artifacts.diff_buckets} />
        ) : null}
        {activeTab === 'details' ? (
          <DetailsTab issue={issue} artifacts={artifacts} now={now} ticketContext={ticketContext} sessionId={sessionId} />
        ) : null}
      </div>
    </div>
  )
}

/* ── Transcript tab ────────────────────────────────────────── */

function TranscriptTab({ entries, isLive }: { entries: TranscriptEntry[]; isLive: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const groups = useMemo(() => groupTranscriptEntries(entries), [entries])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length])

  if (groups.length === 0) {
    return <div className="issue-empty">No transcript entries yet.</div>
  }

  return (
    <div className="transcript" ref={scrollRef}>
      {groups.map((group, index) => {
        if (group.type === 'system') {
          return <SystemEntry key={group.entry.id} entry={group.entry} />
        }
        if (group.type === 'agent-work') {
          const isLastWork = !groups.slice(index + 1).some((g) => g.type === 'agent-work')
          return <AgentWorkBlock key={`work-${index}`} entries={group.entries} isLast={isLastWork} />
        }
        if (group.type === 'subagent-batch') {
          return <SubagentBatch key={`sub-${index}`} entries={group.entries} />
        }
        if (group.type === 'agents-md') {
          return <AgentsMdEntry key={group.entry.id} entry={group.entry} />
        }
        if (group.type === 'ticket-context') {
          return <TicketContextBanner key={group.entry.id} ticket={group.ticket} />
        }
        return <MessageEntry key={group.entry.id} entry={group.entry} />
      })}
      {isLive ? (
        <div className="transcript__live-indicator">
          <span className="transcript__live-dot" />
          Listening for updates...
        </div>
      ) : null}
    </div>
  )
}

/* ── Message ───────────────────────────────────────────────── */

function MessageEntry({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.kind === 'user'

  return (
    <div className={`msg msg--${entry.kind}`}>
      <div className="msg__avatar">
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className="msg__body">
        <div className="msg__meta">
          <span className="msg__role">{isUser ? 'You' : 'Agent'}</span>
          {entry.timestamp ? (
            <time className="msg__time">{formatTimestamp(entry.timestamp)}</time>
          ) : null}
        </div>
        <div className="msg__text">{entry.body}</div>
      </div>
    </div>
  )
}

/* ── System entry ──────────────────────────────────────────── */

function SystemEntry({ entry }: { entry: TranscriptEntry }) {
  return (
    <div className="sys-entry">
      <span className="sys-entry__line" />
      <span className="sys-entry__label">{entry.title}</span>
      <span className="sys-entry__line" />
    </div>
  )
}

/* ── Agent work (thinking + tools grouped) ─────────────────── */

function AgentWorkBlock({ entries, isLast }: { entries: TranscriptEntry[]; isLast: boolean }) {
  const [expanded, setExpanded] = useState(isLast)
  const [userToggled, setUserToggled] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const thoughtCount = entries.filter((e) => e.kind === 'commentary').length
  const toolCount = entries.filter((e) => e.kind === 'tool').length

  const parts: string[] = []
  if (thoughtCount > 0) {
    parts.push(`${thoughtCount} thought${thoughtCount > 1 ? 's' : ''}`)
  }
  if (toolCount > 0) {
    parts.push(`${toolCount} tool call${toolCount > 1 ? 's' : ''}`)
  }

  const firstThought = entries.find((e) => e.kind === 'commentary')
  const preview = firstThought
    ? firstThought.body.length > 100
      ? `${firstThought.body.slice(0, 100)}…`
      : firstThought.body
    : null

  useEffect(() => {
    if (!userToggled) {
      setExpanded(isLast)
    }
  }, [isLast, userToggled])

  useEffect(() => {
    if (expanded && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [expanded, entries.length])

  const handleToggle = () => {
    setUserToggled(true)
    setExpanded((prev) => !prev)
  }

  return (
    <div className="agent-work">
      <button
        type="button"
        className="agent-work__header"
        onClick={handleToggle}
      >
        <span className="agent-work__chevron">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <Sparkles size={12} />
        <span className="agent-work__summary">{parts.join(', ')}</span>
        {!expanded && preview ? (
          <span className="agent-work__preview">{preview}</span>
        ) : null}
      </button>
      {expanded ? (
        <div className="agent-work__scroll" ref={listRef}>
          <div className="agent-work__list">
            {entries.map((entry) => {
              if (entry.kind === 'commentary') {
                return (
                  <div key={entry.id} className="agent-work__thought">
                    <Sparkles size={11} />
                    <span>{entry.body}</span>
                  </div>
                )
              }
              return <ToolEntry key={entry.id} entry={entry} />
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ── Tool entry (inside agent work) ────────────────────────── */

const PATCH_TOOL_NAMES = new Set(['apply_patch', 'apply_diff', 'patch', 'write_file', 'create_file', 'edit_file'])

function isPatchBody(title: string, body: string): boolean {
  if (PATCH_TOOL_NAMES.has(title)) {
    return true
  }
  const first200 = body.slice(0, 200)
  return /^---\s|^\+\+\+\s|^@@\s|^diff --git/m.test(first200)
}

function extractPatchFilePath(body: string): string | null {
  const m = body.match(/^\+\+\+\s+(?:b\/)?(.+)/m)
  if (m) { return m[1].trim() }
  const hdr = body.match(/^---\s+(?:a\/)?(.+)/m)
  if (hdr && hdr[1] !== '/dev/null') { return hdr[1].trim() }
  return null
}

function parsePatchBody(body: string) {
  const lines = body.split('\n')
  const result: { line: string; tone: string; oldNum: number | null; newNum: number | null }[] = []
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    const tone = getDiffLineTone(line)

    if (tone === 'hunk') {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/)
      if (match) {
        oldLine = parseInt(match[1], 10)
        newLine = parseInt(match[2], 10)
      }
      result.push({ line, tone, oldNum: null, newNum: null })
      continue
    }

    if (tone === 'meta') {
      result.push({ line, tone, oldNum: null, newNum: null })
      continue
    }

    if (tone === 'add') {
      result.push({ line, tone, oldNum: null, newNum: newLine })
      newLine++
    } else if (tone === 'remove') {
      result.push({ line, tone, oldNum: oldLine, newNum: null })
      oldLine++
    } else {
      result.push({ line, tone, oldNum: oldLine, newNum: newLine })
      oldLine++
      newLine++
    }
  }
  return result
}

function InlinePatchViewer({ body }: { body: string }) {
  const filePath = extractPatchFilePath(body)
  const lines = parsePatchBody(body)
  const addCount = lines.filter((l) => l.tone === 'add').length
  const delCount = lines.filter((l) => l.tone === 'remove').length

  return (
    <div className="inline-patch">
      <div className="inline-patch__header">
        <FileCode2 size={12} className="inline-patch__icon" />
        <span className="inline-patch__path">{filePath ?? 'patch'}</span>
        <span className="inline-patch__stats">
          {addCount > 0 ? <span className="ftree-add">+{addCount}</span> : null}
          {delCount > 0 ? <span className="ftree-del">-{delCount}</span> : null}
        </span>
      </div>
      <div className="inline-patch__body">
        <table className="patch-table">
          <tbody>
            {lines.map((entry, index) => (
              <tr className={`patch-row patch-row--${entry.tone}`} key={index}>
                <td className="patch-gutter patch-gutter--old">
                  {entry.oldNum ?? ''}
                </td>
                <td className="patch-gutter patch-gutter--new">
                  {entry.newNum ?? ''}
                </td>
                <td className="patch-sign">
                  {entry.tone === 'add' ? '+' : entry.tone === 'remove' ? '−' : ' '}
                </td>
                <td className="patch-code">
                  <code>{entry.line.replace(/^[+-]/, '') || ' '}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ToolEntry({ entry }: { entry: TranscriptEntry }) {
  const [showOutput, setShowOutput] = useState(false)
  const isPatch = isPatchBody(entry.title, entry.body)

  return (
    <div className="tool-entry">
      <div className="tool-entry__header">
        {isPatch ? <FileCode2 size={11} /> : <Wrench size={11} />}
        <code className="tool-entry__name">{entry.title}</code>
        {entry.timestamp ? (
          <time className="tool-entry__time">{formatTimestamp(entry.timestamp)}</time>
        ) : null}
      </div>
      {isPatch ? (
        <InlinePatchViewer body={entry.body} />
      ) : (
        <pre className="tool-entry__input">{entry.body}</pre>
      )}
      {entry.details ? (
        <>
          <button
            type="button"
            className="tool-entry__toggle"
            onClick={() => setShowOutput(!showOutput)}
          >
            {showOutput ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {showOutput ? 'Hide output' : 'Show output'}
          </button>
          {showOutput ? (
            <pre className="tool-entry__output">{entry.details}</pre>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/* ── Subagent notifications ────────────────────────────────── */

function SubagentBatch({ entries }: { entries: TranscriptEntry[] }) {
  const [expanded, setExpanded] = useState(false)
  const parsed = entries
    .map((e) => ({ entry: e, data: parseSubagentNotification(e.body) }))
    .filter(
      (p): p is { entry: TranscriptEntry; data: SubagentNotificationData } => p.data !== null,
    )

  return (
    <div className="subagent-batch">
      <button
        type="button"
        className="subagent-batch__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="subagent-batch__chevron">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <Layers size={12} />
        <span className="subagent-batch__summary">
          {entries.length} subagent result{entries.length > 1 ? 's' : ''}
        </span>
        {!expanded && parsed.length > 0 ? (
          <span className="subagent-batch__statuses">
            {parsed.map((p) => (
              <span
                key={p.data.agentId}
                className={`subagent-batch__pill subagent-batch__pill--${p.data.status}`}
              >
                {p.data.status}
              </span>
            ))}
          </span>
        ) : null}
      </button>
      {expanded ? (
        <div className="subagent-batch__list">
          {parsed.map((p) => (
            <SubagentEntry key={p.data.agentId} data={p.data} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SubagentEntry({ data }: { data: SubagentNotificationData }) {
  const [showFull, setShowFull] = useState(false)
  const isLong = data.message.length > 200

  return (
    <div className="subagent-entry">
      <div className="subagent-entry__header">
        <span className={`subagent-entry__status subagent-entry__status--${data.status}`}>
          {data.status}
        </span>
        <code className="subagent-entry__id">{truncateMiddle(data.agentId)}</code>
      </div>
      <div className="subagent-entry__message">
        {showFull || !isLong ? data.message : `${data.message.slice(0, 200)}…`}
      </div>
      {isLong ? (
        <button
          type="button"
          className="tool-entry__toggle"
          onClick={() => setShowFull(!showFull)}
        >
          {showFull ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  )
}

/* ── AGENTS.md instructions (collapsed) ────────────────────── */

function AgentsMdEntry({ entry }: { entry: TranscriptEntry }) {
  const [expanded, setExpanded] = useState(false)
  const workspace = entry.body.match(/# AGENTS\.md instructions for (.+)/)?.[1] ?? ''

  return (
    <div className="agents-md">
      <button
        type="button"
        className="agents-md__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="agents-md__chevron">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <FolderTree size={12} />
        <span className="agents-md__label">AGENTS.md instructions</span>
        {workspace ? <span className="agents-md__path">{workspace}</span> : null}
      </button>
      {expanded ? (
        <pre className="agents-md__body">{entry.body}</pre>
      ) : null}
    </div>
  )
}

/* ── Ticket context banner ─────────────────────────────────── */

function TicketContextBanner({ ticket }: { ticket: TicketContext }) {
  const [showDesc, setShowDesc] = useState(false)
  const statusSlug = ticket.status.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="ticket-banner">
      <div className="ticket-banner__top">
        <span className="ticket-banner__id">{ticket.identifier}</span>
        <span className={`ticket-banner__status ticket-banner__status--${statusSlug}`}>
          {ticket.status}
        </span>
        {ticket.url ? (
          <a
            className="ticket-banner__link"
            href={ticket.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={11} />
            Linear
          </a>
        ) : null}
      </div>
      <div className="ticket-banner__title">{ticket.title}</div>
      {ticket.description ? (
        <>
          <button
            type="button"
            className="ticket-banner__desc-toggle"
            onClick={() => setShowDesc(!showDesc)}
          >
            {showDesc ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {showDesc ? 'Hide description' : 'Show description'}
          </button>
          {showDesc ? (
            <pre className="ticket-banner__desc">{ticket.description}</pre>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/* ── Changes tab ───────────────────────────────────────────── */

interface FileTreeNode {
  name: string
  path: string
  file?: DiffFileArtifact
  children: Map<string, FileTreeNode>
}

function buildFileTree(files: DiffFileArtifact[]): FileTreeNode {
  const root: FileTreeNode = { name: '', path: '', children: new Map() }
  for (const file of files) {
    const parts = file.path.split('/')
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          children: new Map(),
        })
      }
      node = node.children.get(part)!
    }
    node.file = file
  }
  return collapseSingleChildDirs(root)
}

function collapseSingleChildDirs(node: FileTreeNode): FileTreeNode {
  const newChildren = new Map<string, FileTreeNode>()
  for (const [key, child] of node.children) {
    let collapsed = collapseSingleChildDirs(child)
    while (!collapsed.file && collapsed.children.size === 1) {
      const [, grandChild] = [...collapsed.children.entries()][0]
      collapsed = {
        ...grandChild,
        name: `${collapsed.name}/${grandChild.name}`,
      }
    }
    newChildren.set(key, collapsed)
  }
  return { ...node, children: newChildren }
}


function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: FileTreeNode
  depth: number
  selectedPath: string | null
  onSelect: (file: DiffFileArtifact) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const sortedChildren = useMemo(
    () =>
      [...node.children.values()].sort((a, b) => {
        const aDir = a.children.size > 0 && !a.file ? 0 : 1
        const bDir = b.children.size > 0 && !b.file ? 0 : 1
        return aDir - bDir || a.name.localeCompare(b.name)
      }),
    [node.children],
  )

  if (node.file) {
    const isActive = selectedPath === node.file.path
    return (
      <button
        type="button"
        className={`ftree-file${isActive ? ' ftree-file--active' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onSelect(node.file!)}
      >
        <File size={12} className="ftree-file__icon" />
        <span className="ftree-file__name">{node.name}</span>
        <span className="ftree-file__stats">
          {node.file.additions > 0 ? <span className="ftree-add">+{node.file.additions}</span> : null}
          {node.file.deletions > 0 ? <span className="ftree-del">-{node.file.deletions}</span> : null}
        </span>
      </button>
    )
  }

  if (node.children.size === 0) {
    return null
  }

  return (
    <div className="ftree-dir">
      <button
        type="button"
        className="ftree-dir__toggle"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Folder size={12} />
        <span className="ftree-dir__name">{node.name}</span>
      </button>
      {open
        ? sortedChildren.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  )
}


function ChangesTab({ diffBuckets }: { diffBuckets: DiffBucket[] }) {
  const [enabledBuckets, setEnabledBuckets] = useState<Set<DiffBucketKind>>(
    () => new Set(DIFF_BUCKETS),
  )
  const [selectedFile, setSelectedFile] = useState<DiffFileArtifact | null>(null)
  const [expanded, setExpanded] = useState(false)

  const toggleBucket = useCallback((kind: DiffBucketKind) => {
    setEnabledBuckets((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) {
        if (next.size > 1) {
          next.delete(kind)
        }
      } else {
        next.add(kind)
      }
      return next
    })
  }, [])

  const totalFiles = diffBuckets.reduce((sum, b) => sum + b.summary.file_count, 0)

  const allFiles = useMemo(
    () => diffBuckets.filter((b) => enabledBuckets.has(b.kind)).flatMap((b) => b.files),
    [diffBuckets, enabledBuckets],
  )
  const tree = useMemo(() => buildFileTree(allFiles), [allFiles])
  const activeFile = selectedFile && allFiles.some((f) => f.id === selectedFile.id)
    ? selectedFile
    : allFiles[0] ?? null

  const totalAdd = allFiles.reduce((s, f) => s + f.additions, 0)
  const totalDel = allFiles.reduce((s, f) => s + f.deletions, 0)

  const fileIndex = activeFile ? allFiles.findIndex((f) => f.id === activeFile.id) : -1
  const goPrev = () => {
    if (fileIndex > 0) { setSelectedFile(allFiles[fileIndex - 1]) }
  }
  const goNext = () => {
    if (fileIndex < allFiles.length - 1) { setSelectedFile(allFiles[fileIndex + 1]) }
  }

  const allEnabled = enabledBuckets.size === DIFF_BUCKETS.length

  if (totalFiles === 0) {
    return <div className="issue-empty">No changes detected in the workspace.</div>
  }

  return (
    <div className={`changes-v2${expanded ? ' changes-v2--expanded' : ''}`}>
      <div className="changes-v2__toolbar">
        <div className="changes__buckets">
          {DIFF_BUCKETS.map((kind) => {
            const b = diffBuckets.find((x) => x.kind === kind)
            const count = b?.summary.file_count ?? 0
            const isOn = enabledBuckets.has(kind)
            return (
              <button
                key={kind}
                type="button"
                className={`changes__bucket-btn${isOn ? ' changes__bucket-btn--active' : ''}`}
                onClick={() => toggleBucket(kind)}
              >
                <span>{capitalize(kind)}</span>
                <span className="changes__bucket-count">{count}</span>
              </button>
            )
          })}
          {!allEnabled ? (
            <button
              type="button"
              className="changes__bucket-btn changes__bucket-btn--reset"
              onClick={() => setEnabledBuckets(new Set(DIFF_BUCKETS))}
            >
              All
            </button>
          ) : null}
        </div>
        <div className="changes-v2__summary">
          <span className="changes-v2__file-count">{allFiles.length} file{allFiles.length !== 1 ? 's' : ''}</span>
          {totalAdd > 0 ? <span className="ftree-add">+{totalAdd}</span> : null}
          {totalDel > 0 ? <span className="ftree-del">-{totalDel}</span> : null}
        </div>
      </div>
      {allFiles.length > 0 ? (
        <div className="changes-v2__split">
          <div className="changes-v2__diff">
            {activeFile ? (
              <>
                <div className="diff-header">
                  <FileCode2 size={13} className="diff-header__icon" />
                  <span className="diff-header__path">{activeFile.path}</span>
                  <span className="diff-header__stats">
                    {activeFile.additions > 0 ? <span className="ftree-add">+{activeFile.additions}</span> : null}
                    {activeFile.deletions > 0 ? <span className="ftree-del">-{activeFile.deletions}</span> : null}
                  </span>
                  <StatusPill>{getChangeTypeLabel(activeFile.change_type)}</StatusPill>
                  <span className="diff-header__nav">
                    <button
                      type="button"
                      className="diff-nav-btn"
                      disabled={fileIndex <= 0}
                      onClick={goPrev}
                      title="Previous file"
                    >‹</button>
                    <span className="diff-nav-pos">{fileIndex + 1}/{allFiles.length}</span>
                    <button
                      type="button"
                      className="diff-nav-btn"
                      disabled={fileIndex >= allFiles.length - 1}
                      onClick={goNext}
                      title="Next file"
                    >›</button>
                  </span>
                  <button
                    type="button"
                    className="diff-expand-btn"
                    onClick={() => setExpanded(!expanded)}
                    title={expanded ? 'Collapse' : 'Expand'}
                  >
                    {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>
                </div>
                <DiffPatchViewer file={activeFile} />
              </>
            ) : (
              <div className="issue-empty issue-empty--compact">Select a file to view changes</div>
            )}
          </div>
          <div className="changes-v2__tree">
            <div className="ftree-header">
              <FolderTree size={12} />
              <span>Files</span>
            </div>
            {[...tree.children.values()].map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={0}
                selectedPath={activeFile?.path ?? null}
                onSelect={setSelectedFile}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="issue-empty">No files in this category.</div>
      )}
    </div>
  )
}

function DiffPatchViewer({ file }: { file: DiffFileArtifact }) {
  if (!file.patch) {
    return (
      <div className="issue-empty issue-empty--compact">
        {file.change_type === 'untracked'
          ? 'Untracked files have no patch until staged.'
          : 'No patch available.'}
      </div>
    )
  }

  const lines = parsePatchBody(file.patch)

  return (
    <div className="patch-viewer">
      <table className="patch-table">
        <tbody>
          {lines.map((entry, index) => (
            <tr className={`patch-row patch-row--${entry.tone}`} key={`${file.id}:${index}`}>
              <td className="patch-gutter patch-gutter--old">
                {entry.oldNum ?? ''}
              </td>
              <td className="patch-gutter patch-gutter--new">
                {entry.newNum ?? ''}
              </td>
              <td className="patch-sign">
                {entry.tone === 'add' ? '+' : entry.tone === 'remove' ? '−' : ' '}
              </td>
              <td className="patch-code">
                <code>{entry.line.replace(/^[+-]/, '') || ' '}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Details tab ───────────────────────────────────────────── */

function DetailsTab({
  issue,
  artifacts,
  now,
  ticketContext,
  sessionId,
}: {
  issue: IssueResponse
  artifacts: IssueArtifactsResponse
  now: number
  ticketContext: TicketContext | null
  sessionId: string | null
}) {
  const workspace = artifacts.workspace
  const transcript = artifacts.transcript

  return (
    <div className="details">
      {sessionId ? (
        <section className="details__section">
          <h3 className="details__heading">Resume session</h3>
          <ResumeCommandBlock sessionId={sessionId} />
        </section>
      ) : null}

      {ticketContext ? (
        <section className="details__section">
          <h3 className="details__heading">Ticket</h3>
          <div className="ticket-detail">
            <div className="ticket-detail__row">
              <span className="ticket-detail__id">{ticketContext.identifier}</span>
              <span className={`ticket-banner__status ticket-banner__status--${ticketContext.status.toLowerCase().replace(/\s+/g, '-')}`}>
                {ticketContext.status}
              </span>
              {ticketContext.url ? (
                <a
                  className="ticket-detail__link"
                  href={ticketContext.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={11} />
                  Open in Linear
                </a>
              ) : null}
            </div>
            <div className="ticket-detail__title">{ticketContext.title}</div>
            {ticketContext.labels ? (
              <div className="ticket-detail__labels">
                <span className="detail-row__label">Labels</span>
                {ticketContext.labels}
              </div>
            ) : null}
            {ticketContext.description ? (
              <details className="ticket-detail__desc-details">
                <summary>Description</summary>
                <pre className="ticket-detail__desc">{ticketContext.description}</pre>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}

      {issue.running ? (
        <section className="details__section">
          <h3 className="details__heading">Session</h3>
          <div className="details__grid">
            <DetailRow label="State" value={issue.running.state} />
            <DetailRow label="Session" value={truncateMiddle(issue.running.session_id)} mono />
            <DetailRow label="Runtime" value={formatElapsed(issue.running.started_at, now)} />
            <DetailRow label="Turns" value={formatNumber(issue.running.turn_count)} />
            <DetailRow label="Tokens" value={formatNumber(issue.running.tokens.total_tokens)} />
            <DetailRow label="Last event" value={formatTimestamp(issue.running.last_event_at)} />
          </div>
        </section>
      ) : null}

      <section className="details__section">
        <h3 className="details__heading">Workspace</h3>
        <div className="details__grid">
          <DetailRow label="Path" value={issue.workspace.path} mono />
          <DetailRow label="Branch" value={workspace.branch ?? 'Detached'} />
          <DetailRow label="Ahead" value={String(workspace.ahead_count)} />
          <DetailRow label="Behind" value={String(workspace.behind_count)} />
          <DetailRow label="Restarts" value={String(issue.attempts.restart_count)} />
          <DetailRow label="Retry #" value={String(issue.attempts.current_retry_attempt)} />
        </div>
      </section>

      <section className="details__section">
        <h3 className="details__heading">Transcript source</h3>
        <div className="details__grid">
          <DetailRow label="Resolved via" value={transcript.resolved_via.replace('_', ' ')} />
          <DetailRow label="Session file" value={transcript.session_file ?? 'None'} mono />
          <DetailRow label="Messages" value={String(transcript.counts.messages)} />
          <DetailRow label="Tool calls" value={String(transcript.counts.tools)} />
          <DetailRow label="Commentary" value={String(transcript.counts.commentary)} />
        </div>
      </section>

      {issue.recent_events.length > 0 ? (
        <section className="details__section">
          <h3 className="details__heading">Recent events</h3>
          <div className="details__events">
            {issue.recent_events.map((event) => (
              <div className="event-row" key={`${event.at}-${event.message}`}>
                <span className={`event-row__dot event-row__dot--${event.event === 'error' ? 'error' : 'default'}`} />
                <span className="event-row__message">{event.message}</span>
                <time className="event-row__time">{formatTimestamp(event.at)}</time>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="details__section">
        <details className="details__raw">
          <summary>Raw JSON payload</summary>
          <pre>{JSON.stringify(issue, null, 2)}</pre>
        </details>
      </section>
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="detail-row">
      <dt className="detail-row__label">{label}</dt>
      <dd className={`detail-row__value${mono ? ' detail-row__value--mono' : ''}`}>{value}</dd>
    </div>
  )
}

/* ── Grouping logic ────────────────────────────────────────── */

function groupTranscriptEntries(entries: TranscriptEntry[]): TranscriptGroup[] {
  const groups: TranscriptGroup[] = []
  let workBuffer: TranscriptEntry[] = []
  let subagentBuffer: TranscriptEntry[] = []

  const flushWork = () => {
    if (workBuffer.length > 0) {
      groups.push({ type: 'agent-work', entries: [...workBuffer] })
      workBuffer = []
    }
  }

  const flushSubagents = () => {
    if (subagentBuffer.length > 0) {
      groups.push({ type: 'subagent-batch', entries: [...subagentBuffer] })
      subagentBuffer = []
    }
  }

  for (const entry of entries) {
    if (entry.kind === 'commentary' || entry.kind === 'tool') {
      flushSubagents()
      workBuffer.push(entry)
      continue
    }

    flushWork()

    if (entry.kind === 'system') {
      flushSubagents()
      groups.push({ type: 'system', entry })
      continue
    }

    if (entry.kind === 'user') {
      if (isSubagentNotification(entry.body)) {
        subagentBuffer.push(entry)
        continue
      }

      flushSubagents()

      if (isAgentsMd(entry.body)) {
        groups.push({ type: 'agents-md', entry })
        continue
      }

      if (isTicketContext(entry.body)) {
        const ticket = parseTicketContext(entry.body)
        if (ticket) {
          groups.push({ type: 'ticket-context', entry, ticket })
          continue
        }
      }
    }

    flushSubagents()
    groups.push({ type: 'message', entry })
  }

  flushWork()
  flushSubagents()
  return groups
}

function capitalize(value: string) {
  return `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`
}
