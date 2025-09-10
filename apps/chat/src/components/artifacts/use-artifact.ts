import { useState, useCallback } from 'react';
import type { UIArtifact } from './artifact';

const initialArtifactState: UIArtifact = {
  title: '',
  documentId: 'init',
  kind: 'code',
  content: '',
  isVisible: false,
  status: 'idle',
  boundingBox: {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  },
};

export function useArtifact() {
  const [artifact, setArtifact] = useState<UIArtifact>(initialArtifactState);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
  const [metadata, setMetadata] = useState<any>({});

  const showArtifact = useCallback((artifactData: Partial<UIArtifact>) => {
    setArtifact(prev => ({
      ...prev,
      ...artifactData,
      isVisible: true,
    }));
  }, []);

  const hideArtifact = useCallback(() => {
    setArtifact(prev => ({
      ...prev,
      isVisible: false,
    }));
  }, []);

  const updateArtifactContent = useCallback((content: string, status: 'streaming' | 'idle' = 'idle') => {
    setArtifact(prev => ({
      ...prev,
      content,
      status,
    }));
  }, []);

  return {
    artifact,
    setArtifact,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    metadata,
    setMetadata,
    showArtifact,
    hideArtifact,
    updateArtifactContent,
  };
}