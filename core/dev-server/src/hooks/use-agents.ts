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