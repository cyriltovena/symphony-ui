interface StatusPillProps {
  tone?: 'default' | 'success' | 'warning' | 'error' | 'review'
  children: string
}

export function StatusPill({ tone = 'default', children }: StatusPillProps) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>
}
