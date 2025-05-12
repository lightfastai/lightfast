import type { DataStreamWriter } from "ai";
import { streamText, tool } from "ai";
import { z } from "zod";

import { providers } from "~/app/(ai)/api/chat/providers/models";

const executeBlenderCodeToolSchema = z.object({
  code: z.string().describe("The Python code to execute in Blender"),
});

/**
 * Creates a tool for executing Python code in Blender.
 */
export function createExecuteBlenderCodeTool() {
  return tool({
    description:
      "Execute Blender Python code to create, modify, or analyze 3D models. When writing code, always include proper error handling: check if collections exist before accessing them, use try/except blocks for critical operations, verify objects before linking/unlinking from collections, and implement helper functions for repetitive operations. Use this tool to apply any adjustment code generated from analyzeBlenderModel.",
    parameters: executeBlenderCodeToolSchema,
    // execute function removed to enable frontend confirmation
  });
}

export const reconnectBlenderToolSchema = z.object({});

/**
 * Creates a tool to reconnect to Blender when connection is lost.
 */
export function createReconnectBlenderTool() {
  return tool({
    description:
      "Reconnect to Blender when connection is lost or errors occur. Call this tool immediately when encountering Blender execution errors or when the scene information appears outdated. Explain to the user that you're attempting to reconnect before calling this tool.",
    parameters: reconnectBlenderToolSchema,
    // execute function removed to enable frontend confirmation
  });
}

// Schema for the GetBlenderSceneInfo tool (no parameters needed)
export const getBlenderSceneInfoToolSchema = z.object({});

/**
 * Creates a tool to get the current scene information from Blender.
 */
export function createGetBlenderSceneInfoTool() {
  return tool({
    description:
      "Get the current Blender scene information (scene name, objects, materials, and dimensions). This tool must be called before making any scene modifications or analyses. Always fetch the latest scene information after executing code that modifies the scene, or when you need up-to-date information about the model's structure and dimensions.",
    parameters: getBlenderSceneInfoToolSchema,
    // execute function removed to enable frontend confirmation
  });
}

/**
 * Creates a tool to analyze a Blender scene and provide conceptual insights and pseudo-code suggestions.
 */
export function createAnalyzeBlenderModelTool(dataStream: DataStreamWriter) {
  return tool({
    description:
      "Analyzes the current Blender scene to understand its structure, proportions, and relationships. This tool helps identify what's in the scene and what conceptual changes might improve it. It provides analysis for any type of 3D scene - from architectural models to character models, mechanical objects, or abstract scenes.",
    parameters: z.object({
      sceneInfo: z
        .any()
        .describe("The scene information retrieved from getBlenderSceneInfo"),
      focus: z
        .string()
        .optional()
        .describe(
          "Optional: Focus area for analysis ('proportions', 'structure', 'materials', 'optimization', or leave empty for general analysis)",
        ),
      customPrompt: z
        .string()
        .optional()
        .describe(
          "Optional: Any specific question or analysis request about the scene",
        ),
    }),
    execute: async (args) => {
      try {
        const { sceneInfo, focus, customPrompt } = args as {
          sceneInfo: any;
          focus?: string;
          customPrompt?: string;
        };

        console.log("sceneInfo", sceneInfo);
        if (!sceneInfo?.objects || sceneInfo.objects.length === 0) {
          dataStream.writeData({
            type: "blender_analysis_error",
            error: "No scene information provided or empty scene.",
          });
          return {
            success: false,
            error:
              "No scene information provided or empty scene. Please call getBlenderSceneInfo first and ensure your scene contains objects.",
          };
        }

        let prompt = `Analyze this Blender scene:

${JSON.stringify(sceneInfo)}

`;
        if (focus)
          prompt += `Focus specifically on the ${focus} of this scene.\n\n`;
        if (customPrompt) prompt += `${customPrompt}\n\n`;
        prompt += `Provide a concise analysis of the scene with observations and conceptual suggestions for improvement. Include any potential issues or opportunities you notice. Consider the model structure, proportions, and organization. If relevant, suggest high-level approaches to improve the model without providing specific code.`;

        dataStream.writeData({
          type: "blender_analysis_started",
          message: "Blender scene analysis started...",
        });

        const { fullStream } = streamText({
          model: providers.languageModel("reasoning"),
          messages: [
            {
              role: "system",
              content:
                "You are an expert 3D modeling specialist with deep knowledge of Blender, modeling techniques, and design principles. Provide concise but insightful analysis of 3D scenes. Focus on clear observations and actionable suggestions.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          maxTokens: 1000,
          // stream: true, // Some SDKs might need an explicit stream: true, but generateText usually implies it or handles it via streamText/streamObject
        });

        let fullAnalysis = "";
        for await (const textPart of fullStream) {
          if (textPart.type === "text-delta") {
            const { textDelta } = textPart;
            fullAnalysis += textDelta;
            dataStream.writeData({
              type: "blender_analysis_chunk",
              content: textDelta,
            });
          }
        }

        dataStream.writeData({
          type: "blender_analysis_completed",
          fullAnalysisBrief: fullAnalysis.substring(0, 100) + "...",
        });

        return {
          success: true,
          analysis: fullAnalysis,
        };
      } catch (error) {
        console.error("Error analyzing Blender model:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error analyzing model";
        dataStream.writeData({
          type: "blender_analysis_error",
          error: errorMessage,
        });
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  });
}
