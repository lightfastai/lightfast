import { inngest } from '../client';
import { taskNetwork } from '@/lib/agent-kit/networks/task-network';
import { wrapWithSSE } from '../helpers/sse-wrapper';
import type { TaskNetworkState, TaskNetworkInput } from '@/lib/agent-kit/types/task-network-types';

export const taskExecutorFunction = inngest.createFunction(
  {
    id: 'task-executor',
    name: 'Universal Task Executor',
  },
  { event: 'task/execute' },
  async ({ event, step }) => {
    const { taskDescription, chatId, constraints } = event.data;
    const wrappedStep = wrapWithSSE(step, { chatId });

    // Initialize the task network with input
    const input: TaskNetworkInput = {
      taskDescription,
      chatId,
      constraints,
    };

    // Run the task network
    const result = await wrappedStep.run('execute-task-network', async () => {
      try {
        // Execute the network with initial state
        const networkResult = await taskNetwork.run(
          taskDescription, // The task description is the input prompt
          {
            state: {
              chatId,
              status: 'analyzing' as const,
              taskDescription,
            } as TaskNetworkState,
          }
        );

        // Get the final state
        const finalState = networkResult.state.data as TaskNetworkState;

        if (finalState?.status === 'complete' && finalState.executionResults) {
          return {
            success: true,
            chatId,
            results: finalState.executionResults,
            analysis: finalState.analysis,
            scripts: finalState.scripts,
          };
        } else if (finalState?.status === 'error') {
          throw new Error(finalState.error || 'Task execution failed');
        } else {
          throw new Error('Task did not complete successfully');
        }
      } catch (error) {
        console.error('Task execution error:', error);
        throw error;
      }
    });

    // Send final update
    await wrappedStep.sendEvent('send-final-update', {
      name: 'updates/send',
      data: {
        chatId,
        message: 'Task execution completed',
        type: 'success',
        metadata: {
          summary: result.results?.summary,
          finalOutput: result.results?.finalOutput,
        },
      },
    });

    return result;
  },
);