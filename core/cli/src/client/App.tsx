import { Dashboard } from './components/dashboard'
import { StatusBar } from './components/status-bar'
import { useApiStatus } from './hooks/use-api-status'

export function App() {
  const { status, loading, error } = useApiStatus()

  return (
    <div className="app">
      <header className="app-header">
        <h1>⚡ Lightfast Dev Server</h1>
        <StatusBar status={status} loading={loading} error={error} />
      </header>
      
      <main className="app-main">
        <Dashboard />
      </main>
    </div>
  )
}