import { Activity, MoonStar, RefreshCw, SunMedium } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { requestOrchestratorRefresh } from '../features/observability/api/client'
import { useTheme } from '../app/theme-context'
import { useState } from 'react'

const pageMeta = {
  '/': {
    title: 'Operations dashboard',
    description: 'Live overview of running sessions, retries, tokens, and rate limits.',
  },
} as const

export function AppShell() {
  const location = useLocation()
  const { mode, toggleMode } = useTheme()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const meta =
    location.pathname === '/'
      ? pageMeta['/']
      : {
          title: 'Issue detail',
          description: 'Detailed view of one issue session, its workspace, events, and retries.',
        }

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
          <div className="brand__badge">
            <Activity size={18} />
          </div>
          <div>
            <p className="brand__eyebrow">Halo x Symphony</p>
            <strong className="brand__title">Observability UI</strong>
          </div>
        </div>

        <nav className="nav">
          <NavLink className={({ isActive }) => `nav__item ${isActive ? 'nav__item--active' : ''}`} to="/">
            Overview
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-footer__label">Theme</p>
          <button className="ghost-button" onClick={toggleMode} type="button">
            {mode === 'light' ? <MoonStar size={16} /> : <SunMedium size={16} />}
            {mode === 'light' ? 'Switch to dark' : 'Switch to light'}
          </button>
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <div>
            <p className="topbar__eyebrow">OpenAI Symphony runtime</p>
            <h1 className="topbar__title">{meta.title}</h1>
            <p className="topbar__copy">{meta.description}</p>
          </div>
          <button className="primary-button" disabled={isRefreshing} onClick={handleRefresh} type="button">
            <RefreshCw className={isRefreshing ? 'spin' : ''} size={16} />
            {isRefreshing ? 'Refreshing…' : 'Refresh orchestrator'}
          </button>
        </header>

        <main className="shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
