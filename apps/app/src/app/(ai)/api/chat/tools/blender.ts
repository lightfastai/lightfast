import { generateText, tool } from "ai";
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

// Define the SceneInfo interface based on the data returned from getBlenderSceneInfo
interface SceneInfo {
  name: string;
  object_count: number;
  objects: {
    name: string;
    type: string;
    location: [number, number, number];
    dimensions: [number, number, number];
    scale: [number, number, number];
    rotation: [number, number, number];
    vertex_count?: number;
    face_count?: number;
    edge_count?: number;
    materials?: string[];
    bounding_box?: [number, number, number][];
    custom_properties?: Record<string, any>;
  }[];
  materials_count: number;
}

/**
 * Creates a tool to analyze a Blender scene and provide conceptual insights and pseudo-code suggestions.
 */
export function createAnalyzeBlenderModelTool() {
  return tool({
    description:
      "Analyzes the current Blender scene to understand its structure, proportions, and relationships. This tool helps identify what's in the scene and what conceptual changes might improve it. It provides analysis for any type of 3D scene - from architectural models to character models, mechanical objects, or abstract scenes. It identifies patterns, proportions, and structural relationships, but does NOT generate executable code. Instead, it offers clear explanations and conceptual suggestions that respect the creator's intent while highlighting opportunities for improvement.",
    parameters: z.object({
      modelType: z
        .string()
        .optional()
        .describe(
          "Optional: Type of model to analyze (e.g., 'character', 'mechanical', 'architectural', etc.)",
        ),
      sceneInfo: z
        .any()
        .describe("The scene information retrieved from getBlenderSceneInfo"),
      analysisType: z
        .enum(["proportions", "structure", "complete", "custom"])
        .optional()
        .describe(
          "Optional: Type of analysis to perform (proportions, structure, complete, or custom)",
        ),
      customPrompt: z
        .string()
        .optional()
        .describe(
          "Optional: Custom instructions for the analysis if using analysisType='custom'",
        ),
    }),
    execute: async (args) => {
      try {
        const {
          modelType,
          sceneInfo,
          analysisType = "complete",
          customPrompt,
        } = args as {
          modelType?: string;
          sceneInfo: SceneInfo;
          analysisType?: "proportions" | "structure" | "complete" | "custom";
          customPrompt?: string;
        };

        // Check if we have a valid scene
        if (!sceneInfo?.objects || sceneInfo.objects.length === 0) {
          return {
            success: false,
            error:
              "No scene information provided or empty scene. Please call getBlenderSceneInfo first and ensure your scene contains objects.",
          };
        }

        // Initialize variables for analysis
        let analysisText = "";
        const suggestedApproaches: string[] = [];

        // 1. FIRST PHASE: Basic scene statistics and object type detection
        const objectTypeCount: Record<string, number> = {};
        const objectsByType: Record<string, any[]> = {};

        for (const obj of sceneInfo.objects) {
          // Count object types
          objectTypeCount[obj.type] = (objectTypeCount[obj.type] || 0) + 1;

          // Group objects by type
          if (!objectsByType[obj.type]) {
            objectsByType[obj.type] = [];
          }

          // Using non-null assertion since we just ensured the array exists
          objectsByType[obj.type]!.push(obj);
        }

        // 2. Calculate size relationships and hierarchies
        // Find the largest and smallest objects
        let largestObject = { name: "", volume: 0 };
        let smallestObject = { name: "", volume: Infinity };

        // Calculate bounding box of entire scene
        const sceneBounds = {
          min: [Infinity, Infinity, Infinity] as [number, number, number],
          max: [-Infinity, -Infinity, -Infinity] as [number, number, number],
        };

        // Analyze spatial relationships
        for (const obj of sceneInfo.objects) {
          if (obj.dimensions) {
            // Calculate approximate volume
            const volume =
              obj.dimensions[0] * obj.dimensions[1] * obj.dimensions[2];

            if (volume > largestObject.volume) {
              largestObject = { name: obj.name, volume };
            }

            if (volume < smallestObject.volume && volume > 0) {
              smallestObject = { name: obj.name, volume };
            }

            // Update scene bounds if we have valid location data
            if (
              obj.location &&
              typeof obj.location[0] === "number" &&
              typeof obj.location[1] === "number" &&
              typeof obj.location[2] === "number"
            ) {
              // Calculate bounds with half dimensions
              const x = obj.location[0];
              const y = obj.location[1];
              const z = obj.location[2];
              const halfX = obj.dimensions[0] / 2;
              const halfY = obj.dimensions[1] / 2;
              const halfZ = obj.dimensions[2] / 2;

              // Update min bounds
              sceneBounds.min[0] = Math.min(sceneBounds.min[0], x - halfX);
              sceneBounds.min[1] = Math.min(sceneBounds.min[1], y - halfY);
              sceneBounds.min[2] = Math.min(sceneBounds.min[2], z - halfZ);

              // Update max bounds
              sceneBounds.max[0] = Math.max(sceneBounds.max[0], x + halfX);
              sceneBounds.max[1] = Math.max(sceneBounds.max[1], y + halfY);
              sceneBounds.max[2] = Math.max(sceneBounds.max[2], z + halfZ);
            }
          }
        }

        // Calculate scene dimensions
        const sceneDimensions: [number, number, number] = [
          sceneBounds.max[0] - sceneBounds.min[0],
          sceneBounds.max[1] - sceneBounds.min[1],
          sceneBounds.max[2] - sceneBounds.min[2],
        ];

        // Build a comprehensive prompt based on scene data and analysis type
        let analysisPrompt = "";

        // Handle custom prompt if provided
        if (analysisType === "custom" && customPrompt) {
          analysisPrompt = `
You are an expert 3D modeling specialist. Analyze this Blender scene:

${JSON.stringify(sceneInfo, null, 2)}

${customPrompt}

Provide a detailed analysis of the scene structure, relationships, and proportions. Do NOT provide executable code - instead, describe conceptually what changes might enhance the model, using clear explanations and pseudocode where appropriate.
`;
        }
        // Handle general scene analysis
        else {
          // Create a summary of the scene for the prompt
          const sceneSummary = {
            name: sceneInfo.name,
            objectCount: sceneInfo.object_count,
            objectTypeDistribution: objectTypeCount,
            sceneDimensions: sceneDimensions,
            largestObject: largestObject,
            smallestObject: smallestObject.name !== "" ? smallestObject : null,
            meshObjects: objectsByType.MESH
              ? objectsByType.MESH.map((obj) => ({
                  name: obj.name,
                  dimensions: obj.dimensions,
                  location: obj.location,
                  vertexCount: obj.vertex_count,
                  faceCount: obj.face_count,
                }))
              : [],
          };

          // Generate a general scene analysis prompt
          analysisPrompt = `
You are an expert 3D modeling and design specialist. Analyze this Blender scene:

${JSON.stringify(sceneSummary, null, 2)}

${modelType ? `The user has indicated this is a ${modelType} model.` : ""}

Please provide:
1. ${analysisType === "complete" || analysisType === "structure" ? "A structural analysis identifying the main components and their relationships" : ""}
2. ${analysisType === "complete" || analysisType === "proportions" ? "An assessment of object proportions, identifying any issues with scale or relationships between objects" : ""}
3. ${analysisType === "complete" ? "Observations about the scene organization and hierarchy" : ""}
4. Conceptual suggestions for potential improvements (as pseudocode or descriptions, NOT executable code)

Focus on understanding the scene's structure and purpose, offering insights that would help the creator better understand their model and what possibilities exist for enhancement.
`;
        }

        try {
          // Generate analysis using a reasoning model
          const response = await generateText({
            model: providers.languageModel("reasoning"),
            messages: [
              {
                role: "system",
                content:
                  "You are an expert 3D modeling specialist with deep knowledge of character modeling, mechanical design, architectural principles, and Blender. Provide concise but thorough analysis and conceptual guidance that helps the user understand their scene better. Focus on proportions, relationships, and structure rather than implementation details.",
              },
              { role: "user", content: analysisPrompt },
            ],
            temperature: 0.2,
            maxTokens: 1500,
          });

          // Get response text
          const responseText = String(response);

          // Extract suggested approaches using a pattern-matching approach
          const suggestionsPattern =
            /(?:suggested\s+approaches|potential\s+improvements|recommendations|could\s+consider):([\s\S]*?)(?=\n\n|$)/i;
          const suggestionsMatch = suggestionsPattern.exec(responseText);

          if (suggestionsMatch?.[1]) {
            // Parse suggestions into bullet points
            const suggestions = suggestionsMatch[1]
              .split(/\n-|\n\d+\./)
              .map((s) => s.trim())
              .filter((s) => s.length > 0);

            suggestions.forEach((s) => suggestedApproaches.push(s));
          }

          // Clean up analysis text
          analysisText = responseText.trim();
        } catch (error) {
          console.error("Error generating analysis:", error);
          // If AI generation fails, still provide basic results
          analysisText = `Basic scene analysis for "${sceneInfo.name}":\n`;
          analysisText += `- Total objects: ${sceneInfo.object_count}\n`;
          Object.entries(objectTypeCount).forEach(([type, count]) => {
            analysisText += `- ${type} objects: ${count}\n`;
          });
          analysisText += `\nScene dimensions: Width: ${sceneDimensions[0]?.toFixed(2) || "?"}m, Depth: ${sceneDimensions[1]?.toFixed(2) || "?"}m, Height: ${sceneDimensions[2]?.toFixed(2) || "?"}m`;
        }

        // Return the analysis results
        return {
          success: true,
          modelType: modelType || "general",
          analysis: analysisText,
          sceneStats: {
            objectCount: sceneInfo.object_count,
            objectTypes: objectTypeCount,
            dimensions: sceneDimensions.map((d) => parseFloat(d.toFixed(2))),
            largestObject: largestObject.name,
          },
          suggestedApproaches: suggestedApproaches,
        };
      } catch (error) {
        console.error("Error analyzing Blender model:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unknown error analyzing model",
        };
      }
    },
  });
}
