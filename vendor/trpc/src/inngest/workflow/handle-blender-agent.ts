import { createAgent, openai } from "@inngest/agent-kit";

import { openAiEnv } from "@repo/ai/openai-env";

import { inngest } from "../client/client";

export const deepResearchNetworkFunction = inngest.createFunction(
  {
    id: "deep-research-network",
  },
  {
    event: "blender-agent/run",
  },
  async ({ event, step }) => {
    const { input } = event.data;

    const blenderAgent = createAgent({
      name: "Blender Agent",
      system:
        "You are a blender agent who can help with research and planning of Blender projects.",
      model: openai({
        model: "gpt-4o",
        apiKey: openAiEnv.OPENAI_API_KEY,
      }),
    });

    // Run the agent with an input.  This automatically uses steps
    // to call your AI model.
    const { output } = await blenderAgent.run(input);

    return output;
  },
);
