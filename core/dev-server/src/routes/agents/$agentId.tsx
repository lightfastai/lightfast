import { createFileRoute } from '@tanstack/react-router'
import { ChatInterface } from '../../components/chat/chat-interface'
import { useAgents } from '../../hooks/use-agents'

export const Route = createFileRoute('/agents/$agentId')({
  component: AgentChatPage,
})

function AgentChatPage() {
  const { agentId } = Route.useParams()
  const { data: agentsData, isLoading } = useAgents()
  
  // Find the specific agent
  const agent = agentsData?.data?.agents?.find((a: any) => a.key === agentId)
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading agent...</p>
        </div>
      </div>
    )
  }
  
  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Agent not found</p>
          <p className="text-muted-foreground">
            The agent "{agentId}" does not exist.
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-full flex flex-col">
      <ChatInterface 
        agentId={agentId} 
        agentName={agent.lightfastConfig?.name || agentId}
      />
    </div>
  )
}