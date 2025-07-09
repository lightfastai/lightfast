import { inngest } from '../client';

// This function handles investigation updates and forwards them to the SSE endpoint
export const updateHandler = inngest.createFunction(
  {
    id: 'update-handler',
    name: 'Investigation Update Handler',
  },
  { event: 'investigation/update' },
  async ({ event }) => {
    const { chatId, message, type, metadata } = event.data;

    try {
      // Send update to SSE endpoint
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/investigation/updates`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId,
            message,
            type,
            metadata,
          }),
        },
      );

      if (!response.ok) {
        console.error('Failed to send update to SSE:', await response.text());
      }

      return { success: true, chatId, type };
    } catch (error) {
      console.error('Error in update handler:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        chatId,
      };
    }
  },
);
