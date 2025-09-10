'use client';

import { useEffect, useRef } from 'react';
import { useDataStream } from './use-data-stream';
import type { UIArtifact } from '~/components/artifacts/artifact';

interface UseArtifactStreamingProps {
  showArtifact: (artifactData: Partial<UIArtifact>) => void;
  hideArtifact: () => void;
  updateArtifactContent: (content: string, status: 'streaming' | 'idle') => void;
  setArtifact: (updater: (prev: UIArtifact) => UIArtifact) => void;
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
}: UseArtifactStreamingProps) {
  const { dataStream } = useDataStream();
  
  // Track current streaming artifact state
  const currentArtifactRef = useRef<{
    id?: string;
    title?: string;
    kind?: string;
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
        currentArtifactRef.current.kind = latestDataPart.data;
        break;
      }
      
      case 'data-id': {
        console.log('[Artifact] Setting document ID:', latestDataPart.data);
        currentArtifactRef.current.id = latestDataPart.data;
        break;
      }
      
      case 'data-title': {
        console.log('[Artifact] Setting title:', latestDataPart.data);
        currentArtifactRef.current.title = latestDataPart.data;
        break;
      }
      
      case 'data-clear': {
        console.log('[Artifact] Clearing artifact');
        currentArtifactRef.current = {
          content: '',
          isStreaming: true,
        };
        
        // Show artifact with initial state
        if (currentArtifactRef.current.id && currentArtifactRef.current.title) {
          showArtifact({
            documentId: currentArtifactRef.current.id,
            title: currentArtifactRef.current.title,
            kind: (currentArtifactRef.current.kind as any) || 'code',
            content: '',
            status: 'streaming',
          });
        }
        break;
      }
      
      case 'data-codeDelta': {
        console.log('[Artifact] Adding code delta:', latestDataPart.data);
        const delta = latestDataPart.data;
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
  }, [dataStream, showArtifact, hideArtifact, updateArtifactContent, setArtifact]);

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