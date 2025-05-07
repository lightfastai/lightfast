import { generateObject, tool } from "ai";
import { z } from "zod";

import { modelProviders } from "../providers/models";

export const polyhavenSearchParams = z.object({
  query: z.string().describe("Search term for Poly Haven assets"),
  type: z.enum(["model", "hdri", "texture"]).optional().describe("Asset type"),
  maxResults: z.number().optional().describe("Maximum number of results"),
  categories: z
    .array(z.string())
    .optional()
    .describe("Categories to filter assets by"),
});

export const polyhavenDownloadParams = z.object({
  assetId: z.string().describe("Poly Haven asset ID"),
  type: z.enum(["model", "hdri", "texture"]).describe("Asset type"),
});

export const polyhavenCategoryParams = z.object({
  assetType: z
    .enum(["hdri", "texture", "model", "all"])
    .describe("Asset type: hdri, texture, model, or all"),
});

export type PolyhavenSearchParams = z.infer<typeof polyhavenSearchParams>;
export type PolyhavenDownloadParams = z.infer<typeof polyhavenDownloadParams>;
export type PolyhavenCategoryParams = z.infer<typeof polyhavenCategoryParams>;

export interface PolyhavenResearcher {
  searchAssets: (
    params: PolyhavenSearchParams,
  ) => Promise<{ results: unknown[]; success: true } | { error: string }>;
  downloadAsset: (params: PolyhavenDownloadParams) => Promise<
    | {
        name: string;
        description: string;
        downloads: unknown;
        preview: unknown;
        success: true;
      }
    | { error: string }
  >;
  getCategories: (
    params: PolyhavenCategoryParams,
  ) => Promise<{ categories: unknown } | { error: string }>;
}

export function createPolyhavenResearcher(): PolyhavenResearcher {
  return {
    async searchAssets({ query, type, maxResults = 20, categories }) {
      console.log("[PolyHaven][Search] Input:", {
        query,
        type,
        maxResults,
        categories,
      });
      let url = `https://api.polyhaven.com/assets?`;
      if (type) url += `t=${type}&`;
      if (categories && categories.length > 0) {
        url += `categories=${categories.map(encodeURIComponent).join(",")}&`;
      }
      url += `q=${encodeURIComponent(query)}`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.error(
            "[PolyHaven][Search] Fetch failed:",
            res.status,
            res.statusText,
          );
          return { error: "Failed to fetch Poly Haven assets" };
        }
        const data = await res.json();
        console.log("[PolyHaven][Search] Response:", data);
        return {
          results: data.assets?.slice(0, maxResults) ?? [],
          success: true,
        };
      } catch (e) {
        console.error("[PolyHaven][Search] Exception:", e);
        return { error: (e as Error).message };
      }
    },
    async downloadAsset({ assetId, type }) {
      console.log("[PolyHaven][Download] Input:", { assetId, type });
      const url = `https://api.polyhaven.com/files/${type}s/json/${assetId}.json`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.error(
            "[PolyHaven][Download] Fetch failed:",
            res.status,
            res.statusText,
          );
          return { error: "Failed to fetch asset metadata" };
        }
        const data = await res.json();
        console.log("[PolyHaven][Download] Response:", data);
        return {
          name: data.name,
          description: data.description,
          downloads: data.downloads,
          preview: data.preview,
          success: true,
        };
      } catch (e) {
        console.error("[PolyHaven][Download] Exception:", e);
        return { error: (e as Error).message };
      }
    },
    async getCategories({ assetType }) {
      console.log("[PolyHaven][Categories] Input:", { assetType });
      try {
        const url = `https://api.polyhaven.com/categories/${assetType}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.error(
            "[PolyHaven][Categories] Fetch failed:",
            res.status,
            res.statusText,
          );
          return { error: `API request failed with status code ${res.status}` };
        }
        const categories = await res.json();
        console.log("[PolyHaven][Categories] Response:", categories);
        return { categories };
      } catch (e) {
        console.error("[PolyHaven][Categories] Exception:", e);
        return { error: (e as Error).message };
      }
    },
  };
}

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
      // Use generateObject for structured output if available
      const result = await generateObject({
        model: modelProviders.languageModel("chat-model"),
        schema: polyhavenResearcherOutputSchema,
        prompt: `${polyhavenResearcherPrompt}\nUser request: ${userRequest}`,
      });
      return result;
    },
  });
}
