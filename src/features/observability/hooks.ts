import { useCallback, useEffect, useState } from 'react'
import { MANUAL_REFRESH_EVENT } from './api/client'

interface PolledResourceState<T> {
  data: T | null
  error: string | null
  isLoading: boolean
  isRefreshing: boolean
  refetch: () => Promise<void>
}

export function useTicker(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}

export function usePolledResource<T>(
  loader: () => Promise<T>,
  intervalMs: number,
): PolledResourceState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const run = useCallback(
    async (kind: 'initial' | 'refresh') => {
      if (kind === 'refresh') {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      try {
        const next = await loader()
        setData(next)
        setError(null)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unknown error')
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [loader],
  )

  useEffect(() => {
    void run('initial')
  }, [run])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void run('refresh')
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [intervalMs, run])

  useEffect(() => {
    const handleRefresh = () => {
      void run('refresh')
    }

    window.addEventListener(MANUAL_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(MANUAL_REFRESH_EVENT, handleRefresh)
  }, [run])

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    refetch: () => run('refresh'),
  }
}
