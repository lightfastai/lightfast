"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";

/**
 * Defines the structure of data stream deltas from the Blender analysis tool.
 */
export type BlenderAnalysisStreamDelta =
  | { type: "id"; content: string }
  | { type: "blender_analysis_started"; message: string }
  | { type: "blender_analysis_chunk"; content: string }
  | { type: "blender_analysis_completed"; fullAnalysisBrief: string }
  | { type: "blender_analysis_error"; error: string };

/**
 * Represents the state of the Blender analysis stream.
 */
export interface BlenderAnalysisState {
  id: string | null;
  status: "idle" | "started" | "streaming" | "completed" | "error";
  currentContent: string; // Accumulates 'blender_analysis_chunk'
  analysisBrief: string | null; // From 'blender_analysis_completed'
  errorMessage: string | null; // From 'blender_analysis_error'
  startMessage: string | null; // From 'blender_analysis_started'
}

const initialBlenderAnalysisState: BlenderAnalysisState = {
  id: null,
  status: "idle",
  currentContent: "",
  analysisBrief: null,
  errorMessage: null,
  startMessage: null,
};

/**
 * A custom hook to process and manage the state of a Blender analysis data stream.
 * It listens to chat data for a given session ID and updates the analysis state
 * based on specific delta types from the `createAnalyzeBlenderModelTool`.
 *
 * @param sessionId The ID of the chat session to monitor for Blender analysis data.
 * @returns The current state of the Blender analysis.
 */
export function useBlenderAnalysisStream(
  sessionId: string | undefined,
): BlenderAnalysisState {
  const { data: dataStream } = useChat({
    id: sessionId,
  });
  const [analysisState, setAnalysisState] = useState<BlenderAnalysisState>(
    initialBlenderAnalysisState,
  );
  const lastProcessedIndex = useRef(-1);

  useEffect(() => {
    // Reset state if sessionId is not provided (e.g., chat not active or ended)
    if (!sessionId) {
      setAnalysisState(initialBlenderAnalysisState);
      lastProcessedIndex.current = -1;
      return;
    }

    // If dataStream is null (no data yet) or empty, there's nothing to process.
    if (!dataStream || dataStream.length === 0) {
      // If the stream becomes empty after having data, it might mean messages were cleared.
      // The lastProcessedIndex logic handles not re-processing,
      // and new sessionId resets state via the other useEffect.
      return;
    }

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);

    if (newDeltas.length > 0) {
      lastProcessedIndex.current = dataStream.length - 1;

      setAnalysisState((currentState) => {
        let updatedState = { ...currentState };

        (newDeltas as BlenderAnalysisStreamDelta[]).forEach(
          (delta: BlenderAnalysisStreamDelta) => {
            if (!delta || typeof delta.type === "undefined") {
              console.warn("Received undefined or malformed delta:", delta);
              return;
            }
            switch (delta.type) {
              case "id":
                updatedState.id = delta.content;
                break;
              case "blender_analysis_started":
                // Reset relevant fields for a new analysis, preserving ID if already set
                updatedState = {
                  ...initialBlenderAnalysisState,
                  id: updatedState.id || null, // Preserve existing ID
                  status: "started",
                  startMessage: delta.message,
                };
                break;
              case "blender_analysis_chunk":
                updatedState.currentContent += delta.content;
                updatedState.status = "streaming";
                break;
              case "blender_analysis_completed":
                updatedState.status = "completed";
                updatedState.analysisBrief = delta.fullAnalysisBrief;
                break;
              case "blender_analysis_error":
                updatedState.status = "error";
                updatedState.errorMessage = delta.error;
                break;
              default:
                // Ensures all delta types are handled if BlenderAnalysisStreamDelta is exhaustive
                const exhaustiveCheck: never = delta;
                console.warn(
                  "Unhandled delta type in Blender analysis stream:",
                  exhaustiveCheck,
                );
                break;
            }
          },
        );
        return updatedState;
      });
    }
  }, [dataStream, sessionId]);

  // Effect to reset state when the sessionId changes, indicating a new/different chat.
  useEffect(() => {
    if (sessionId) {
      setAnalysisState(initialBlenderAnalysisState);
      lastProcessedIndex.current = -1;
    }
    // Also reset if sessionId becomes undefined (e.g., navigating away from a chat)
    if (sessionId === undefined) {
      setAnalysisState(initialBlenderAnalysisState);
      lastProcessedIndex.current = -1;
    }
  }, [sessionId]);

  return analysisState;
}
