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
  formatTimestamp,
  truncateMiddle,
} from '../../../lib/formatters'

const REVIEW_STATES = new Set([
  'review requested', 'in review', 'review', 'pending review', 'awaiting review',
])

function isReviewState(state: string): boolean {
  return REVIEW_STATES.has(state.toLowerCase())
}

export function OverviewPage() {
  const now = useTicker(1000)
  const { data, error, isLoading } = usePolledResource(getStateSnapshot, 10_000)

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
      <section className="metrics-grid">
        <MetricCard
          label="Running"
          value={formatNumber(data.counts.running)}
          detail="Active sessions"
          icon={<Activity size={14} />}
        />
        <MetricCard
          label="Retrying"
          value={formatNumber(data.counts.retrying)}
          detail="Waiting for retry"
          accent="warning"
          icon={<RotateCcw size={14} />}
        />
        <MetricCard
          label="Tokens"
          value={formatNumber(data.codex_totals.total_tokens)}
          detail={`In ${formatNumber(data.codex_totals.input_tokens)} / Out ${formatNumber(data.codex_totals.output_tokens)}`}
          accent="info"
          icon={<Gauge size={14} />}
        />
        <MetricCard
          label="Runtime"
          value={formatDurationSeconds(data.codex_totals.seconds_running)}
          detail="Total Codex runtime"
          accent="success"
          icon={<TimerReset size={14} />}
        />
      </section>

      <div className="dashboard-grid">
        <Panel title="Rate limits" eyebrow="Upstream">
          <dl className="definition-grid">
            <div>
              <dt>Plan</dt>
              <dd>{data.rate_limits?.plan_type ?? '–'}</dd>
            </div>
            <div>
              <dt>Limit ID</dt>
              <dd>{data.rate_limits?.limit_id ?? '–'}</dd>
            </div>
            <div>
              <dt>Credits</dt>
              <dd>
                {data.rate_limits?.credits
                  ? data.rate_limits.credits.has_credits
                    ? 'Available'
                    : 'Exhausted'
                  : '–'}
              </dd>
            </div>
            <div>
              <dt>Unlimited</dt>
              <dd>{data.rate_limits?.credits?.unlimited ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Retry queue" eyebrow="Backoff">
          {data.retrying.length === 0 ? (
            <div className="empty-state compact">No issues backing off</div>
          ) : (
            <ul className="stack-list">
              {data.retrying.map((entry) => (
                <li className="list-card" key={entry.issue_id}>
                  <div className="list-card__title-row">
                    <Link className="issue-link" to={`/issues/${entry.issue_identifier}`}>
                      {entry.issue_identifier}
                    </Link>
                    <StatusPill tone="warning">{`#${entry.attempt}`}</StatusPill>
                  </div>
                  <p className="list-card__body">{entry.error}</p>
                  <p className="list-card__meta">Due {formatTimestamp(entry.due_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Sessions" eyebrow="Active">
        {data.running.length === 0 ? (
          <div className="empty-state compact">No sessions running</div>
        ) : (
          <div className="table-shell">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>State</th>
                  <th>Session</th>
                  <th>Runtime</th>
                  <th>Last update</th>
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
                      <StatusPill tone={isReviewState(session.state) ? 'review' : 'success'}>{session.state}</StatusPill>
                    </td>
                    <td>
                      <span className="table-secondary mono-cell">{truncateMiddle(session.session_id)}</span>
                    </td>
                    <td>
                      <div className="table-primary">
                        <span>{formatElapsed(session.started_at, now)}</span>
                        <span className="table-secondary">{session.turn_count} turns</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-primary">
                        <span className="table-last-msg">{session.last_message}</span>
                        <span className="table-secondary">{session.last_event}</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-primary">
                        <span>{formatNumber(session.tokens.total_tokens)}</span>
                        <span className="table-secondary">
                          {formatNumber(session.tokens.input_tokens)}↑ {formatNumber(session.tokens.output_tokens)}↓
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
