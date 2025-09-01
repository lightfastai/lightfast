import { createAgent } from "lightfast/agent";
import { gateway } from "@ai-sdk/gateway";

/**
 * Test Agent - For testing dependency tracking
 */
export const testAgent = createAgent({
  name: "test-agent",
  system: `You are a test agent for dependency tracking. Hot reload test!`,
  model: gateway("claude-3-5-sonnet-20241022"),
});