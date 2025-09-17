import { webSearchTool } from "~/ai/tools/web-search";
import { createDocumentTool } from "~/ai/tools/create-document";

// Complete tools object for c010 agent including artifact tools
export const c010Tools = {
	webSearch: webSearchTool,
	createDocument: createDocumentTool,
};