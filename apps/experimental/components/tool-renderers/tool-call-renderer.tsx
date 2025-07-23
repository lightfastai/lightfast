"use client";

import type { ToolUIPart } from "ai";
import { memo } from "react";
import { GenericToolDisplay } from "./generic-tool-display";

export interface ToolCallRendererProps {
	toolPart: ToolUIPart;
	toolName: string;
}

export const ToolCallRenderer = memo(function ToolCallRenderer({ toolPart, toolName }: ToolCallRendererProps) {
	// Use generic tool display for all tools - no specialized UI
	return <GenericToolDisplay toolPart={toolPart} toolName={toolName} />;
});
