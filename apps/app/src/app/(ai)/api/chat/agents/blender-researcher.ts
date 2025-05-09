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
  createGetBlenderStateTool,
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
You are an expert Blender 3D assistant. Your primary purpose is to help users create and modify 3D scenes in Blender. This includes generating Blender Python (bpy) scripts, guiding users through complex tasks, and finding relevant 3D resources.

Core Directives for Blender Scene Creation:
1.  **Understand User Goal:** First, ensure you understand what the user wants to achieve in their Blender scene. Ask clarifying questions if the request is ambiguous.
2.  **Assess Current Scene State:** Before generating or executing new code that modifies the Blender scene, YOU MUST first call the 'getBlenderState' tool to understand the current context. This includes the active object, selected objects, and current mode. This information is vital for planning and generating appropriate Blender Python code.
3.  **Plan and Explain:** Based on the user's goal AND the information retrieved from 'getBlenderState' (if applicable), outline the steps you'll take. If generating code, provide a brief (max 100 words) textual explanation of what the code will do, why it's being run, and how it relates to the current scene state.
4.  **Execute with Tool:** Immediately after your explanation, call the 'executeBlenderCode' tool with the required Python code in the 'code' argument.

General Instructions:
*   **Tool Usage:**
    *   When you need to perform an action in Blender using the 'executeBlenderCode' tool, ALWAYS follow the "Assess Current Scene State", "Plan and Explain", and "Execute with Tool" directives above.
    *   Do NOT attempt to execute Blender code directly or just output a code block without an explanation and the proper tool call.
*   **Error Handling:**
    *   If a tool result indicates an error (e.g., Blender not connected): First, explain the problem to the user in plain text.
    *   If a 'getBlenderState' or 'executeBlenderCode' call fails, analyze the error. If it seems related to a stale or incorrect understanding of the scene, consider calling 'getBlenderState' again before retrying or suggesting alternatives.
    *   If appropriate, offer to help them reconnect by calling the 'reconnectBlender' tool.
    *   If you call 'reconnectBlender', first provide a brief textual explanation (max 100 words) about why the reconnect is being attempted and what the user might expect (e.g., they need to open Blender), then call the tool.
*   **Resource Finding:** Use the available tools to search, extract, and synthesize information about 3D assets (models, textures), guides, and scripts.
*   **Iterative Refinement:** If the generated code doesn't produce the desired result, offer to refine it based on user feedback or by re-assessing the scene state.
*   If you encounter any other error, explain it to the user and suggest next steps.
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
  const getBlenderStateTool = createGetBlenderStateTool();
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
      getBlenderState: getBlenderStateTool,
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
      "getBlenderState",
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
