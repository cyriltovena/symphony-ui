import { Activity, Gauge, RotateCcw, TimerReset } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../components/MetricCard'
import { Panel } from '../components/Panel'
import { StatusPill } from '../components/StatusPill'
import { getStateSnapshot } from '../api/client'
import { usePolledResource, useTicker } from '../hooks'
import {
  formatDurationSeconds,
  formatElapsed,
  formatNumber,
  formatRelativeAge,
  formatTimestamp,
  truncateMiddle,
} from '../../../lib/formatters'

export function OverviewPage() {
  const now = useTicker(1000)
  const { data, error, isLoading, isRefreshing } = usePolledResource(getStateSnapshot, 10_000)

  if (isLoading && !data) {
    return <div className="empty-state">Loading Symphony runtime…</div>
  }

  if (error && !data) {
    return <div className="empty-state empty-state--error">Unable to load overview: {error}</div>
  }

  if (!data) {
    return null
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <p className="hero__eyebrow">Symphony observability</p>
          <h1 className="hero__title">Operations dashboard</h1>
          <p className="hero__copy">
            Live operational view of active issue sessions, retry pressure, token spend, and the
            latest upstream limit snapshot.
          </p>
        </div>
        <div className="hero__meta">
          <StatusPill tone="success">{isRefreshing ? 'Refreshing' : 'Live'}</StatusPill>
          <span className="hero__timestamp">Updated {formatRelativeAge(data.generated_at, now)}</span>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard
          label="Running"
          value={formatNumber(data.counts.running)}
          detail="Active issue sessions in the current runtime."
          icon={<Activity size={18} />}
        />
        <MetricCard
          label="Retrying"
          value={formatNumber(data.counts.retrying)}
          detail="Issues waiting for the next retry window."
          accent="warning"
          icon={<RotateCcw size={18} />}
        />
        <MetricCard
          label="Total tokens"
          value={formatNumber(data.codex_totals.total_tokens)}
          detail={`In ${formatNumber(data.codex_totals.input_tokens)} / Out ${formatNumber(data.codex_totals.output_tokens)}`}
          accent="info"
          icon={<Gauge size={18} />}
        />
        <MetricCard
          label="Runtime"
          value={formatDurationSeconds(data.codex_totals.seconds_running)}
          detail="Total Codex runtime across completed and active sessions."
          accent="success"
          icon={<TimerReset size={18} />}
        />
      </section>

      <div className="dashboard-grid">
        <Panel title="Rate limits" eyebrow="Upstream snapshot">
          <dl className="definition-grid">
            <div>
              <dt>Plan</dt>
              <dd>{data.rate_limits?.plan_type ?? 'Unavailable'}</dd>
            </div>
            <div>
              <dt>Limit ID</dt>
              <dd>{data.rate_limits?.limit_id ?? 'Unavailable'}</dd>
            </div>
            <div>
              <dt>Credits</dt>
              <dd>
                {data.rate_limits?.credits
                  ? data.rate_limits.credits.has_credits
                    ? 'Available'
                    : 'Exhausted'
                  : 'Unavailable'}
              </dd>
            </div>
            <div>
              <dt>Unlimited</dt>
              <dd>{data.rate_limits?.credits?.unlimited ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Retry queue" eyebrow="Backoff pressure">
          {data.retrying.length === 0 ? (
            <div className="empty-state compact">No issues are currently backing off.</div>
          ) : (
            <ul className="stack-list">
              {data.retrying.map((entry) => (
                <li className="list-card" key={entry.issue_id}>
                  <div className="list-card__title-row">
                    <Link className="issue-link" to={`/issues/${entry.issue_identifier}`}>
                      {entry.issue_identifier}
                    </Link>
                    <StatusPill tone="warning">{`Attempt ${entry.attempt}`}</StatusPill>
                  </div>
                  <p className="list-card__body">{entry.error}</p>
                  <p className="list-card__meta">Due {formatTimestamp(entry.due_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Running sessions" eyebrow="Active workload">
        {data.running.length === 0 ? (
          <div className="empty-state compact">No sessions are currently running.</div>
        ) : (
          <div className="table-shell">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>State</th>
                  <th>Session</th>
                  <th>Runtime / Turns</th>
                  <th>Codex update</th>
                  <th>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {data.running.map((session) => (
                  <tr key={session.issue_id}>
                    <td>
                      <div className="table-primary">
                        <Link className="issue-link" to={`/issues/${session.issue_identifier}`}>
                          {session.issue_identifier}
                        </Link>
                        <span className="table-secondary">{formatTimestamp(session.last_event_at)}</span>
                      </div>
                    </td>
                    <td>
                      <StatusPill tone="success">{session.state}</StatusPill>
                    </td>
                    <td>
                      <span className="table-secondary">{truncateMiddle(session.session_id)}</span>
                    </td>
                    <td>
                      <div className="table-primary">
                        <span>{formatElapsed(session.started_at, now)}</span>
                        <span className="table-secondary">{session.turn_count} turn(s)</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-primary">
                        <span>{session.last_message}</span>
                        <span className="table-secondary">{session.last_event}</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-primary">
                        <span>{formatNumber(session.tokens.total_tokens)}</span>
                        <span className="table-secondary">
                          In {formatNumber(session.tokens.input_tokens)} / Out{' '}
                          {formatNumber(session.tokens.output_tokens)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
