/**
 * Artifact types and interfaces for the chat artifact system
 * Based on Vercel AI Chatbot's implementation
 */

export type ArtifactKind = "code";

export interface ArtifactData {
  id: string;
  title: string;
  content: string;
  kind: ArtifactKind;
  sessionId: string;
  clerkUserId: string;
  createdAt: string;
}

export interface ArtifactState {
  isVisible: boolean;
  currentArtifact: ArtifactData | null;
  streamingContent: string;
  status: "streaming" | "complete" | "idle";
}

export interface ArtifactViewerProps {
  artifact: ArtifactData;
  isStreaming: boolean;
  streamingContent?: string;
  onClose: () => void;
  onContentChange?: (content: string) => void;
}

export interface CodeArtifactProps {
  title: string;
  content: string;
  language?: string;
  isStreaming?: boolean;
  streamingContent?: string;
  onContentChange?: (content: string) => void;
}