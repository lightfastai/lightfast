import { createOpenAPI } from "fumadocs-openapi/server";

// Placeholder spec — the app-api-contract package was removed in the v2
// barebones reset. Endpoint docs will be regenerated post-v2 once the new
// API contract lands. The empty `paths` object means no virtual pages
// are generated; manual MDX pages under content/api/ are unaffected.
export const openapi = createOpenAPI({
  input: ["./src/openapi.empty.json"],
});
