import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { kv } from "@vendor/kv";
import { StagehandSessionManager } from "~/lib/agent/stagehand-manager";
import { env } from "~/env";

export const runtime = "edge";
export const maxDuration = 60; // 1 minute timeout for browser operations

const runTaskSchema = z.object({
  task: z.string().min(1),
  url: z.string().url().optional(),
});

type Session = {
  id: string;
  userId: string;
  agentType: "browser";
  createdAt: string;
  status: "active" | "completed" | "error";
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get session
    const session = await kv.get<Session>(`session:${sessionId}`);
    
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify session belongs to user
    if (session.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const result = runTaskSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { task, url } = result.data;

    // Get or create Stagehand instance for this session
    const stagehandManager = StagehandSessionManager.getInstance();
    const stagehand = await stagehandManager.ensureStagehand(sessionId, {
      apiKey: env.BROWSERBASE_API_KEY,
      projectId: env.BROWSERBASE_PROJECT_ID,
    });

    // Execute the task
    try {
      // Navigate if URL provided
      if (url) {
        await stagehand.page.goto(url);
      }

      // Perform the task action
      const result = await stagehand.page.act(task);

      // Update session status
      await kv.set(`session:${sessionId}`, {
        ...session,
        status: "active",
      }, { ex: 3600 });

      return NextResponse.json({
        success: true,
        result,
        sessionId,
      });
    } catch (error) {
      // Update session status to error
      await kv.set(`session:${sessionId}`, {
        ...session,
        status: "error",
      }, { ex: 3600 });

      throw error;
    }
  } catch (error) {
    console.error("Failed to run agent task:", error);
    return NextResponse.json(
      { 
        error: "Failed to run agent task",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}