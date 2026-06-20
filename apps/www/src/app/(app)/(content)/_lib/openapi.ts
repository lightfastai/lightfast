import { createOpenAPI } from "fumadocs-openapi/server";

// Minimal public API spec for the resource-oriented /api/v1 surface.
// Keep this aligned with @repo/api-contract until contract-driven generation
// replaces the hand-maintained document.
export const openapi = createOpenAPI({
  input: ["./src/openapi.json"],
});
