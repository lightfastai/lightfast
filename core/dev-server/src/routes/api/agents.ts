import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'
import { AgentDiscoveryService } from '../../server/agent-discovery'
import type { LightfastJSON, Agent } from 'lightfast/client'

export const ServerRoute = createServerFileRoute('/api/agents')
  .methods({
    GET: async ({ request }) => {
      console.info('GET /api/agents @', request.url)
      
      try {
        // Get the Lightfast configuration from discovery service
        const discovery = AgentDiscoveryService.getInstance();
        const config: LightfastJSON = await discovery.discoverConfig();
        
        // Convert agents Record to array for API response (for UI consumption)
        const agentsArray = Object.entries(config.agents).map(([key, agent]) => ({
          key,
          ...agent, // Include the full Agent object
        }));
        
        // Return the configuration with agents as array
        return json({
          success: true,
          data: {
            agents: agentsArray,
            metadata: config.metadata,
            dev: config.dev,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error fetching Lightfast config:', error);
        
        return json(
          {
            success: false,
            error: 'Failed to load Lightfast configuration',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    },
  })