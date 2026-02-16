import { createOpenAPI } from "fumadocs-openapi/server";

export const openapi = createOpenAPI({
	input: ["../../packages/console-openapi/openapi.json"],
});