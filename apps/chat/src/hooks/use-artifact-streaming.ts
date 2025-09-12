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
  hideArtifact,
  updateArtifactContent,
  setArtifact,
  setMetadata,
}: UseArtifactStreamingProps) {
  const { dataStream } = useDataStream();
  
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

    // Process only the latest data part
    const latestDataPart = dataStream[dataStream.length - 1];
    if (!latestDataPart) return;
    
    switch (latestDataPart.type) {
      case 'data-kind': {
        console.log('[Artifact] Setting kind:', latestDataPart.data);
        currentArtifactRef.current.kind = latestDataPart.data as ArtifactKind;
        break;
      }
      
      case 'data-id': {
        console.log('[Artifact] Setting document ID:', latestDataPart.data);
        currentArtifactRef.current.id = latestDataPart.data as string;
        break;
      }
      
      case 'data-title': {
        console.log('[Artifact] Setting title:', latestDataPart.data);
        currentArtifactRef.current.title = latestDataPart.data as string;
        break;
      }
      
      case 'data-clear': {
        console.log('[Artifact] Clearing artifact');
        currentArtifactRef.current = {
          ...currentArtifactRef.current, // Preserve id, title, kind metadata
          content: '',
          isStreaming: true,
        };
        
        // Show artifact with initial state
        if (currentArtifactRef.current.id && currentArtifactRef.current.title) {
          console.log('[Artifact] Showing artifact:', {
            documentId: currentArtifactRef.current.id,
            title: currentArtifactRef.current.title,
            kind: currentArtifactRef.current.kind,
          });
          showArtifact({
            documentId: currentArtifactRef.current.id,
            title: currentArtifactRef.current.title,
            kind: currentArtifactRef.current.kind ?? 'code',
            content: '',
            status: 'streaming',
          });
        } else {
          console.log('[Artifact] Cannot show artifact - missing metadata:', {
            id: currentArtifactRef.current.id,
            title: currentArtifactRef.current.title,
            kind: currentArtifactRef.current.kind,
          });
        }
        break;
      }
      
      case 'data-codeDelta': 
      case 'data-diagramDelta': {
        console.log('[Artifact] Adding code/diagram delta:', latestDataPart.data);
        const delta = latestDataPart.data as string;
        currentArtifactRef.current.content += delta;
        currentArtifactRef.current.isStreaming = true;
        
        // Update content with streaming status
        updateArtifactContent(currentArtifactRef.current.content, 'streaming');
        break;
      }
      
      case 'data-finish': {
        console.log('[Artifact] Streaming finished');
        currentArtifactRef.current.isStreaming = false;
        
        // Mark streaming as complete
        setArtifact(prev => ({
          ...prev,
          status: 'idle',
        }));
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
        streamPart: latestDataPart,
        setArtifact,
        setMetadata: setMetadata as Dispatch<SetStateAction<any>>,
      });
    }
  }, [dataStream, showArtifact, hideArtifact, updateArtifactContent, setArtifact, setMetadata]);

  // Reset state when data stream is cleared (new conversation)
  useEffect(() => {
    if (dataStream.length === 0) {
      currentArtifactRef.current = {
        content: '',
        isStreaming: false,
      };
    }
  }, [dataStream.length]);
}