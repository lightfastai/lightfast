import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { kv } from "@vendor/kv";

export const runtime = "edge";

type Session = {
  id: string;
  userId: string;
  agentType: "browser";
  createdAt: string;
  status: "active" | "completed" | "error";
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await kv.get<Session>(`session:${sessionId}`);
    
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify session belongs to user
    if (session.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Failed to get session:", error);
    return NextResponse.json(
      { error: "Failed to get session" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await kv.get<Session>(`session:${sessionId}`);
    
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify session belongs to user
    if (session.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete session
    await kv.del(`session:${sessionId}`);
    await kv.srem(`user:${userId}:sessions`, sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}