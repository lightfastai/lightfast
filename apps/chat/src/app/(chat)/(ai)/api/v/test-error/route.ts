/**
 * Development-only endpoint for testing error scenarios
 * This should be removed or disabled in production
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";

export async function POST(req: NextRequest) {
  // Only allow in development
  if (env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Test endpoint only available in development" },
      { status: 404 }
    );
  }

  const { errorType } = await req.json();

  // Simulate different error scenarios
  switch (errorType) {
    case "rate-limit":
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );

    case "bot-detection":
      return NextResponse.json(
        { error: "Bot detection triggered" },
        { status: 403 }
      );

    case "model-access-denied":
      return NextResponse.json(
        { 
          error: "Access denied", 
          message: "This model requires authentication. Please sign in to use this model." 
        },
        { status: 403 }
      );

    case "network-error":
      // Simulate network timeout
      await new Promise(resolve => setTimeout(resolve, 30000));
      return new Response(null, { status: 408 });

    case "invalid-request":
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );

    case "authentication":
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );

    case "model-unavailable":
      return NextResponse.json(
        { error: "Model gpt-5-nano is currently unavailable" },
        { status: 503 }
      );

    case "server-error":
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_SERVER_ERROR" },
        { status: 500 }
      );

    case "no-content":
      // Simulate successful request but no content generated
      return new Response(
        `data: {"type":"error","error":"NoContentGeneratedError","message":"No content was generated"}\n\n`,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
          },
        }
      );

    case "stream-error":
      // Start streaming then error
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"text","text":"Starting to respond..."}\n\n'));
          await new Promise(resolve => setTimeout(resolve, 1000));
          controller.enqueue(encoder.encode('data: {"type":"error","error":"StreamInterrupted","message":"Connection lost"}\n\n'));
          controller.close();
        },
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });

    default:
      return NextResponse.json(
        { message: "Test successful" },
        { status: 200 }
      );
  }
}

export async function GET() {
  if (env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Test endpoint only available in development" },
      { status: 404 }
    );
  }

  // Return available test scenarios
  return NextResponse.json({
    availableTests: [
      "rate-limit",
      "bot-detection",
      "model-access-denied",
      "network-error",
      "invalid-request",
      "authentication",
      "model-unavailable",
      "server-error",
      "no-content",
      "stream-error"
    ],
    usage: "POST to this endpoint with { errorType: 'rate-limit' }"
  });
}