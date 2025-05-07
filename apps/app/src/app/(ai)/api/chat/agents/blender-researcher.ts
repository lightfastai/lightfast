import type { CoreMessage, streamText } from "ai";
import { smoothStream } from "ai";

import { modelProviders } from "~/app/(ai)/api/chat/providers/models";
import { systemPrompt } from "../prompts";
import {
  createDownloadAmbientCGTextureTool,
  createSearchAmbientCGTool,
} from "../tools/ambientcg";
import {
  createExecuteBlenderCodeTool,
  createReconnectBlenderTool,
} from "../tools/blender";
import { createDocument, updateDocument } from "../tools/document";
import { createPolyhavenResearcherTool } from "../tools/polyhaven";
import { createWebSearchTool } from "../tools/web-search";

const unifiedPrompt = `
You are a Blender 3D research and assistant agent. Your job is to help users find and use 3D resources (models, guides, scripts, textures, etc.), answer questions, and generate or execute Blender code when needed.

Instructions:
1. When you need to perform an action in Blender, call the 'executeBlenderCode' tool and provide the required Python code as the 'code' argument.
2. Do NOT attempt to execute Blender code directly or just output a code block; always use the tool for Blender actions. If no Blender action is needed, respond normally.
3. If a tool result indicates an error (such as Blender not being connected), explain the problem to the user and offer to help them reconnect or try again. You may call the 'reconnectBlender' tool if needed.
4. Use the available tools to search, extract, and synthesize information about 3D assets, textures, and guides.
5. When generating code, always use the 'executeBlenderCode' tool.
6. If you encounter an error, explain it to the user and suggest next steps.
`;

type UnifiedResearcherReturn = Parameters<typeof streamText>[0];

export function blenderResearcher({
  sessionId,
  messages,
}: {
  sessionId: string;
  messages: CoreMessage[];
}): UnifiedResearcherReturn {
  // Tool definitions
  const executeBlenderCodeTool = createExecuteBlenderCodeTool();
  const reconnectBlenderTool = createReconnectBlenderTool();
  const polyhavenResearcher = createPolyhavenResearcherTool();
  const searchAmbientCG = createSearchAmbientCGTool();
  const downloadAmbientCGTexture = createDownloadAmbientCGTextureTool();
  const webSearch = createWebSearchTool();
  const createDocumentTool = createDocument({ sessionId });
  const updateDocumentTool = updateDocument({ sessionId });

  return {
    model: modelProviders.languageModel("chat-model"),
    system: systemPrompt({ requestPrompt: unifiedPrompt }),
    messages,
    tools: {
      executeBlenderCode: executeBlenderCodeTool,
      reconnectBlender: reconnectBlenderTool,
      polyhavenResearcher,
      searchAmbientCG,
      downloadAmbientCGTexture,
      webSearch,
      createDocument: createDocumentTool,
      updateDocument: updateDocumentTool,
    },
    experimental_activeTools: [
      "executeBlenderCode",
      "reconnectBlender",
      "polyhavenResearcher",
      "searchAmbientCG",
      "downloadAmbientCGTexture",
      "webSearch",
      "createDocument",
      "updateDocument",
    ],
    maxSteps: 7,
    experimental_transform: smoothStream({ chunking: "word" }),
  };
}
