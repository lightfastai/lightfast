import * as React from 'react'

interface ApiStatus {
  status: string
  version: string
  timestamp: string
}

export function useApiStatus() {
  const [status, setStatus] = React.useState<ApiStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/status')
        if (!response.ok) {
          throw new Error('Failed to fetch status')
        }
        const data = await response.json()
        setStatus(data)
        setError(null)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 10000) // Check every 10 seconds

    return () => clearInterval(interval)
  }, [])

  return { status, loading, error }
}