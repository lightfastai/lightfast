import { inngest } from '@/lib/inngest/client';
import type { ApiResponse, BugReportEvent } from '@/types/inngest';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bugReport, repository } = body;

    if (!bugReport || !bugReport.title || !bugReport.description) {
      return Response.json(
        {
          success: false,
          error: 'Bug report must have a title and description',
        } as ApiResponse,
        { status: 400 },
      );
    }

    // Generate a unique chat ID for this bug report session
    const chatId = `bug_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Send event to Inngest to trigger the bug reporter function
    await inngest.send({
      name: 'bug/report' as const,
      data: {
        bugReport,
        repository: repository || bugReport.repository,
        chatId,
      },
    } satisfies BugReportEvent);

    return Response.json({
      success: true,
      data: {
        chatId,
        message: 'Bug report submitted for analysis',
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Error submitting bug report:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit bug report',
      } as ApiResponse,
      { status: 500 },
    );
  }
}