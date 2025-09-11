import { auth } from "@clerk/nextjs/server";
import { db } from "@db/chat/client";
import { LightfastChatArtifact } from "@db/chat";
import { eq, and } from "drizzle-orm";
import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

export const runtime = "edge";

/**
 * GET /api/artifact?id={artifactId}
 * 
 * Clean REST API endpoint for fetching artifacts
 * Follows Vercel's AI chatbot pattern for simplicity
 */
export async function GET(request: NextRequest) {
  try {
    // Extract artifact ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Artifact ID is required' },
        { status: 400 }
      );
    }

    // Check authentication - artifacts require user login
    const authResult = await auth();
    const userId = authResult?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch artifact from database with ownership check
    const artifacts = await db
      .select()
      .from(LightfastChatArtifact)
      .where(
        and(
          eq(LightfastChatArtifact.id, id),
          eq(LightfastChatArtifact.clerkUserId, userId)
        )
      )
      .limit(1);

    const artifact = artifacts[0];

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Return clean JSON response
    return NextResponse.json({
      id: artifact.id,
      title: artifact.title,
      content: artifact.content,
      kind: artifact.kind,
      createdAt: artifact.createdAt,
    });

  } catch (error) {
    console.error('Artifact fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}