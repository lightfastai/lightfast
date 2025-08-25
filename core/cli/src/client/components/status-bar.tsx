import * as React from 'react'

interface StatusBarProps {
  status: any
  loading: boolean
  error: Error | null
}

export function StatusBar({ status, loading, error }: StatusBarProps) {
  const getStatusClass = () => {
    if (error) return 'error'
    if (loading) return 'loading'
    if (status?.status === 'running') return 'running'
    return 'loading'
  }

  const getStatusText = () => {
    if (error) return 'Connection Error'
    if (loading) return 'Connecting...'
    if (status?.status === 'running') return 'Server Running'
    return 'Unknown'
  }

  return (
    <div className="status-bar">
      <div className={`status-indicator ${getStatusClass()}`} />
      <div className="status-info">
        <span className="status-text">{getStatusText()}</span>
        {status?.version && (
          <span className="status-version">v{status.version}</span>
        )}
      </div>
    </div>
  )
}