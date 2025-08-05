import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";
import { kv } from "@vendor/kv";

export const runtime = "edge";

const createSessionSchema = z.object({
  agentType: z.enum(["browser"]),
});

type Session = {
  id: string;
  userId: string;
  agentType: "browser";
  createdAt: string;
  status: "active" | "completed" | "error";
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = createSessionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const sessionId = nanoid();
    const session: Session = {
      id: sessionId,
      userId,
      agentType: result.data.agentType,
      createdAt: new Date().toISOString(),
      status: "active",
    };

    // Store session in KV with 1 hour TTL
    await kv.set(`session:${sessionId}`, session, { ex: 3600 });
    
    // Add to user's session list
    await kv.sadd(`user:${userId}:sessions`, sessionId);

    return NextResponse.json({ sessionId, session });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's session IDs
    const sessionIds = await kv.smembers(`user:${userId}:sessions`);
    
    if (!sessionIds || sessionIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    // Get session details
    const sessions = await Promise.all(
      sessionIds.map(async (id) => {
        const session = await kv.get<Session>(`session:${id}`);
        return session;
      })
    );

    // Filter out null sessions (expired)
    const activeSessions = sessions.filter(Boolean);

    return NextResponse.json({ sessions: activeSessions });
  } catch (error) {
    console.error("Failed to get sessions:", error);
    return NextResponse.json(
      { error: "Failed to get sessions" },
      { status: 500 }
    );
  }
}