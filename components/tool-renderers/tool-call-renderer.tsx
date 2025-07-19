"use client";

import { memo } from "react";
import { GenericToolDisplay } from "./generic-tool-display";
import { UpdateWorkingMemoryTool } from "./update-working-memory-tool";
import { WebSearchTool } from "./web-search-tool";

export interface ToolCallRendererProps {
	toolPart: any; // Tool part from the message
	toolName: string;
}

export const ToolCallRenderer = memo(function ToolCallRenderer({ toolPart, toolName }: ToolCallRendererProps) {
	// Map tool names to their specific renderers
	switch (toolName) {
		case "webSearch":
			return <WebSearchTool toolPart={toolPart} />;
		case "updateWorkingMemory":
			return <UpdateWorkingMemoryTool toolPart={toolPart} />;
		// Add more tool renderers here as tools are added to the system
		// case "fileWrite":
		//     return <FileWriteTool toolPart={toolPart} />;
		// case "fileRead":
		//     return <FileReadTool toolPart={toolPart} />;
		default:
			// Unknown tool - use generic display
			return <GenericToolDisplay toolPart={toolPart} toolName={toolName} />;
	}
});
