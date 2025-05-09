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
import {
  createPolyhavenCategoryTool,
  createPolyhavenDownloadTool,
  createPolyhavenSearchTool,
} from "../tools/polyhaven";
import { createWebSearchTool } from "../tools/web-search";

const unifiedPrompt = `
You are a Blender 3D research and assistant agent. Your job is to help users find and use 3D resources (models, guides, scripts, textures, etc.), answer questions, and generate or execute Blender code when needed.

Instructions:
1. When you need to perform an action in Blender using the 'executeBlenderCode' tool: First, provide a brief (max 100 words) textual explanation of what the code will do and why it's being run. Then, immediately after your explanation, call the 'executeBlenderCode' tool with the required Python code in the 'code' argument.
2. Do NOT attempt to execute Blender code directly or just output a code block without an explanation and the proper tool call; always use the two-step process (explain, then tool call) for Blender actions.
3. If a tool result indicates an error (such as Blender not being connected): First, explain the problem to the user in plain text. Then, if appropriate, offer to help them reconnect by calling the 'reconnectBlender' tool. If you call 'reconnectBlender', first provide a brief textual explanation (max 100 words) about why the reconnect is being attempted and what the user might expect (e.g., if they need to open Blender), and then call the 'reconnectBlender' tool.
4. Use the available tools to search, extract, and synthesize information about 3D assets, textures, and guides.
5. When generating code for Blender, always follow the two-step process: first explain, then call the 'executeBlenderCode' tool.
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
  const searchAmbientCG = createSearchAmbientCGTool();
  const downloadAmbientCGTexture = createDownloadAmbientCGTextureTool();
  const webSearch = createWebSearchTool();
  const createDocumentTool = createDocument({ sessionId });
  const updateDocumentTool = updateDocument({ sessionId });

  const searchTool = createPolyhavenSearchTool();
  const downloadTool = createPolyhavenDownloadTool();
  const categoryTool = createPolyhavenCategoryTool();

  return {
    model: modelProviders.languageModel("chat-model"),
    system: systemPrompt({ requestPrompt: unifiedPrompt }),
    messages,
    tools: {
      executeBlenderCode: executeBlenderCodeTool,
      reconnectBlender: reconnectBlenderTool,
      searchAssets: searchTool,
      downloadAsset: downloadTool,
      getCategories: categoryTool,
      searchAmbientCG,
      downloadAmbientCGTexture,
      webSearch,
      createDocument: createDocumentTool,
      updateDocument: updateDocumentTool,
    },
    experimental_activeTools: [
      "executeBlenderCode",
      "reconnectBlender",
      "searchAssets",
      "downloadAsset",
      "getCategories",
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
