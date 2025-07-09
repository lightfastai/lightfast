import { createAgent, createTool } from '@inngest/agent-kit';
import { z } from 'zod';
import { SandboxExecutor } from '@/lib/sandbox/sandbox-executor';
import type { TaskNetworkState } from '../types/task-network-types';

export const executionAgent = createAgent<TaskNetworkState>({
  name: 'Execution Agent',
  description: 'Executes generated scripts in a sandboxed environment and collects results',
  system: `You are a script execution specialist. Execute scripts safely and collect results.

Focus on:
- Running scripts in the correct order
- Handling errors gracefully
- Collecting and formatting output
- Providing execution summaries
- Ensuring safe execution`,
  
  tools: [
    createTool({
      name: 'execute_scripts',
      description: 'Execute generated scripts in sandbox environment',
      parameters: z.object({}),
      handler: async (params, { network }) => {
        const state = network.state.data;
        const scripts = state.scripts;
        const environment = state.environment;
        
        if (!scripts || !environment) {
          return {
            success: false,
            error: 'Missing required state: scripts or environment',
          };
        }
        
        try {
          // Initialize sandbox executor
          const executor = new SandboxExecutor();
          const results: any[] = [];
          let finalOutput: any = null;
          
          try {
            // Setup environment
            const setupResult = await executor.setupEnvironment(
              environment.packageJson,
              environment.setupScript
            );
            
            if (!setupResult.success) {
              throw new Error(`Environment setup failed: ${setupResult.error}`);
            }
            
            // Execute scripts in order
            for (const script of scripts.scripts.sort((a: any, b: any) => a.order - b.order)) {
              const execResult = await executor.executeScript(`${script.name}.js`, script.code);
              
              results.push({
                scriptName: script.name,
                success: execResult.success,
                output: execResult.output,
                error: execResult.error,
                duration: execResult.duration,
                retryCount: 0,
              });
              
              if (!execResult.success && !script.retryable) {
                throw new Error(`Script ${script.name} failed: ${execResult.error}`);
              }
            }
            
            // Execute main script
            const mainResult = await executor.executeScript('main.js', scripts.mainScript);
            finalOutput = mainResult.output ? JSON.parse(mainResult.output) : null;
            
            // Cleanup
            await executor.cleanup();
            
          } catch (error) {
            await executor.cleanup();
            throw error;
          }
          
          // Generate summary
          const summary = results.every((r: any) => r.success) 
            ? 'All scripts executed successfully'
            : `Completed with ${results.filter((r: any) => !r.success).length} failures`;
          
          const executionResults = {
            results,
            finalOutput,
            summary,
            nextSteps: [],
          };
          
          // Update state
          state.executionResults = executionResults;
          state.status = 'complete';
          
          return {
            success: true,
            data: {
              message: 'Execution completed',
              results: executionResults,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),
  ],
});