import { inngest } from '../client';

// Create a simple agent without tools for now
export const agentFunction = inngest.createFunction(
  { id: 'coding-agent', name: 'Coding Assistant Agent' },
  { event: 'agent/query' },
  async ({ event, step }) => {
    const { query } = event.data;

    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'Agent not configured. Please set OPENAI_API_KEY environment variable.',
        query,
      };
    }

    try {
      // For now, create a simple agent without the complex tool setup
      const response = await step.run('agent-process', async () => {
        // This is a simplified version - in production you'd use the full AgentKit setup
        return `I received your query: "${query}". 

To properly execute code, I would need to:
1. Parse your request to understand what code to write
2. Write the code
3. Execute it in a Vercel Sandbox
4. Return the results

For a full implementation, you would set up AgentKit with custom tools that integrate with Vercel Sandbox.`;
      });

      return {
        success: true,
        response,
        query,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        query,
      };
    }
  },
);
