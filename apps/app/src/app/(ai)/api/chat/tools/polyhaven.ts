import { tool } from "ai";
import { z } from "zod";

/**
 * Search Poly Haven for 3D assets (models, HDRIs, textures).
 */
export function createSearchPolyHavenTool() {
  return tool({
    description: "Search Poly Haven for 3D assets (models, HDRIs, textures).",
    parameters: z.object({
      query: z.string().describe("Search term for Poly Haven assets"),
      type: z
        .enum(["model", "hdri", "texture"])
        .optional()
        .describe("Asset type"),
      maxResults: z.number().optional().describe("Maximum number of results"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories to filter assets by"),
    }),
    execute: async ({ query, type, maxResults = 20, categories }) => {
      let url = `https://api.polyhaven.com/assets?`;
      if (type) url += `t=${type}&`;
      if (categories && categories.length > 0) {
        url += `categories=${categories.map(encodeURIComponent).join(",")}&`;
      }
      url += `q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) return { error: "Failed to fetch Poly Haven assets" };
      const data = await res.json();
      return {
        results: data.assets?.slice(0, maxResults) ?? [],
        success: true,
      };
    },
  });
}

/**
 * Get download links and metadata for a Poly Haven asset.
 */
export function createDownloadPolyHavenAssetTool() {
  return tool({
    description: "Get download links and metadata for a Poly Haven asset.",
    parameters: z.object({
      assetId: z.string().describe("Poly Haven asset ID"),
      type: z.enum(["model", "hdri", "texture"]).describe("Asset type"),
    }),
    execute: async ({ assetId, type }) => {
      const url = `https://api.polyhaven.com/files/${type}s/json/${assetId}.json`;
      const res = await fetch(url);
      if (!res.ok) return { error: "Failed to fetch asset metadata" };
      const data = await res.json();
      return {
        name: data.name,
        description: data.description,
        downloads: data.downloads,
        preview: data.preview,
        success: true,
      };
    },
  });
}

/**
 * Get categories for a specific asset type from Poly Haven.
 */
export function createGetPolyHavenCategoriesTool() {
  return tool({
    description: "Get categories for a specific asset type from Poly Haven.",
    parameters: z.object({
      assetType: z
        .enum(["hdri", "texture", "model", "all"])
        .describe("Asset type: hdri, texture, model, or all"),
    }),
    execute: async ({ assetType }) => {
      try {
        const url = `https://api.polyhaven.com/categories/${assetType}`;
        const res = await fetch(url);
        if (!res.ok) {
          return { error: `API request failed with status code ${res.status}` };
        }
        const categories = await res.json();
        return { categories };
      } catch (e) {
        return { error: (e as Error).message };
      }
    },
  });
}
