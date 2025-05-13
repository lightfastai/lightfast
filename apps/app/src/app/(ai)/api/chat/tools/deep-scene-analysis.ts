import { generateText, tool } from "ai";
import { z } from "zod";

import { providers } from "../providers/models";

// Schema for the tool parameters
const DeepSceneAnalysisSchema = z.object({
  scene_info: z
    .string()
    .describe(
      "JSON string containing information about the current Blender scene",
    ),
});

/**
 * Creates a tool that performs deep analysis of Blender scenes.
 * Uses reasoning models to identify patterns, evaluate proportions, and generate insights.
 *
 * This is a backend-only tool that doesn't need client-side confirmation,
 * unlike the executeBlenderCode, reconnectBlender, or getBlenderSceneInfo tools.
 */
export function createDeepSceneAnalysisTool() {
  return tool({
    description:
      "Perform deep, expert-level analysis of the current Blender scene to identify architectural styles, evaluate proportions, discover optimization opportunities, and provide specific improvement recommendations.",
    parameters: DeepSceneAnalysisSchema,
    execute: async ({ scene_info }) => {
      try {
        // Build the prompt for the reasoning model
        const prompt = buildAnalysisPrompt(scene_info);

        // Generate the analysis using the reasoning model
        const { text: response } = await generateText({
          model: providers.languageModel("reasoning"),
          prompt,
        });

        return {
          analysis: response,
          success: true,
        };
      } catch (error) {
        console.error("Error generating scene analysis:", error);
        return {
          analysis: "",
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        };
      }
    },
  });
}

/**
 * Builds a prompt for the reasoning model to analyze a Blender scene
 */
function buildAnalysisPrompt(scene_info: string): string {
  const prompt = `
You are an expert 3D modeling and scene analysis system. Analyze the following Blender scene information and provide a detailed, insightful analysis.

SCENE INFORMATION:
${scene_info}

Provide a comprehensive analysis that includes:

1. SCENE STRUCTURE ANALYSIS
- Identify the hierarchical organization of objects
- Analyze object relationships and groupings
- Evaluate the overall scene organization
- Identify the likely purpose or type of the model (architectural, character, mechanical, etc.)

2. PROPORTIONAL ANALYSIS
- Evaluate key proportions and dimensions
- Compare with standard references for the identified model type
- Highlight any proportion inconsistencies or issues
- Suggest optimal proportions based on design standards

3. STYLE IDENTIFICATION
- Identify architectural, mechanical, or organic design styles present
- Recognize specific sub-categories or influences
- Note stylistic consistency or inconsistencies
- Reference established design paradigms when applicable

4. TECHNICAL EVALUATION
- Identify potential topology issues
- Suggest optimization opportunities
- Evaluate structural integrity and physical plausibility
- Assess material assignments and UV mapping if present

5. IMPROVEMENT RECOMMENDATIONS
- Provide 3-5 specific, actionable improvement suggestions
- Explain the reasoning behind each recommendation
- Prioritize the suggestions based on impact
- Include potential implementation approaches

Your analysis should be detailed yet concise, focusing on the most important insights that would help improve the model. Provide specific measurements, comparisons, and references where possible.

FORMAT YOUR RESPONSE AS:
- Scene Overview: Brief description of what the scene appears to represent
- Structure Analysis: Detailed breakdown of scene organization and hierarchy
- Proportional Analysis: Evaluation of dimensions and relationships
- Style Classification: Identified design patterns and influences
- Technical Assessment: Evaluation of modeling techniques and potential issues
- Improvement Recommendations: Specific, actionable suggestions with reasoning
`;

  return prompt;
}
