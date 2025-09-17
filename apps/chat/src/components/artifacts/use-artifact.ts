import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { UIArtifact } from './artifact';

export const initialArtifactData: UIArtifact = {
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

export interface UseArtifactResult {
  artifact: UIArtifact;
  setArtifact: Dispatch<SetStateAction<UIArtifact>>;
  metadata: Record<string, unknown>;
  setMetadata: Dispatch<SetStateAction<Record<string, unknown>>>;
  showArtifact: (artifactData: Partial<UIArtifact>) => void;
  hideArtifact: () => void;
}

export function useArtifact(): UseArtifactResult {
  const [artifact, setArtifactState] = useState<UIArtifact>(initialArtifactData);
  const [metadata, setMetadataState] = useState<Record<string, unknown>>({});

  const setArtifact = useCallback(
    (updater: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)) => {
      setArtifactState((current) => {
        if (typeof updater === 'function') {
          return (updater as (currentArtifact: UIArtifact) => UIArtifact)(current);
        }

        return updater;
      });
    },
    [],
  );

  const setMetadata = useCallback(
    (updater: SetStateAction<Record<string, unknown>>) => {
      setMetadataState((current) => {
        if (typeof updater === 'function') {
          return (updater as (value: Record<string, unknown>) => Record<string, unknown>)(
            current,
          );
        }

        return updater;
      });
    },
    [],
  );

  const showArtifact = useCallback(
    (artifactData: Partial<UIArtifact>) => {
      setArtifact((current) => ({
        ...current,
        ...artifactData,
        isVisible: true,
      }));
    },
    [setArtifact],
  );

  const hideArtifact = useCallback(() => {
    setArtifact((current) => ({
      ...current,
      isVisible: false,
      status: 'idle',
    }));
    setMetadata(() => ({}));
  }, [setArtifact, setMetadata]);

  const api: UseArtifactResult = {
    artifact,
    setArtifact,
    metadata,
    setMetadata,
    showArtifact,
    hideArtifact,
  };

  return api;
}
