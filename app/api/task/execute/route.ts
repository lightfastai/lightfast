import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { z } from 'zod';
import { nanoid } from 'nanoid';

// Request validation schema
const executeTaskSchema = z.object({
  taskDescription: z.string().min(1).max(1000),
  chatId: z.string().optional(),
  constraints: z.object({
    maxExecutionTime: z.number().optional(),
    allowedDependencies: z.array(z.string()).optional(),
    blockedDependencies: z.array(z.string()).optional(),
    memoryLimit: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validationResult = executeTaskSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request', 
          details: validationResult.error.flatten() 
        },
        { status: 400 }
      );
    }

    const { taskDescription, constraints } = validationResult.data;
    const chatId = validationResult.data.chatId || nanoid();

    // Send event to Inngest
    const { ids } = await inngest.send({
      name: 'task/execute',
      data: {
        taskDescription,
        chatId,
        constraints,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Task execution started',
      eventId: ids[0],
      chatId,
    });
    
  } catch (error) {
    console.error('Error starting task execution:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to start task execution',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}