import { createNetwork, createState, anthropic } from '@inngest/agent-kit';
import type { TaskNetworkState } from '../types/task-network-types';
import { taskAnalyzerAgent } from '../agents/task-analyzer-agent';
import { environmentSetupAgent } from '../agents/environment-setup-agent';
import { scriptGeneratorAgent } from '../agents/script-generator-agent';
import { executionAgent } from '../agents/execution-agent';

export const taskNetwork = createNetwork<TaskNetworkState>({
  name: 'Universal Task Network',
  description: 'A general-purpose computational task execution system',
  agents: [taskAnalyzerAgent, environmentSetupAgent, scriptGeneratorAgent, executionAgent],

  defaultState: createState<TaskNetworkState>({
    chatId: '',
    status: 'analyzing' as const,
  }),

  defaultModel: anthropic({
    model: 'claude-3-5-sonnet-20241022',
    defaultParameters: {
      max_tokens: 4096,
    },
  }),

  router: async ({ network, lastResult }) => {
    const state = network.state.data;

    // Log routing decision for debugging
    console.log('Task Network Router - Current status:', state.status);
    console.log('Task Network Router - Last result:', lastResult);

    // Route based on current status
    switch (state.status) {
      case 'analyzing':
        // Start with task analysis
        return taskAnalyzerAgent;

      case 'environment-setup':
        // After analysis, setup environment
        return environmentSetupAgent;

      case 'generating-scripts':
        // After environment setup, generate scripts
        return scriptGeneratorAgent;

      case 'executing':
        // After script generation, execute
        return executionAgent;

      case 'complete':
        // All agents have completed their work
        console.log('Task execution complete');
        return undefined;

      case 'error':
        // Stop on error
        console.error('Task Network error:', state.error);
        return undefined;

      default:
        // Default to task analysis if status is unknown
        console.warn('Unknown status:', state.status);
        return taskAnalyzerAgent;
    }
  },

  // Maximum number of agent calls to prevent infinite loops
  maxIter: 15, // Increased for complex tasks that might need more iterations
});
