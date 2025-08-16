import { NextResponse } from "next/server";
import { list } from "@vendor/storage";
import { auth } from "@clerk/nextjs/server";
import { env } from "~/env";
import { RedisMemory } from "@lightfastai/core/agent/memory/redis";

interface ScreenshotBlob {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
}

// Create memory instance
const memory = new RedisMemory({
  url: env.KV_REST_API_URL,
  token: env.KV_REST_API_TOKEN,
});

export async function GET(request: Request) {
  // Check authentication
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const cursor = searchParams.get("cursor") || undefined;
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // Security check: Verify session ownership via memory system
    // The resourceId in session metadata stores the userId (owner)
    const sessionData = await memory.getSession(sessionId);
    if (!sessionData || sessionData.resourceId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: Access denied to this session" },
        { status: 403 }
      );
    }

    // List blobs from the sessionId-specific directory
    const { blobs, cursor: nextCursor } = await list({
      prefix: `screenshots/${sessionId}/`,
      limit,
      cursor,
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    // Transform blob data to our format (no filtering needed since we're already in the sessionId directory)
    const screenshots: ScreenshotBlob[] = blobs
      .map(blob => ({
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
      }))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return NextResponse.json({
      screenshots,
      nextCursor,
    });
  } catch (error) {
    console.error("Failed to fetch screenshots:", error);
    return NextResponse.json(
      { error: "Failed to fetch screenshots" },
      { status: 500 }
    );
  }
}