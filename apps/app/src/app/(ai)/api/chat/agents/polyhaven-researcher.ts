import { generateText, tool } from "ai";
import { z } from "zod";

import { modelProviders } from "../providers/models";
import {
  createPolyhavenCategoryTool,
  createPolyhavenDownloadTool,
  createPolyhavenSearchTool,
} from "../tools/polyhaven";

export const polyhavenResearcherPrompt = `
You are a Polyhaven Asset Researcher assistant.

Your job is to help users find the most relevant 3D assets (textures, HDRIs, or models) from Poly Haven. When a user asks to find an asset, follow these steps:

1. Intent Understanding: Carefully analyze the user's request to determine what type of asset they are looking for (texture, HDRI, or model) and any specific details or context they provide (e.g., "wood texture", "outdoor HDRI", "car model").

2. Category Suggestion: Use the Poly Haven categories API to fetch all available categories for the relevant asset type. Select the category (or categories) that best match the user's request. If the user's request is ambiguous, ask clarifying questions to help narrow down the category.

3. Reasoning: For each suggested category, provide a brief explanation of why it is relevant to the user's request.

4. Asset Search: Once the category is confirmed (either by the user or by clear intent), search for assets in that category using the Poly Haven search API. Return a concise list of the most relevant assets, including their names, previews, and download links.

5. Structured Output: Always return your results in a structured format with the following fields:
   - intent: The interpreted asset type and topic
   - suggestedCategory: The best-matching Poly Haven category (or categories)
   - reasoning: Explanation for the category choice
   - assets: Array of relevant asset results (name, preview, download link)
   - clarificationNeeded: Boolean indicating if you need more info from the user

If the user's request is unclear or could match multiple categories, set clarificationNeeded to true and ask a clarifying question before proceeding to search.

Be concise, helpful, and always explain your reasoning for category selection.

Example output:
{
  "intent": "Find a wood texture",
  "suggestedCategory": "Wood",
  "reasoning": "The user asked for a wood texture, so the 'Wood' category is the most relevant.",
  "assets": [
    { "name": "Wood Planks 01", "preview": "...", "download": "..." }
  ],
  "clarificationNeeded": false
}
`;

export const polyhavenResearcherOutputSchema = z.object({
  intent: z.string(),
  suggestedCategory: z.union([z.string(), z.array(z.string())]),
  reasoning: z.string(),
  assets: z.array(
    z.object({
      name: z.string(),
      preview: z.string().optional(),
      download: z.string().optional(),
    }),
  ),
  clarificationNeeded: z.boolean(),
});

export function createPolyhavenResearcherTool() {
  return tool({
    description:
      "Research Poly Haven for the best asset category, explain reasoning, and return relevant assets in a structured format.",
    parameters: z.object({
      userRequest: z
        .string()
        .describe("The user's request or query for a Poly Haven asset"),
    }),
    async execute({ userRequest }) {
      const searchTool = createPolyhavenSearchTool();
      const downloadTool = createPolyhavenDownloadTool();
      const categoryTool = createPolyhavenCategoryTool();

      const result = await generateText({
        model: modelProviders.languageModel("chat-model"),
        system: polyhavenResearcherPrompt,
        prompt: `User request: ${userRequest}`,
        tools: {
          searchAssets: searchTool,
          downloadAsset: downloadTool,
          getCategories: categoryTool,
        },
      });
      return result;
    },
  });
}
