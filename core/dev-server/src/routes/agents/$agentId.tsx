import { createFileRoute, Link } from '@tanstack/react-router'
import { ChatInterface } from '../../components/chat-interface'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@repo/ui/components/ui/button'
// Type for the serialized agent data structure from the API
interface SerializedAgent {
  vercelConfig: {
    model: {
      modelId: string;
    };
  };
  lightfastConfig: {
    name: string;
  };
}

export const Route = createFileRoute('/agents/$agentId')({
  component: AgentChatPage,
  loader: async ({ params }) => {
    const agentId = params.agentId;
    
    try {
      // Fetch from the API endpoint instead of directly importing server modules
      const response = await fetch(`/api/agents/${agentId}`);
      
      if (!response.ok) {
        return {
          success: false,
          error: 'Agent not found',
          message: `Agent with key "${agentId}" does not exist`,
        };
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`Error fetching agent config for ${agentId}:`, error);
      
      return {
        success: false,
        error: 'Failed to load agent configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
})

function AgentChatPage() {
  const { agentId } = Route.useParams()
  const agentData = Route.useLoaderData()
  
  if (!agentData.success || !agentData.data?.agent) {
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
              {agentData.message || agentData.error || `The agent "${agentId}" does not exist.`}
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
  
  const agent: SerializedAgent = agentData.data.agent
  const agentName = agent.lightfastConfig.name;
  
  return (
    <div className="h-screen flex flex-col">
      <ChatInterface 
        agentId={agentId} 
        agentName={agentName}
      />
    </div>
  )
}