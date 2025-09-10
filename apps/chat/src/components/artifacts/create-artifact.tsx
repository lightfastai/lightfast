import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { UIArtifact } from './artifact';

export interface ArtifactActionContext<M = unknown> {
  content: string;
  handleVersionChange: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
};

interface ArtifactAction<M = unknown> {
  icon: ReactNode;
  label?: string;
  description: string;
  onClick: (context: ArtifactActionContext<M>) => Promise<void> | void;
  isDisabled?: (context: ArtifactActionContext<M>) => boolean;
};

export interface ArtifactToolbarContext {
  sendMessage: (message: { role: string; parts: unknown[] }) => void;
}

export interface ArtifactToolbarItem {
  description: string;
  icon: ReactNode;
  onClick: (context: ArtifactToolbarContext) => void;
};

interface ArtifactContent<M = unknown> {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: 'streaming' | 'idle';
  isInline: boolean;
  getDocumentContentById: (index: number) => string;
  isLoading: boolean;
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
}

interface InitializeParameters<M = unknown> {
  documentId: string;
  setMetadata: Dispatch<SetStateAction<M>>;
}

interface ArtifactConfig<T extends string, M = unknown> {
  kind: T;
  description: string;
  content: React.ComponentType<ArtifactContent<M>>;
  actions: ArtifactAction<M>[];
  toolbar: ArtifactToolbarItem[];
  initialize?: (parameters: InitializeParameters<M>) => void;
  onStreamPart: (args: {
    setMetadata: Dispatch<SetStateAction<M>>;
    setArtifact: Dispatch<SetStateAction<UIArtifact>>;
    streamPart: unknown; // DataUIPart type from AI SDK
  }) => void;
};

export class Artifact<T extends string, M = unknown> {
  readonly kind: T;
  readonly description: string;
  readonly content: React.ComponentType<ArtifactContent<M>>;
  readonly actions: ArtifactAction<M>[];
  readonly toolbar: ArtifactToolbarItem[];
  readonly initialize?: (parameters: InitializeParameters<M>) => void;
  readonly onStreamPart: (args: {
    setMetadata: Dispatch<SetStateAction<M>>;
    setArtifact: Dispatch<SetStateAction<UIArtifact>>;
    streamPart: unknown;
  }) => void;

  constructor(config: ArtifactConfig<T, M>) {
    this.kind = config.kind;
    this.description = config.description;
    this.content = config.content;
    this.actions = config.actions;
    this.toolbar = config.toolbar;
    this.initialize = config.initialize;
    this.onStreamPart = config.onStreamPart;
  }
}