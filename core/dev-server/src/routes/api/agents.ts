import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'
import { LightfastConfigService } from '../../server/lightfast-config'
import type { LightfastJSON } from 'lightfast/client'

export const ServerRoute = createServerFileRoute('/api/agents')
  .methods({
    GET: async ({ request }) => {
      console.info('GET /api/agents @', request.url)
      
      try {
        // Get the Lightfast configuration from config service
        const configService = LightfastConfigService.getInstance();
        const config: LightfastJSON = await configService.getConfig();
        
        // Return full agents record
        return json({
          success: true,
          data: {
            agents: config.agents,
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