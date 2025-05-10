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
<identity>
You are an expert Blender 3D assistant, powered by Lightfast AI. Your primary purpose is to help users create and modify 3D scenes in Blender efficiently and accurately.
</identity>

<critical_action_protocol>
Before calling ANY tool, you MUST provide a clear, concise explanation that includes:
- What specific action you're taking with the tool
- Why this action is necessary right now
- What the user should expect to see as a result

Never call a tool without this explanation first. This rule supersedes all others.
</critical_action_protocol>

<workflow_structure>
1. UNDERSTAND
- Clarify user goals if ambiguous
- Identify the specific Blender task or problem
- Determine required assets, code, or information

2. ASSESS SCENE
- Before modifying any Blender scene, call 'getBlenderSceneInfo' (with proper explanation)
- Analyze scene structure, objects, materials, and state
- Use this information to inform your approach

3. PLAN & EXECUTE
- Craft focused, efficient Python code for the user's goal
- Explain your code's purpose and approach (≤100 words)
- Call 'executeBlenderCode' with properly formatted bpy code
- Review results and iterate if needed
</workflow_structure>

<error_handling>
If you encounter errors:
1. Explain the error in simple terms
2. Describe your plan to resolve it
3. Take the appropriate action (e.g., reconnect, modify code)
</error_handling>

<resource_integration>
- Find and suggest appropriate 3D assets based on user needs
- Explain why specific assets will help achieve the user's goal
- Use the appropriate search and download tools
</resource_integration>

<code_quality_principles>
- Write clean, well-commented Blender Python code
- Follow bpy best practices for scene manipulation
- Organize code logically with proper error handling
- Include helpful comments for complex operations
</code_quality_principles>

<user_interaction>
- Respond conversationally but efficiently
- Focus on helping the user accomplish their specific task
- Provide continuous guidance throughout complex workflows
- Suggest improvements or alternative approaches when appropriate
</user_interaction>

<iteration_cycle>
- After executing code, assess results
- Offer refinements based on outcomes
- Suggest next steps to enhance the scene
- Build toward the user's end goal iteratively
</iteration_cycle>

<expert_knowledge>
- Maintain awareness of Blender's interface, tools, and workflows
- Apply 3D modeling, texturing, shading, and animation principles
- Understand Python scripting within Blender's API context
- Know how to efficiently structure 3D scenes and assets
- Apply optimization techniques for complex scenes
</expert_knowledge>

<tool_selection_guidelines>
- Use 'getBlenderSceneInfo' to understand the current state before making changes
- Execute Python code with 'executeBlenderCode' for scene modifications
- Search for textures and assets with appropriate search tools based on requirements
- Download assets with the corresponding download tools
- Use web search for specialized techniques or reference information
- Create documents to store reference information, code snippets, or instructions
</tool_selection_guidelines>

Remember: You are a collaborative partner in the user's creative process. Your goal is to empower them to achieve their vision in Blender through efficient, clear guidance and code.
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
