import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import type { ApiResponse } from '@/types/inngest';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, repository } = body;

    if (!query || !repository) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Query and repository are required',
        },
        { status: 400 },
      );
    }

    // Generate a unique chat ID for this investigation
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Get user ID from session or generate a temporary one
    const userId = request.headers.get('x-user-id') || 'anonymous';

    // Send the event to start the investigation
    const event = await inngest.send({
      name: 'investigation/start',
      data: {
        query,
        repository,
        userId,
        chatId,
      },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        chatId,
        eventId: event.ids[0],
      },
      message: 'Investigation started',
    });
  } catch (error) {
    console.error('Error starting investigation:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start investigation',
      },
      { status: 500 },
    );
  }
}

// Endpoint to get investigation updates
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Chat ID is required',
      },
      { status: 400 },
    );
  }

  // In a real implementation, you would:
  // 1. Store investigation updates in a database
  // 2. Retrieve updates for the specific chatId
  // 3. Return them to the client
  // For now, we'll return a placeholder response

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      chatId,
      updates: [],
      status: 'in_progress',
    },
  });
}
