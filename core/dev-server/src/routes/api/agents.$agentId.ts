import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'
import { LightfastConfigService } from '../../server/lightfast-config'
import type { LightfastJSON } from 'lightfast/client'

export const ServerRoute = createServerFileRoute('/api/agents/$agentId')
  .methods({
    GET: async ({ request, params }) => {
      const agentId = params.agentId;
      console.info(`GET /api/agents/${agentId} @`, request.url);
      
      try {
        // Get the Lightfast configuration from config service
        const configService = LightfastConfigService.getInstance();
        const config: LightfastJSON = await configService.getConfig();
        
        // Get the specific agent from the agents record
        const agent = config.agents[agentId];
        
        if (!agent) {
          return json(
            {
              success: false,
              error: 'Agent not found',
              message: `Agent with key "${agentId}" does not exist`,
            },
            { status: 404 }
          );
        }
        
        // Return the full agent instance
        return json({
          success: true,
          data: {
            agent: agent,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`Error fetching agent config for ${agentId}:`, error);
        
        return json(
          {
            success: false,
            error: 'Failed to load agent configuration',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    },
  })