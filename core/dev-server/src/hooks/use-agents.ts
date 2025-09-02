import { useQuery } from '@tanstack/react-query'

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await fetch('/api/agents')
      if (!response.ok) {
        throw new Error('Failed to fetch agents')
      }
      return response.json()
    },
    refetchInterval: 5000, // Refetch every 5 seconds for hot reload
  })
}

export function useAgent(agentName: string) {
  return useQuery({
    queryKey: ['agent', agentName],
    queryFn: async () => {
      const response = await fetch(`/api/agents/${agentName}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch agent: ${response.statusText}`)
      }
      const result = await response.json()
      if (!result.success || !result.data?.agent) {
        throw new Error(result.message ?? 'Failed to load agent')
      }
      return result
    },
    enabled: !!agentName, // Only run query if agentName is provided
    refetchInterval: 5000, // Refetch every 5 seconds for hot reload
  })
}