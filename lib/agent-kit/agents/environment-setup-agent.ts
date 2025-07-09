import { createAgent, createTool } from '@inngest/agent-kit';
import { z } from 'zod';
import type { TaskNetworkState } from '../types/task-network-types';

export const environmentSetupAgent = createAgent<TaskNetworkState>({
  name: 'Environment Setup',
  description: 'Sets up the execution environment with required dependencies and configurations',
  system: `You are an environment setup specialist. Configure execution environments for computational tasks.

Focus on:
- Creating minimal package.json files
- Writing setup scripts
- Configuring environment variables
- Identifying system requirements
- Ensuring security and efficiency`,
  
  tools: [
    createTool({
      name: 'setup_environment',
      description: 'Create environment configuration based on task analysis',
      parameters: z.object({}),
      handler: async (params, { network }) => {
        const state = network.state.data;
        const analysis = state.analysis;
        
        if (!analysis) {
          return {
            success: false,
            error: 'No task analysis found in state',
          };
        }
        
        try {
          // Create environment setup (in production, this would use AI)
          const environment = {
            packageJson: {
              dependencies: {},
            },
            setupScript: 'console.log("Environment setup complete");',
            environmentVariables: {},
            systemRequirements: ['node22'],
          };
          
          // Update state
          state.environment = environment;
          state.status = 'generating-scripts';
          
          return {
            success: true,
            data: {
              message: 'Environment setup configured successfully',
              environment,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to setup environment: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),
  ],
});