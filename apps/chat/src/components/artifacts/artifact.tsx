// UI Artifact types and definitions
import { codeArtifact } from './code-artifact';
import { diagramArtifact } from './diagram-artifact';
import type { ArtifactKind } from '@db/chat';

export const artifactDefinitions = [
  codeArtifact,
  diagramArtifact,
];

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