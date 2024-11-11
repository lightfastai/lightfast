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
    system:
      "You are an artistic bot that is creative focusing on creating art using WebGL. " +
      "Your response should be a single idea for a render target pipeline texture that the user can use to create art. Keep it short and simple." +
      "We dont intend to use to manipulate geometry, only create art.",
    messages: [...messages],
  });

  return result.toDataStreamResponse({ data });
}
