'use client';

import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useDataStream } from './use-data-stream';
import type { UIArtifact } from '~/components/artifacts/artifact';
import { artifactDefinitions } from '~/components/artifacts';

interface UseArtifactStreamingProps {
  artifact: UIArtifact;
  setArtifact: Dispatch<SetStateAction<UIArtifact>>;
  setMetadata: Dispatch<SetStateAction<Record<string, unknown>>>;
}

export function useArtifactStreaming({
  artifact,
  setArtifact,
  setMetadata,
}: UseArtifactStreamingProps) {
  const { dataStream } = useDataStream();
  const lastProcessedIndex = useRef(-1);

  useEffect(() => {
    if (!dataStream.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    let currentKind = artifact.kind;

    newDeltas.forEach((delta) => {
      if (delta.type === 'data-clear') {
        setMetadata(() => ({}));
      }

      if (delta.type === 'data-kind' && typeof delta.data === 'string') {
        currentKind = delta.data as UIArtifact['kind'];
      }

      const artifactDefinition = artifactDefinitions.find(
        (definition) => definition.kind === currentKind,
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      setArtifact((currentArtifact) => {
        const draftArtifact = currentArtifact;

        switch (delta.type) {
          case 'data-id':
            return {
              ...draftArtifact,
              documentId: delta.data as string,
              status: 'streaming',
            };
          case 'data-title':
            return {
              ...draftArtifact,
              title: delta.data as string,
              status: 'streaming',
            };
          case 'data-kind':
            return {
              ...draftArtifact,
              kind: delta.data as UIArtifact['kind'],
              status: 'streaming',
            };
          case 'data-clear':
            return {
              ...draftArtifact,
              content: '',
              status: 'streaming',
            };
          case 'data-finish':
            return {
              ...draftArtifact,
              status: 'idle',
            };
          default:
            return draftArtifact;
        }
      });
    });
  }, [artifact, dataStream, setArtifact, setMetadata]);

  useEffect(() => {
    if (dataStream.length === 0) {
      lastProcessedIndex.current = -1;
    }
  }, [dataStream.length]);
}
