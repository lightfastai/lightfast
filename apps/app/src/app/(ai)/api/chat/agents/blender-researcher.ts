import type { CoreMessage, streamText } from "ai";
import { smoothStream } from "ai";

import { createProvider } from "~/app/(ai)/api/chat/providers/models";
import { systemPrompt } from "../prompts";
import {
  createDownloadAmbientCGTextureTool,
  createSearchAmbientCGTool,
} from "../tools/ambientcg";
import {
  createExecuteBlenderCodeTool,
  createGetBlenderSceneInfoTool,
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
2.  **Assess Current Scene State:** Before generating or executing new code that modifies the Blender scene, YOU MUST first call the 'getBlenderSceneInfo' tool to understand the current context. This includes the scene name, objects in the scene, and their properties. This information is vital for planning and generating appropriate Blender Python code.
3.  **Plan and Explain:** Based on the user's goal AND the information retrieved from 'getBlenderSceneInfo' (if applicable), outline the steps you'll take. If generating code, provide a brief (max 100 words) textual explanation of what the code will do, why it's being run, and how it relates to the current scene.
4.  **Execute with Tool:** Immediately after your explanation, call the 'executeBlenderCode' tool with the required Python code in the 'code' argument.

General Instructions:
*   **Tool Usage:**
    *   When you need to perform an action in Blender using the 'executeBlenderCode' tool, ALWAYS follow the "Assess Current Scene State", "Plan and Explain", and "Execute with Tool" directives above.
    *   Do NOT attempt to execute Blender code directly or just output a code block without an explanation and the proper tool call.
*   **Tool Call Explanations:**
    *   Before calling any tool (including but not limited to 'executeBlenderCode', 'getBlenderSceneInfo', 'reconnectBlender', asset search, or download tools), you must always provide a brief, clear explanation to the user about:
        - What you are about to do
        - Why you are doing it
        - What the user should expect as a result
    *   Only after this explanation should you proceed to call the tool.
*   **Error Handling:**
    *   If a tool result indicates an error (for example, "Blender is not connected"), you must:
        1. **First, explain the error to the user in plain language.** Clearly state what went wrong and, if possible, why it happened.
        2. **Then, describe the next step you will take to resolve the issue.** For example, if you are about to call the 'reconnectBlender' tool, briefly explain why you are doing this and what the user should expect (e.g., "I will now attempt to reconnect to Blender. Please make sure Blender is open and running.").
        3. **Only after these explanations, proceed to call the appropriate tool** (such as 'reconnectBlender').
    *   If a 'getBlenderSceneInfo' or 'executeBlenderCode' call fails, analyze the error and follow the above steps. If the error is due to a stale or incorrect understanding of the scene, consider calling 'getBlenderSceneInfo' again before retrying or suggesting alternatives.
    *   For any other errors, always explain the issue to the user and suggest next steps.
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
  const getBlenderSceneInfoTool = createGetBlenderSceneInfoTool();
  const searchAmbientCG = createSearchAmbientCGTool();
  const downloadAmbientCGTexture = createDownloadAmbientCGTextureTool();
  const webSearch = createWebSearchTool();
  const createDocumentTool = createDocument({ sessionId });
  const updateDocumentTool = updateDocument({ sessionId });

  const searchTool = createPolyhavenSearchTool();
  const downloadTool = createPolyhavenDownloadTool();
  const categoryTool = createPolyhavenCategoryTool();

  return {
    model: createProvider.languageModel("reasoning"),
    system: systemPrompt({ requestPrompt: unifiedPrompt }),
    messages,
    tools: {
      executeBlenderCode: executeBlenderCodeTool,
      reconnectBlender: reconnectBlenderTool,
      getBlenderSceneInfo: getBlenderSceneInfoTool,
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
      "getBlenderSceneInfo",
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
