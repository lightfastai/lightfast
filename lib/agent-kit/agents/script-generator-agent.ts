import { createAgent, createTool } from '@inngest/agent-kit';
import { z } from 'zod';
import type { TaskNetworkState } from '../types/task-network-types';

export const scriptGeneratorAgent = createAgent<TaskNetworkState>({
  name: 'Script Generator',
  description: 'Generates executable scripts based on task analysis and execution plan',
  system: `You are a script generation expert. Create executable JavaScript/Node.js scripts for computational tasks.

Focus on:
- Creating self-contained, error-handling scripts
- Following the execution plan from analysis
- Using only specified dependencies
- Outputting structured results
- Making scripts idempotent and secure`,
  
  tools: [
    createTool({
      name: 'generate_scripts',
      description: 'Generate executable scripts based on task analysis',
      parameters: z.object({}),
      handler: async (params, { network }) => {
        const state = network.state.data;
        const analysis = state.analysis;
        const environment = state.environment;
        
        if (!analysis || !environment) {
          return {
            success: false,
            error: 'Missing required state: analysis or environment',
          };
        }
        
        try {
          // Generate scripts (in production, this would use AI)
          const scripts = {
            scripts: [
              {
                name: 'task-main',
                description: 'Main task execution script',
                code: 'console.log("Executing task..."); console.log(JSON.stringify({result: "Task completed"}));',
                dependencies: [],
                order: 1,
                retryable: true,
              },
            ],
            mainScript: 'require("./task-main.js");',
          };
          
          // Update state
          state.scripts = scripts;
          state.status = 'executing';
          
          return {
            success: true,
            data: {
              message: `Generated ${scripts.scripts.length} scripts for execution`,
              scripts,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to generate scripts: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),
  ],
});