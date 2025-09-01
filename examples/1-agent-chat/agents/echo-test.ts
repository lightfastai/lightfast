import { createAgent } from "lightfast/agent";
import { openai } from "@ai-sdk/openai";

/**
 * Echo Test Agent - For local testing
 * Note: This still requires OPENAI_API_KEY to be set
 */

export const echoTestAgent = createAgent({
  name: "echo-test",
  system: `You are a simple echo test agent.
For testing purposes, simply acknowledge any message you receive.
Always respond with: "Echo received: [summarize the message]".`,
  model: openai("gpt-3.5-turbo"),
});