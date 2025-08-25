import * as React from 'react'

interface AgentData {
  agents: any[]
  total: number
}

interface ExecutionData {
  executions: any[]
  total: number
}

interface ResourceData {
  sandbox: { available: number; total: number }
  browser: { available: number; total: number }
}

export function Dashboard() {
  const [agents, setAgents] = React.useState<AgentData>({ agents: [], total: 0 })
  const [executions, setExecutions] = React.useState<ExecutionData>({ executions: [], total: 0 })
  const [resources, setResources] = React.useState<ResourceData>({
    sandbox: { available: 0, total: 0 },
    browser: { available: 0, total: 0 }
  })
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsRes, executionsRes, resourcesRes] = await Promise.all([
          fetch('/api/agents').then(r => r.json()),
          fetch('/api/executions').then(r => r.json()),
          fetch('/api/resources').then(r => r.json())
        ])
        
        setAgents(agentsRes)
        setExecutions(executionsRes)
        setResources(resourcesRes)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000) // Refresh every 5 seconds
    
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>
  }

  return (
    <div className="dashboard">
      <div className="card">
        <h3>🤖 Agents</h3>
        <div className="metric">
          <span className="metric-label">Total Agents</span>
          <span className="metric-value">{agents.total}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Active</span>
          <span className="metric-value">0</span>
        </div>
      </div>

      <div className="card">
        <h3>🚀 Executions</h3>
        <div className="metric">
          <span className="metric-label">Total Executions</span>
          <span className="metric-value">{executions.total}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Running</span>
          <span className="metric-value">0</span>
        </div>
      </div>

      <div className="card">
        <h3>💾 Resources</h3>
        <div className="metric">
          <span className="metric-label">Sandbox</span>
          <span className="metric-value">
            {resources.sandbox.available}/{resources.sandbox.total}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Browser Sessions</span>
          <span className="metric-value">
            {resources.browser.available}/{resources.browser.total}
          </span>
        </div>
      </div>

      <div className="card">
        <h3>📊 System Status</h3>
        <div className="metric">
          <span className="metric-label">CPU Usage</span>
          <span className="metric-value">--</span>
        </div>
        <div className="metric">
          <span className="metric-label">Memory</span>
          <span className="metric-value">--</span>
        </div>
      </div>
    </div>
  )
}