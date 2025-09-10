'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWindowSize } from 'usehooks-ts';
import { artifactDefinitions, type UIArtifact } from './artifact';
import { Button } from '@repo/ui/components/ui/button';

interface ArtifactViewerProps {
  artifact: UIArtifact;
  metadata: any;
  setMetadata: (metadata: any) => void;
  onClose: () => void;
  onSaveContent?: (content: string, debounce: boolean) => void;
}

export function ArtifactViewer({ 
  artifact, 
  metadata, 
  setMetadata, 
  onClose, 
  onSaveContent 
}: ArtifactViewerProps) {
  const [mode, setMode] = useState<'edit' | 'diff'>('edit');
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 768 : false;

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  if (!artifactDefinition) {
    return null;
  }

  const handleVersionChange = (type: 'next' | 'prev' | 'toggle' | 'latest') => {
    if (type === 'latest') {
      setCurrentVersionIndex(0);
      setMode('edit');
    }
    if (type === 'toggle') {
      setMode((mode) => (mode === 'edit' ? 'diff' : 'edit'));
    }
    // For now, we only have one version
  };

  const handleSaveContent = (updatedContent: string, debounce: boolean) => {
    if (onSaveContent) {
      onSaveContent(updatedContent, debounce);
    }
  };

  const isCurrentVersion = true; // For now, always current version

  return (
    <AnimatePresence>
      <motion.div
        data-testid="artifact-viewer"
        className="fixed top-0 left-0 z-50 flex h-dvh w-dvw flex-row bg-transparent"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { delay: 0.4 } }}
      >
        {/* Desktop background overlay */}
        {!isMobile && (
          <motion.div
            className="fixed h-dvh bg-background"
            initial={{
              width: windowWidth,
              right: 0,
            }}
            animate={{ width: windowWidth, right: 0 }}
            exit={{
              width: windowWidth,
              right: 0,
            }}
          />
        )}

        {/* Artifact content panel */}
        <motion.div
          className="fixed flex h-dvh flex-col overflow-y-scroll border-zinc-200 bg-background md:border-l dark:border-zinc-700 dark:bg-muted"
          initial={
            isMobile
              ? {
                  opacity: 1,
                  x: artifact.boundingBox.left,
                  y: artifact.boundingBox.top,
                  height: artifact.boundingBox.height,
                  width: artifact.boundingBox.width,
                  borderRadius: 50,
                }
              : {
                  opacity: 1,
                  x: artifact.boundingBox.left,
                  y: artifact.boundingBox.top,
                  height: artifact.boundingBox.height,
                  width: artifact.boundingBox.width,
                  borderRadius: 50,
                }
          }
          animate={
            isMobile
              ? {
                  opacity: 1,
                  x: 0,
                  y: 0,
                  height: windowHeight,
                  width: windowWidth ? windowWidth : 'calc(100dvw)',
                  borderRadius: 0,
                  transition: {
                    delay: 0,
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                    duration: 0.8,
                  },
                }
              : {
                  opacity: 1,
                  x: 0, // Full width for now - will add chat panel later
                  y: 0,
                  height: windowHeight,
                  width: windowWidth ? windowWidth : 'calc(100dvw)',
                  borderRadius: 0,
                  transition: {
                    delay: 0,
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                    duration: 0.8,
                  },
                }
          }
          exit={{
            opacity: 0,
            scale: 0.5,
            transition: {
              delay: 0.1,
              type: 'spring',
              stiffness: 600,
              damping: 30,
            },
          }}
        >
          {/* Header */}
          <div className="flex flex-row items-center justify-between p-4 border-b">
            <div className="flex flex-col">
              <div className="font-medium text-lg">{artifact.title}</div>
              <div className="text-muted-foreground text-sm">
                Code Artifact
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Artifact actions */}
              {artifactDefinition.actions.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={() => action.onClick({
                    content: artifact.content,
                    handleVersionChange,
                    currentVersionIndex,
                    isCurrentVersion,
                    mode,
                    metadata,
                    setMetadata,
                  })}
                  disabled={action.isDisabled?.({
                    content: artifact.content,
                    handleVersionChange,
                    currentVersionIndex,
                    isCurrentVersion,
                    mode,
                    metadata,
                    setMetadata,
                  })}
                  title={action.description}
                >
                  {action.icon}
                </Button>
              ))}
              
              {/* Close button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                title="Close artifact"
              >
                <X size={18} />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden bg-background dark:bg-muted">
            <artifactDefinition.content
              title={artifact.title}
              content={artifact.content}
              mode={mode}
              status={artifact.status}
              currentVersionIndex={currentVersionIndex}
              onSaveContent={handleSaveContent}
              isInline={false}
              isCurrentVersion={isCurrentVersion}
              getDocumentContentById={() => artifact.content}
              isLoading={false}
              metadata={metadata}
              setMetadata={setMetadata}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}