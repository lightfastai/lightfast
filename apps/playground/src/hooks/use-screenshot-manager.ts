"use client";

import { useEffect, useRef } from "react";
import { useScreenshotStore } from "~/stores/screenshot-store";
import type { PlaygroundUIMessage } from "~/types/playground-ui-messages";

interface UseScreenshotManagerOptions {
  messages: PlaygroundUIMessage[];
  threadId: string;
}

/**
 * Hook that manages screenshot detection and storage from chat messages.
 * Centralizes all screenshot-related logic to avoid component coupling.
 */
export function useScreenshotManager({ messages, threadId }: UseScreenshotManagerOptions) {
  const addScreenshot = useScreenshotStore((state) => state.addScreenshot);
  const clearScreenshots = useScreenshotStore((state) => state.clearScreenshots);
  const currentScreenshot = useScreenshotStore((state) => state.getCurrentScreenshot());
  const screenshots = useScreenshotStore((state) => state.screenshots);
  const currentIndex = useScreenshotStore((state) => state.currentIndex);
  
  // Track processed tool results per thread to avoid duplicates
  const processedToolsRef = useRef<Map<string, Set<string>>>(new Map());
  const lastThreadIdRef = useRef<string>(threadId);
  
  // Clear screenshots when thread changes (new chat)
  useEffect(() => {
    if (threadId !== lastThreadIdRef.current) {
      clearScreenshots();
      processedToolsRef.current.clear();
      lastThreadIdRef.current = threadId;
    }
  }, [threadId, clearScreenshots]);
  
  // Process messages for screenshot tool results
  useEffect(() => {
    // Get or create the set for this thread
    if (!processedToolsRef.current.has(threadId)) {
      processedToolsRef.current.set(threadId, new Set());
    }
    const processedTools = processedToolsRef.current.get(threadId)!;
    
    // Process all messages to find screenshot results
    messages.forEach((message) => {
      if (message.role === "assistant") {
        message.parts.forEach((part) => {
          // Check for screenshot tool results - check both possible type formats
          if (part.type === "tool-stagehandScreenshot" || (typeof part.type === "string" && part.type.includes("stagehandScreenshot"))) {
            // Create unique key for this tool result
            const toolKey = `${message.id}-${part.type}-${JSON.stringify(part)}`;
            
            // Skip if already processed
            if (processedTools.has(toolKey)) {
              return;
            }
            
            // Extract screenshot URL from result - check multiple possible structures
            let screenshotUrl: string | undefined;
            let filename: string | undefined;
            
            // Check for result field
            if ("result" in part && part.result) {
              const result = part.result as { screenshot?: string; url?: string; filename?: string };
              screenshotUrl = result.screenshot || result.url;
              filename = result.filename;
            } 
            // Check for output field
            else if ("output" in part && part.output) {
              const output = part.output as { screenshot?: string; url?: string; filename?: string };
              screenshotUrl = output.screenshot || output.url;
              filename = output.filename;
            }
            // Check if the part itself has these fields (for ToolUIPart structure)
            else if ("state" in part && part.state === "output-available" && "output" in part) {
              const output = part.output as { screenshot?: string; url?: string; filename?: string };
              screenshotUrl = output.screenshot || output.url;
              filename = output.filename;
            }
            
            // Add to store if we have a valid URL
            if (screenshotUrl) {
              processedTools.add(toolKey);
              addScreenshot(screenshotUrl, filename);
            }
          }
        });
      }
    });
  }, [messages, threadId, addScreenshot]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clear the processed tools for this thread on unmount
      processedToolsRef.current.delete(threadId);
    };
  }, [threadId]);
  
  return {
    screenshots,
    currentScreenshot,
    currentIndex,
    screenshotCount: screenshots.length,
    hasScreenshots: screenshots.length > 0,
  };
}