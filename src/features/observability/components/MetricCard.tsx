import type { ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: string
  detail: string
  accent?: 'primary' | 'success' | 'warning' | 'info'
  icon?: ReactNode
}

export function MetricCard({ label, value, detail, accent = 'primary', icon }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${accent}`}>
      <div className="metric-card__header">
        <p className="metric-card__label">{label}</p>
        {icon ? <div className="metric-card__icon">{icon}</div> : null}
      </div>
      <strong className="metric-card__value">{value}</strong>
      <p className="metric-card__detail">{detail}</p>
    </article>
  )
}
