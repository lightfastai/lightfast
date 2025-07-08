import { type NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, context } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Send the event to Inngest
    const { ids } = await inngest.send({
      name: 'agent/query',
      data: {
        query,
        context,
      },
    });

    return NextResponse.json({
      success: true,
      eventId: ids[0],
      message: 'Agent query started',
    });
  } catch (error) {
    console.error('Error sending event:', error);
    return NextResponse.json({ error: 'Failed to send event' }, { status: 500 });
  }
}
