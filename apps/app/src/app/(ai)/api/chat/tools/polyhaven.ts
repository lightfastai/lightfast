import { tool } from "ai";
import { z } from "zod";

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

export function createPolyhavenSearchTool() {
  return tool({
    description: "Search Poly Haven for 3D assets, HDRIs, or textures.",
    parameters: polyhavenSearchParams,
    async execute({ query, type, maxResults = 20, categories }) {
      let url = `https://api.polyhaven.com/assets?`;
      if (type) url += `t=${type}&`;
      if (categories && categories.length > 0) {
        url += `categories=${categories.map(encodeURIComponent).join(",")}&`;
      }
      url += `q=${encodeURIComponent(query)}`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          return { error: "Failed to fetch Poly Haven assets" };
        }
        const data = await res.json();
        return {
          results: data.assets?.slice(0, maxResults) ?? [],
          success: true,
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    },
  });
}

export function createPolyhavenDownloadTool() {
  return tool({
    description: "Download metadata and links for a Poly Haven asset.",
    parameters: polyhavenDownloadParams,
    async execute({ assetId, type }) {
      const url = `https://api.polyhaven.com/files/${type}s/json/${assetId}.json`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          return { error: "Failed to fetch asset metadata" };
        }
        const data = await res.json();
        return {
          name: data.name,
          description: data.description,
          downloads: data.downloads,
          preview: data.preview,
          success: true,
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    },
  });
}

export function createPolyhavenCategoryTool() {
  return tool({
    description: "Get available categories for Poly Haven assets.",
    parameters: polyhavenCategoryParams,
    async execute({ assetType }) {
      const url = `https://api.polyhaven.com/categories/${assetType}`;
      try {
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
