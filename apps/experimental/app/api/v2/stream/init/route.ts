import { redis } from "../../../../(v2)/ai/config";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

interface StreamInitRequestBody {
  prompt: string;
  sessionId?: string;
  systemPrompt?: string;
  temperature?: number;
  maxIterations?: number;
  tools?: string[];
  metadata?: Record<string, any>;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StreamInitRequestBody;
    const {
      prompt,
      sessionId: providedSessionId,
      systemPrompt = "You are a helpful AI assistant.",
      temperature = 0.7,
      maxIterations = 10,
      tools = [],
      metadata = {},
    } = body;

    // Validate prompt
    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Use provided session ID or generate new one
    const sessionId = providedSessionId || generateSessionId();

    // Check if stream already exists  
    const streamKey = `llm:stream:${sessionId}`;
    const exists = await redis.exists(streamKey);
    if (exists) {
      return NextResponse.json({ error: "Session already exists", sessionId }, { status: 409 });
    }

    // Initialize session state in Redis
    const sessionKey = `v2:session:${sessionId}`;
    const sessionData = {
      sessionId,
      messages: [{ role: "user", content: prompt.trim() }],
      systemPrompt,
      temperature,
      maxIterations,
      tools,
      metadata,
      createdAt: new Date().toISOString(),
      status: "initializing",
      iteration: 0,
      updatedAt: new Date().toISOString(),
    };

    // Store session data (expire after 24 hours)
    await redis.setex(sessionKey, 86400, JSON.stringify(sessionData));

    // Add start metadata message
    await redis.xadd(streamKey, "*", {
      type: "metadata",
      status: "started",
      completedAt: new Date().toISOString(),
      totalChunks: 0,
      fullContent: "",
      timestamp: new Date().toISOString(),
    });
    await redis.publish(streamKey, JSON.stringify({ type: "metadata" }));

    // TODO: Here we would trigger the agent to start processing
    // For now, let's simulate some stream data for testing
    setTimeout(async () => {
      try {
        console.log("Adding test stream data to:", streamKey);
        
        // Add some test chunks
        await redis.xadd(streamKey, "*", {
          type: "chunk",
          content: "The answer to 15 * 7 + 23 is ",
          timestamp: new Date().toISOString(),
        });
        await redis.publish(streamKey, JSON.stringify({ type: "chunk" }));
        console.log("Added chunk 1");

        await new Promise(resolve => setTimeout(resolve, 500));

        await redis.xadd(streamKey, "*", {
          type: "chunk", 
          content: "128",
          timestamp: new Date().toISOString(),
        });
        await redis.publish(streamKey, JSON.stringify({ type: "chunk" }));
        console.log("Added chunk 2");

        await new Promise(resolve => setTimeout(resolve, 500));

        await redis.xadd(streamKey, "*", {
          type: "chunk",
          content: ".",
          timestamp: new Date().toISOString(),
        });
        await redis.publish(streamKey, JSON.stringify({ type: "chunk" }));
        console.log("Added chunk 3");

        await new Promise(resolve => setTimeout(resolve, 500));

        // Add completion marker
        await redis.xadd(streamKey, "*", {
          type: "metadata",
          status: "completed",
          completedAt: new Date().toISOString(),
          totalChunks: 3,
          fullContent: "The answer to 15 * 7 + 23 is 128.",
          timestamp: new Date().toISOString(),
        });
        await redis.publish(streamKey, JSON.stringify({ type: "metadata" }));
        console.log("Added completion marker");
      } catch (error) {
        console.error("Error adding test stream data:", error);
      }
    }, 1000);

    // Return session info immediately
    return NextResponse.json({
      sessionId,
      streamUrl: `/api/v2/stream/${sessionId}`,
      status: "initialized",
      message: "Agent loop initialized. Connect to the stream URL to receive updates.",
    });
  } catch (error) {
    console.error("[Stream Init] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to initialize stream",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}