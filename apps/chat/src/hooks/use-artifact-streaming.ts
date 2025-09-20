'use client';

import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useDataStream } from './use-data-stream';
import type { UIArtifact } from '~/components/artifacts/artifact';
import type { ArtifactKind } from '@db/chat';
import { artifactDefinitions } from '~/components/artifacts';

interface UseArtifactStreamingProps {
  showArtifact: (artifactData: Partial<UIArtifact>) => void;
  hideArtifact: () => void;
  updateArtifactContent: (content: string, status: 'streaming' | 'idle') => void;
  setArtifact: Dispatch<SetStateAction<UIArtifact>>;
  setMetadata: Dispatch<SetStateAction<Record<string, unknown>>>;
}

/**
 * Hook that processes streaming data parts and updates artifact state
 * Bridges the gap between streaming data and artifact components
 */
export function useArtifactStreaming({
  showArtifact,
  hideArtifact: _hideArtifact,
  updateArtifactContent,
  setArtifact,
  setMetadata,
}: UseArtifactStreamingProps) {
  const { dataStream } = useDataStream();
  
  // Track how many data parts we've already handled so new ones are
  // processed sequentially (matching the Vercel AI Chatbot flow).
  const lastProcessedIndexRef = useRef(0);

  // Track current streaming artifact state
  const currentArtifactRef = useRef<{
    id?: string;
    title?: string;
    kind?: ArtifactKind;
    content: string;
    isStreaming: boolean;
  }>({
    content: '',
    isStreaming: false,
  });

  useEffect(() => {
    if (!dataStream.length) return;

    const startIndex = lastProcessedIndexRef.current;
    if (startIndex >= dataStream.length) return;

    const newStreamParts = dataStream.slice(startIndex);
    lastProcessedIndexRef.current = dataStream.length;

    newStreamParts.forEach((latestDataPart) => {
      let streamPartForArtifact = latestDataPart;
      let shouldUpdateContent = false;
      let nextStatus: 'streaming' | 'idle' = currentArtifactRef.current.isStreaming ? 'streaming' : 'idle';

      switch (latestDataPart.type) {
        case 'data-kind': {
          currentArtifactRef.current.kind = latestDataPart.data as ArtifactKind;
          break;
        }

        case 'data-id': {
          currentArtifactRef.current.id = latestDataPart.data as string;
          break;
        }

        case 'data-title': {
          currentArtifactRef.current.title = latestDataPart.data as string;
          break;
        }

        case 'data-clear': {
          currentArtifactRef.current = {
            ...currentArtifactRef.current, // Preserve id, title, kind metadata
            content: '',
            isStreaming: true,
          };

          // Show artifact with initial state
          if (currentArtifactRef.current.id && currentArtifactRef.current.title) {
            showArtifact({
              documentId: currentArtifactRef.current.id,
              title: currentArtifactRef.current.title,
              kind: currentArtifactRef.current.kind ?? 'code',
              content: '',
              status: 'streaming',
            });

            const artifactDefinition = artifactDefinitions.find(
              (definition) => definition.kind === currentArtifactRef.current.kind,
            );

            artifactDefinition?.initialize?.({
              documentId: currentArtifactRef.current.id,
              setMetadata,
            });
          }
          break;
        }

        case 'data-codeDelta':
        case 'data-diagramDelta': {
          const incomingContent = latestDataPart.data as string;
          const previousContent = currentArtifactRef.current.content;

          let delta = incomingContent;
          if (incomingContent.startsWith(previousContent)) {
            delta = incomingContent.slice(previousContent.length);
            currentArtifactRef.current.content = previousContent + delta;
          } else {
            currentArtifactRef.current.content = previousContent + incomingContent;
          }

          streamPartForArtifact = {
            ...latestDataPart,
            data: delta,
          } as typeof latestDataPart;
          currentArtifactRef.current.isStreaming = true;
          shouldUpdateContent = true;
          nextStatus = 'streaming';
          break;
        }

        case 'data-finish': {
          currentArtifactRef.current.isStreaming = false;
          shouldUpdateContent = true;
          nextStatus = 'idle';
          break;
        }

        default:
          // Ignore other data types (like data-usage)
          break;
      }

      // IMPORTANT: Call artifact-specific onStreamPart handlers for each data part
      // This is what actually makes artifacts visible when enough content is streamed
      const artifactDefinition = artifactDefinitions.find(
        (def) => def.kind === currentArtifactRef.current.kind,
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: streamPartForArtifact,
          setArtifact,
          setMetadata,
        });
      }

      if (shouldUpdateContent) {
        updateArtifactContent(currentArtifactRef.current.content, nextStatus);
      }
    });
  }, [dataStream, showArtifact, updateArtifactContent, setArtifact, setMetadata]);

  // Reset state when data stream is cleared (new conversation)
  useEffect(() => {
    if (dataStream.length === 0) {
      lastProcessedIndexRef.current = 0;
      currentArtifactRef.current = {
        content: '',
        isStreaming: false,
      };
    }
  }, [dataStream.length]);
}
