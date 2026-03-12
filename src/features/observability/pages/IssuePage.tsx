import { AlertTriangle, ArrowLeft, FolderTree, TerminalSquare } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Panel } from '../components/Panel'
import { StatusPill } from '../components/StatusPill'
import { getIssueSnapshot } from '../api/client'
import { usePolledResource, useTicker } from '../hooks'
import {
  formatElapsed,
  formatNumber,
  formatRelativeAge,
  formatTimestamp,
  truncateMiddle,
} from '../../../lib/formatters'

export function IssuePage() {
  const { issueIdentifier = '' } = useParams()
  const now = useTicker(1000)
  const { data, error, isLoading } = usePolledResource(
    () => getIssueSnapshot(issueIdentifier),
    8_000,
  )

  if (isLoading && !data) {
    return <div className="empty-state">Loading issue {issueIdentifier}…</div>
  }

  if (error && !data) {
    return <div className="empty-state empty-state--error">Unable to load issue: {error}</div>
  }

  if (!data) {
    return null
  }

  return (
    <div className="page-stack">
      <section className="hero hero--compact">
        <div>
          <div className="hero__breadcrumb">
            <Link to="/" className="breadcrumb-link">
              <ArrowLeft size={16} />
              Overview
            </Link>
          </div>
          <h1 className="hero__title">{data.issue_identifier}</h1>
          <p className="hero__copy">
            Session detail, retry state, recent events, and workspace context for the current
            Symphony issue.
          </p>
        </div>
        <div className="hero__meta">
          <StatusPill tone={data.last_error ? 'error' : data.retry ? 'warning' : 'success'}>
            {data.status}
          </StatusPill>
          {data.running ? (
            <span className="hero__timestamp">
              Last event {formatRelativeAge(data.running.last_event_at, now)}
            </span>
          ) : null}
        </div>
      </section>

      <section className="detail-grid">
        <Panel title="Session snapshot" eyebrow="Live state">
          {data.running ? (
            <dl className="definition-grid">
              <div>
                <dt>State</dt>
                <dd>{data.running.state}</dd>
              </div>
              <div>
                <dt>Session</dt>
                <dd>{truncateMiddle(data.running.session_id)}</dd>
              </div>
              <div>
                <dt>Runtime</dt>
                <dd>{formatElapsed(data.running.started_at, now)}</dd>
              </div>
              <div>
                <dt>Turns</dt>
                <dd>{formatNumber(data.running.turn_count)}</dd>
              </div>
              <div>
                <dt>Total tokens</dt>
                <dd>{formatNumber(data.running.tokens.total_tokens)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatTimestamp(data.running.last_event_at)}</dd>
              </div>
            </dl>
          ) : (
            <div className="empty-state compact">No active running session for this issue.</div>
          )}
        </Panel>

        <Panel title="Workspace + attempts" eyebrow="Execution context">
          <dl className="definition-grid">
            <div>
              <dt>Workspace</dt>
              <dd className="mono-cell">
                <FolderTree size={16} />
                {data.workspace.path}
              </dd>
            </div>
            <div>
              <dt>Restarts</dt>
              <dd>{formatNumber(data.attempts.restart_count)}</dd>
            </div>
            <div>
              <dt>Retry attempt</dt>
              <dd>{formatNumber(data.attempts.current_retry_attempt)}</dd>
            </div>
            <div>
              <dt>Session logs</dt>
              <dd>{formatNumber(data.logs.codex_session_logs.length)}</dd>
            </div>
          </dl>
        </Panel>
      </section>

      {data.last_error || data.retry ? (
        <Panel title="Retry + error state" eyebrow="Attention">
          <div className="alert-card alert-card--error">
            <div className="alert-card__icon">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="alert-card__title">{data.last_error ?? data.retry?.error ?? 'Retrying'}</p>
              {data.retry ? (
                <p className="alert-card__body">
                  Attempt {data.retry.attempt} due {formatTimestamp(data.retry.due_at)}
                </p>
              ) : null}
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel title="Recent events" eyebrow="Event stream">
        {data.recent_events.length === 0 ? (
          <div className="empty-state compact">No recent events recorded for this issue.</div>
        ) : (
          <ol className="timeline">
            {data.recent_events.map((event) => (
              <li className="timeline__item" key={`${event.at}-${event.message}`}>
                <div className="timeline__marker" />
                <div className="timeline__content">
                  <div className="timeline__topline">
                    <StatusPill tone={event.event === 'error' ? 'error' : 'default'}>
                      {event.event}
                    </StatusPill>
                    <span className="table-secondary">{formatTimestamp(event.at)}</span>
                  </div>
                  <p className="timeline__message">{event.message}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel title="Raw payload" eyebrow="Fallback visibility">
        <details className="raw-details">
          <summary className="raw-details__summary">
            <TerminalSquare size={16} />
            Open JSON payload
          </summary>
          <pre className="raw-details__code">{JSON.stringify(data, null, 2)}</pre>
        </details>
      </Panel>
    </div>
  )
}
