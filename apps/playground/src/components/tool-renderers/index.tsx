"use client";

import type { ToolUIPart } from "ai";
import { memo } from "react";
import { NavigateTool } from "./navigate-tool";
import { ScreenshotTool } from "./screenshot-tool";
import { ActionTool } from "./action-tool";
import { ObserveTool } from "./observe-tool";
import { ExtractTool } from "./extract-tool";
import { WaitTool } from "./wait-tool";
import { GenericToolDisplay } from "./generic-tool-display";

interface ToolRendererProps {
  toolPart: ToolUIPart;
  toolName: string;
}

export const ToolRenderer = memo(function ToolRenderer({ toolPart, toolName }: ToolRendererProps) {
  // Map tool names to specific renderers
  switch (toolName) {
    case "stagehandNavigate":
      return <NavigateTool toolPart={toolPart} />;
    
    case "stagehandScreenshot":
      return <ScreenshotTool toolPart={toolPart} />;
    
    case "stagehandAct":
      return <ActionTool toolPart={toolPart} />;
    
    case "stagehandObserve":
      return <ObserveTool toolPart={toolPart} />;
    
    case "stagehandExtract":
      return <ExtractTool toolPart={toolPart} />;
    
    case "stagehandWait":
      return <WaitTool toolPart={toolPart} />;
    
    // Add more specific tool renderers here as needed
    
    default:
      // Fallback to generic display for unknown tools
      return <GenericToolDisplay toolPart={toolPart} toolName={toolName} />;
  }
});