export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatTokenTotal(value: number) {
  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)} tokens`
  }

  return `${formatNumber(value)} tokens`
}

export function formatDurationSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }

  return `${minutes}m ${seconds}s`
}

export function formatElapsed(startedAt: string, nowMs: number) {
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - Date.parse(startedAt)) / 1000))
  return formatDurationSeconds(elapsedSeconds)
}

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatRelativeAge(value: string, nowMs: number) {
  const diffSeconds = Math.round((Date.parse(value) - nowMs) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (Math.abs(diffSeconds) < 60) {
    return rtf.format(diffSeconds, 'second')
  }

  if (Math.abs(diffSeconds) < 3600) {
    return rtf.format(Math.round(diffSeconds / 60), 'minute')
  }

  return rtf.format(Math.round(diffSeconds / 3600), 'hour')
}

export function truncateMiddle(value: string, keep = 8) {
  if (value.length <= keep * 2 + 1) {
    return value
  }

  return `${value.slice(0, keep)}...${value.slice(-keep)}`
}
