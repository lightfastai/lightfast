// UI Artifact types and definitions
import { codeArtifact } from './code-artifact';
import { mermaidArtifact } from './mermaid-artifact';
import type { ArtifactKind } from '@db/chat';

export const artifactDefinitions = [
  codeArtifact,
  mermaidArtifact,
];

export type { ArtifactKind };

export interface UIArtifact {
  title: string;
  documentId: string;
  kind: ArtifactKind;
  content: string;
  isVisible: boolean;
  status: 'streaming' | 'idle';
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}