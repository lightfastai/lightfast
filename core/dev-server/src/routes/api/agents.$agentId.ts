import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'
import { AgentDiscoveryService } from '../../server/agent-discovery'
import type { LightfastJSON } from 'lightfast/client'

export const ServerRoute = createServerFileRoute('/api/agents/$agentId')
  .methods({
    GET: async ({ request, params }) => {
      const agentId = params.agentId;
      console.info(`GET /api/agents/${agentId} @`, request.url);
      
      try {
        // Get the Lightfast configuration from discovery service
        const discovery = AgentDiscoveryService.getInstance();
        const config: LightfastJSON = await discovery.discoverConfig();
        
        // Find the specific agent from the configuration (agents is a LightfastAgentSet)
        // Check if agentId exists in the agents record
        if (!(agentId in config.agents)) {
          return json(
            {
              success: false,
              error: 'Agent not found',
              message: `No agent found with ID: ${agentId}`,
            },
            { status: 404 }
          );
        }
        
        const agent = config.agents[agentId];
        
        // Return the agent details
        return json({
          success: true,
          data: {
            key: agentId,
            ...agent, // Include the full Agent object
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`Error fetching agent ${agentId}:`, error);
        
        return json(
          {
            success: false,
            error: 'Failed to load agent details',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    },
  })