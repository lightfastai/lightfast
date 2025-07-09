import { createNetwork, createState } from '@inngest/agent-kit';
import { anthropic } from '@ai-sdk/anthropic';
import type { BugReporterNetworkState } from '../types/types';
import { bugAnalysisAgent } from '../agents/bug-analysis-agent';
import { securityAnalysisAgent } from '../agents/security-analysis-agent';
import { codeFixAgent } from '../agents/code-fix-agent';

export const bugReporterNetwork = createNetwork<BugReporterNetworkState>({
  name: 'Bug Reporter Network',
  description: 'A comprehensive bug analysis and fix suggestion system',
  agents: [bugAnalysisAgent, securityAnalysisAgent, codeFixAgent],

  defaultState: createState<BugReporterNetworkState>({
    chatId: '',
    status: 'analyzing' as const,
  }),

  defaultModel: anthropic('claude-3-5-sonnet-20241022') as any,

  router: async ({ network, lastResult }) => {
    const state = network.state.data;

    // Log routing decision for debugging
    console.log('Bug Reporter Router - Current status:', state.status);
    console.log('Bug Reporter Router - Last result:', lastResult);

    // Route based on current status
    switch (state.status) {
      case 'analyzing':
        // Start with bug analysis
        return bugAnalysisAgent;

      case 'security-check':
        // After initial analysis, run security check
        return securityAnalysisAgent;

      case 'generating-fixes':
        // After security analysis, generate fixes
        return codeFixAgent;

      case 'complete':
        // All agents have completed their work
        return undefined;

      case 'error':
        // Stop on error
        console.error('Bug Reporter Network error:', state.error);
        return undefined;

      default:
        // Default to bug analysis if status is unknown
        console.warn('Unknown status:', state.status);
        return bugAnalysisAgent;
    }
  },

  // Maximum number of agent calls to prevent infinite loops
  maxIter: 10,
});
