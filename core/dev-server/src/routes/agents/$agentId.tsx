import { createFileRoute, Link } from '@tanstack/react-router'
import { ChatInterface } from '../../components/chat/chat-interface'
import { useAgents } from '../../hooks/use-agents'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../../components/ui/button'

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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading agent...</p>
        </div>
      </div>
    )
  }
  
  if (!agent) {
    return (
      <div className="flex flex-col h-screen">
        <div className="border-b px-6 py-4">
          <Link to="/agents">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Agents
            </Button>
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Agent Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The agent "{agentId}" does not exist.
            </p>
            <Link to="/agents">
              <Button>
                View All Agents
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-screen flex flex-col">
      <ChatInterface 
        agentId={agentId} 
        agentName={agent.lightfastConfig?.name || agentId}
      />
    </div>
  )
}