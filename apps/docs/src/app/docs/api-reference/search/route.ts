import { apiSource } from "@/src/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

/**
 * API reference search endpoint
 *
 * This route handles search for API reference documentation.
 * Accessible at /api/search.
 */
export const { GET } = createFromSource(apiSource);

