import type { CoreMessage, streamText } from "ai";
import { smoothStream } from "ai";

import { modelProviders } from "~/app/(ai)/api/chat/providers/models";
import { systemPrompt } from "../prompts";
import {
  createExecuteBlenderCodeTool,
  createReconnectBlenderTool,
} from "../tools/blender";

const blenderPrompt = `
Instructions:

1. You are a friendly assistant! Keep your responses concise and helpful. 
2. When you need to perform an action in Blender, call the 'executeBlenderCode' tool and provide the required Python code as the 'code' argument.
3. Do NOT attempt to execute Blender code directly or just output a code block; always use the tool for Blender actions. If no Blender action is needed, respond normally.
4. If a tool result indicates an error (such as Blender not being connected), explain the problem to the user and offer to help them reconnect or try again. 
5. You may call the 'reconnectBlender' tool if needed.
`;

type BlenderReturn = Parameters<typeof streamText>[0];

export function blender({
  messages,
}: {
  messages: CoreMessage[];
}): BlenderReturn {
  try {
    // Create model-specific tools
    const executeBlenderCodeTool = createExecuteBlenderCodeTool();
    const reconnectBlenderTool = createReconnectBlenderTool();

    return {
      model: modelProviders.languageModel("chat-model"),
      system: systemPrompt({ requestPrompt: blenderPrompt }),
      messages,
      tools: {
        executeBlenderCode: executeBlenderCodeTool,
        reconnectBlender: reconnectBlenderTool,
      },
      experimental_activeTools: ["executeBlenderCode", "reconnectBlender"],
      maxSteps: 5,
      experimental_transform: smoothStream({
        chunking: "word",
      }),
    };
  } catch (error) {
    console.error("Error in chatResearcher:", error);
    throw error;
  }
}
