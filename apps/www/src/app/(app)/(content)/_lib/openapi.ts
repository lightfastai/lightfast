import { createOpenAPI } from "fumadocs-openapi/server";

export const openapi = createOpenAPI({
  input: ["../../packages/app-api-contract/openapi.json"],
});
