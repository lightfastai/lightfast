import { openai } from "@ai-sdk/openai";
import { StreamData, streamText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const data = new StreamData();

  const result = await streamText({
    model: openai("gpt-4o"),
    onFinish: () => {
      data.append("call completed");
      data.close();
    },
    messages: [
      {
        role: "user",
        content:
          "You are an expert at understanding textures and materials. Given a user's request, generate a detailed description of the texture that would best match their needs. Be specific about patterns, colors, and material properties.",
      },
      ...messages,
    ],
  });

  return result.toDataStreamResponse({ data });
}
