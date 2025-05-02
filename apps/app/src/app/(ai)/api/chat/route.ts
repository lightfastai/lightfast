import type { Message } from "ai";
import { streamText } from "ai";

import { registry } from "~/providers/ai-provider";

// CORS headers for the desktop app
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight requests
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  const { messages } = (await request.json()) as { messages: Message[] };

  const result = streamText({
    model: registry.languageModel("openai:gpt-4-turbo-preview"),
    messages,
    maxTokens: 1000,
    temperature: 0.7,
  });

  const response = result.toDataStreamResponse();

  // Add CORS headers to the response
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
