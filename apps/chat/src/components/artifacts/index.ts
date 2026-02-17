// Artifact system exports - following Vercel's architecture
export { useArtifact } from './use-artifact';
export { ArtifactViewer } from './artifact-viewer';
export { CodeEditor } from './code-editor';
export { codeArtifact } from './code-artifact';
export { Artifact } from './create-artifact';
export { artifactDefinitions, type UIArtifact } from './artifact';
export type { ArtifactActionContext, ArtifactToolbarContext } from './create-artifact';
export { CopyIcon, PlayIcon, RedoIcon, UndoIcon, MessageIcon, LogsIcon } from './icons';
export type { ArtifactData, ArtifactState, ArtifactViewerProps, CodeArtifactProps, ArtifactApiResponse } from './types';

