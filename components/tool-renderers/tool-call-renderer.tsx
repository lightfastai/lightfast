"use client";

import { memo } from "react";
import { GenericToolDisplay } from "./generic-tool-display";

export interface ToolCallRendererProps {
	toolPart: any; // Tool part from the message
	toolName: string;
}

export const ToolCallRenderer = memo(function ToolCallRenderer({ toolPart, toolName }: ToolCallRendererProps) {
	// Use generic tool display for all tools - no specialized UI
	return <GenericToolDisplay toolPart={toolPart} toolName={toolName} />;
});
