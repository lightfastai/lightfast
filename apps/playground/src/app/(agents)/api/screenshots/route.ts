import { NextResponse } from "next/server";
import { list } from "@vendor/storage";
import { auth } from "@clerk/nextjs/server";
import { env } from "~/env";

interface ScreenshotBlob {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
}

export async function GET(request: Request) {
  // Check authentication
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const cursor = searchParams.get("cursor") || undefined;
    
    if (!threadId) {
      return NextResponse.json(
        { error: "threadId is required" },
        { status: 400 }
      );
    }

    // List blobs from the threadId-specific directory
    const { blobs, cursor: nextCursor } = await list({
      prefix: `screenshots/${threadId}/`,
      limit,
      cursor,
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    // Transform blob data to our format (no filtering needed since we're already in the threadId directory)
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