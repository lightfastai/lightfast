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
    }),
    execute: async ({ query, type, maxResults = 5 }) => {
      const url = `https://api.polyhaven.com/assets?${type ? `t=${type}&` : ""}q=${encodeURIComponent(query)}`;
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
