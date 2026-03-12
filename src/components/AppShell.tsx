import { Check, MoonStar, RefreshCw, SunMedium, Terminal } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { getLocalWorkspaces, getStateSnapshot, requestOrchestratorRefresh } from '../features/observability/api/client'
import { useTheme } from '../app/theme-context'
import { usePolledResource } from '../features/observability/hooks'
import { useCallback, useState } from 'react'
import type { LocalWorkspace, RunningSession, RetryingSession, StateResponse, LocalWorkspacesResponse } from '../features/observability/api/types'

type AgentStatus = 'running' | 'waiting' | 'done'

interface AgentEntry {
  id: string
  identifier: string
  status: AgentStatus
  detail: string
  sessionId: string | null
}

interface SidebarData {
  state: StateResponse
  workspaces: LocalWorkspacesResponse
}

function SymphonyLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="7" fill="currentColor" fillOpacity="0.1" />
      <path d="M7 18V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 20V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 21V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M23 17V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function buildAgentList(
  running: RunningSession[],
  retrying: RetryingSession[],
  localWorkspaces: LocalWorkspace[],
): AgentEntry[] {
  const agents: AgentEntry[] = []
  const seen = new Set<string>()

  for (const session of running) {
    seen.add(session.issue_identifier)
    const sid = session.session_id
    agents.push({
      id: session.issue_id,
      identifier: session.issue_identifier,
      status: 'running',
      detail: session.state,
      sessionId: sid.length > 36 ? sid.slice(0, 36) : sid,
    })
  }

  for (const session of retrying) {
    seen.add(session.issue_identifier)
    agents.push({
      id: session.issue_id,
      identifier: session.issue_identifier,
      status: 'waiting',
      detail: `Attempt ${session.attempt}`,
      sessionId: null,
    })
  }

  for (const ws of localWorkspaces) {
    if (!seen.has(ws.identifier)) {
      agents.push({
        id: `local:${ws.identifier}`,
        identifier: ws.identifier,
        status: 'done',
        detail: ws.branch ?? 'completed',
        sessionId: null,
      })
    }
  }

  agents.sort((a, b) => {
    const order: Record<AgentStatus, number> = { running: 0, waiting: 1, done: 2 }
    const statusDiff = order[a.status] - order[b.status]
    if (statusDiff !== 0) {
      return statusDiff
    }
    return a.identifier.localeCompare(b.identifier)
  })

  return agents
}

const STATUS_DOT_CLASS: Record<AgentStatus, string> = {
  running: 'agent-dot--running',
  waiting: 'agent-dot--waiting',
  done: 'agent-dot--done',
}

function AgentItem({ agent, isActive }: { agent: AgentEntry; isActive: boolean }) {
  const [copied, setCopied] = useState(false)

  function handleCopyResume(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!agent.sessionId) {
      return
    }
    navigator.clipboard.writeText(`codex resume ${agent.sessionId}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Link
      to={`/issues/${agent.identifier}`}
      className={`agent-item${isActive ? ' agent-item--active' : ''}`}
    >
      <span className={`agent-dot ${STATUS_DOT_CLASS[agent.status]}`} />
      <span className="agent-item__id">{agent.identifier}</span>
      <span className="agent-item__detail">{agent.detail}</span>
      {agent.sessionId ? (
        <button
          type="button"
          className={`agent-item__resume${copied ? ' agent-item__resume--copied' : ''}`}
          onClick={handleCopyResume}
          title={`codex resume ${agent.sessionId}`}
          aria-label="Copy resume command"
        >
          {copied ? <Check size={10} /> : <Terminal size={10} />}
        </button>
      ) : null}
    </Link>
  )
}

export function AppShell() {
  const location = useLocation()
  const { mode, toggleMode } = useTheme()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isIssuePage = location.pathname.startsWith('/issues/')

  const sidebarLoader = useCallback(async (): Promise<SidebarData> => {
    const [state, workspaces] = await Promise.all([
      getStateSnapshot(),
      getLocalWorkspaces(),
    ])
    return { state, workspaces }
  }, [])

  const { data: sidebarData } = usePolledResource(sidebarLoader, 8_000)
  const data = sidebarData?.state ?? null
  const agents = buildAgentList(
    data?.running ?? [],
    data?.retrying ?? [],
    sidebarData?.workspaces.workspaces ?? [],
  )
  const runningCount = agents.filter((a) => a.status === 'running').length
  const waitingCount = agents.filter((a) => a.status === 'waiting').length
  const doneCount = agents.filter((a) => a.status === 'done').length

  async function handleRefresh() {
    setIsRefreshing(true)
    try {
      await requestOrchestratorRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="brand">
          <div className="brand__logo">
            <SymphonyLogo />
          </div>
          <span className="brand__name">Symphony Monitor</span>
        </div>

        <nav className="nav">
          <NavLink
            className={({ isActive }) => `nav__item ${isActive ? 'nav__item--active' : ''}`}
            to="/"
            end
          >
            Overview
          </NavLink>
        </nav>

        {agents.length > 0 ? (
          <div className="agent-list">
            <div className="agent-list__header">
              <span className="agent-list__title">Agents</span>
              <span className="agent-list__counts">
                {runningCount > 0 ? <span className="agent-count agent-count--running">{runningCount}</span> : null}
                {waitingCount > 0 ? <span className="agent-count agent-count--waiting">{waitingCount}</span> : null}
                {doneCount > 0 ? <span className="agent-count agent-count--done">{doneCount}</span> : null}
              </span>
            </div>
            <div className="agent-list__items">
              {agents.map((agent) => (
                <AgentItem key={agent.id} agent={agent} isActive={location.pathname === `/issues/${agent.identifier}`} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleMode} type="button" aria-label={mode === 'light' ? 'Switch to dark' : 'Switch to light'}>
            {mode === 'light' ? <MoonStar size={14} /> : <SunMedium size={14} />}
            {mode === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
      </aside>

      <div className="shell__main">
        {isIssuePage ? null : (
          <header className="topbar">
            <div>
              <h1 className="topbar__title">Dashboard</h1>
              <p className="topbar__copy">
                Live overview of running agents, retries, and token spend.
              </p>
            </div>
            <button className="primary-button" disabled={isRefreshing} onClick={handleRefresh} type="button">
              <RefreshCw className={isRefreshing ? 'spin' : ''} size={14} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </header>
        )}

        <main className="shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
