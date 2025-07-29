import { redis } from "../../../../(v2)/ai/config";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

type StreamField = string;
type StreamMessage = [string, StreamField[]];
type StreamData = [string, StreamMessage[]];

const arrToObj = (arr: StreamField[]) => {
  const obj: Record<string, string> = {};
  for (let i = 0; i < arr.length; i += 2) {
    const key = arr[i];
    const value = arr[i + 1];
    if (key && value) {
      obj[key] = value;
    }
  }
  return obj;
};

const json = (data: Record<string, unknown>) => {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  if (!sessionId) {
    return NextResponse.json(
      { error: "Session ID is required" },
      { status: 400 }
    );
  }

  const streamKey = `llm:stream:${sessionId}`;
  const groupName = `sse-group-${nanoid()}`;

  const keyExists = await redis.exists(streamKey);

  if (!keyExists) {
    return NextResponse.json(
      { error: "Stream does not (yet) exist" },
      { status: 412 }
    );
  }

  try {
    await redis.xgroup(streamKey, {
      type: "CREATE",
      group: groupName,
      id: "0",
    });
  } catch (_err) {
    // Group might already exist
  }

  const response = new Response(
    new ReadableStream({
      async start(controller) {
        const readStreamMessages = async () => {
          const chunks = (await redis.xreadgroup(
            groupName,
            "consumer-1",
            streamKey,
            ">"
          )) as StreamData[];

          if (chunks?.length > 0) {
            const [_streamKey, messages] = chunks[0];
            if (messages) {
              for (const [_messageId, fields] of messages) {
                const rawObj = arrToObj(fields);
                
                // Validate message - match working example format
                if (rawObj.type) {
                  console.log("Sending stream message:", rawObj);
                  controller.enqueue(json(rawObj));

                  // Check for completion
                  if (rawObj.type === "metadata" && rawObj.status === "completed") {
                    console.log("Stream completed, closing connection");
                    controller.close();
                    return;
                  }
                }
              }
            }
          }
        };

        await readStreamMessages();

        const subscription = redis.subscribe(streamKey);

        subscription.on("message", async (channel, message) => {
          console.log("Received pub/sub notification:", { channel, message });
          await readStreamMessages();
        });

        subscription.on("error", (error) => {
          console.error(`SSE subscription error on ${streamKey}:`, error);
          controller.enqueue(json({
            type: "error",
            error: error.message,
            timestamp: new Date().toISOString()
          }));
          controller.close();
        });

        req.signal.addEventListener("abort", () => {
          console.log("Client disconnected, cleaning up subscription");
          subscription.unsubscribe();
          controller.close();
        });
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );

  return response;
}