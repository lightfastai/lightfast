import { tool } from "ai";
import { z } from "zod";

/**
 * Search AmbientCG for free PBR textures.
 */
export function createSearchAmbientCGTool() {
  return tool({
    description: "Search AmbientCG for free PBR textures.",
    parameters: z.object({
      query: z.string().describe("Search term for textures (e.g. 'marble')"),
      maxResults: z.number().optional().describe("Maximum number of results"),
    }),
    execute: async ({ query, maxResults = 5 }) => {
      const url = `https://ambientcg.com/api/v2/assets?type=Texture&query=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) return { error: "Failed to fetch AmbientCG textures" };
      const data = await res.json();
      return {
        results: data.assets?.slice(0, maxResults) ?? [],
        success: true,
      };
    },
  });
}

/**
 * Get download links and metadata for an AmbientCG texture.
 */
export function createDownloadAmbientCGTextureTool() {
  return tool({
    description: "Get download links and metadata for an AmbientCG texture.",
    parameters: z.object({
      assetId: z.string().describe("AmbientCG asset ID"),
    }),
    execute: async ({ assetId }) => {
      const url = `https://ambientcg.com/api/v2/full_json?id=${encodeURIComponent(assetId)}`;
      const res = await fetch(url);
      if (!res.ok) return { error: "Failed to fetch texture metadata" };
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
