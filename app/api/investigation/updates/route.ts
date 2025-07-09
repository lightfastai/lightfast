import type { NextRequest } from 'next/server';

// Store active connections
const connections = new Map<string, ReadableStreamDefaultController>();

// Handle SSE connections for real-time updates
export async function GET(request: NextRequest) {
  const chatId = request.nextUrl.searchParams.get('chatId');

  if (!chatId) {
    return new Response('Chat ID is required', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Store the controller for this chat
      connections.set(chatId, controller);

      // Send initial connection message
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: 'connected',
            chatId,
            timestamp: new Date().toISOString(),
          })}\n\n`,
        ),
      );

      // Set up heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          connections.delete(chatId);
        }
      }, 30000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        connections.delete(chatId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// Endpoint to send updates to connected clients
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, message, type, metadata } = body;

    const controller = connections.get(chatId);
    if (!controller) {
      return new Response('No active connection for this chat', { status: 404 });
    }

    const encoder = new TextEncoder();
    const data = JSON.stringify({
      type,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    });

    controller.enqueue(encoder.encode(`data: ${data}\n\n`));

    return new Response('Update sent', { status: 200 });
  } catch (error) {
    console.error('Error sending update:', error);
    return new Response('Failed to send update', { status: 500 });
  }
}
