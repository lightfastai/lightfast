import { generateText, tool } from "ai";
import { z } from "zod";

import { providers } from "../providers/models";

// Schema for the tool parameters
const GenerateBlenderCodeSchema = z.object({
  task: z
    .string()
    .describe("Description of what the Blender code should accomplish"),
  scene_info: z
    .string()
    .optional()
    .describe(
      "JSON string containing information about the current Blender scene",
    ),
  additional_context: z
    .string()
    .optional()
    .describe("Any additional context that might help generate better code"),
});

/**
 * Creates a tool that generates Blender Python code based on a task description.
 * This is an internal server-side tool that uses the reasoning model to generate code
 * which can then be executed by the executeBlenderCodeTool on the client.
 */
export function createGenerateBlenderCodeTool() {
  return tool({
    description:
      "Generate Python code for Blender based on a task description.",
    parameters: GenerateBlenderCodeSchema,
    execute: async ({ task, scene_info = "", additional_context = "" }) => {
      try {
        // Build the prompt for the reasoning model
        const prompt = buildPrompt(task, scene_info, additional_context);

        // Generate the code using the reasoning model
        const { text: response } = await generateText({
          model: providers.languageModel("reasoning"),
          prompt,
        });

        // Process the response to extract clean Python code
        const processedCode = extractPythonCode(response);

        return {
          code: processedCode,
          success: true,
        };
      } catch (error) {
        console.error("Error generating Blender code:", error);
        return {
          code: "",
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        };
      }
    },
  });
}

/**
 * Builds a prompt for the reasoning model to generate Blender code
 */
function buildPrompt(
  task: string,
  scene_info: string,
  additional_context: string,
): string {
  let prompt = `
Generate clean, well-structured Python code for Blender that accomplishes the following task:

TASK: ${task}

Your code should:
1. Include proper error handling with try/except blocks
2. Follow Blender Python best practices
3. Include helpful comments for complex operations
4. Be organized in a logical way
5. Be directly executable in Blender via the Python API

IMPORTANT EXECUTION CONTEXT:
- The code will be executed directly through Blender's exec() function, not as a standalone script
- DO NOT use "if __name__ == '__main__':" guards as they will prevent execution
- Instead, either:
  * Call your main function directly at the end of the script, or
  * Wrap your main call in "if True:" to ensure it always executes
- Include all necessary imports at the top of the file
- Make all functions fully self-contained
- Include print statements to report execution progress and results

The code should be optimized for direct execution and should prioritize:
- Safe collection handling (checking if collections exist before using them)
- Error reporting through print statements
- Defensive coding to handle edge cases
- Cleanup of resources if operations fail partially
`;

  if (scene_info) {
    prompt += `\nCURRENT SCENE INFORMATION:\n${scene_info}\n`;
  }

  if (additional_context) {
    prompt += `\nADDITIONAL CONTEXT:\n${additional_context}\n`;
  }

  prompt += `\nProvide ONLY the Python code without any additional explanation or markdown formatting. The code should start with imports and be ready to execute directly. Remember to call your main function directly at the end of the script without using if __name__ == "__main__" guards.`;

  return prompt;
}

/**
 * Extracts clean Python code from the model response
 * Removes any markdown formatting or explanatory text
 */
function extractPythonCode(response: string): string {
  // Handle cases where the response might be wrapped in markdown code blocks
  const codeBlockMatch = /```(?:python)?\s*([\s\S]*?)\s*```/.exec(response);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  // If no code blocks found, return the raw response (assuming it's clean code)
  return response.trim();
}
