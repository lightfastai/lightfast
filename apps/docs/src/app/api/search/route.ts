import { source } from "@/src/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

/**
 * Fumadocs search API endpoint
 * 
 * Note: This app uses basePath: "/docs" in next.config.ts, so this route is 
 * actually accessible at /docs/api/search, not /api/search.
 * 
 * The search provider in providers.tsx must be configured with the full path:
 * api: "/docs/api/search"
 */
export const { GET } = createFromSource(source);

