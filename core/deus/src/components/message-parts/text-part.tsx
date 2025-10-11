/**
 * Text Part Renderer for Ink.js
 * Renders text message parts with optional streaming animation
 */

import * as React from 'react';
import { Box, Text } from 'ink';

const { useState, useEffect } = React;

export interface TextPartProps {
  text: string;
  isStreaming?: boolean;
  color?: string;
}

/**
 * TextPart Component
 * Displays text content with optional streaming animation
 */
export function TextPart({ text, isStreaming = false, color }: TextPartProps) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Streaming animation effect
  useEffect(() => {
    if (!isStreaming) {
      setDisplayText(text);
      return;
    }

    // Animate text appearance
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, 10); // 10ms per character for smooth animation

      return () => clearTimeout(timeout);
    }
  }, [text, isStreaming, currentIndex]);

  // Reset animation when text changes
  useEffect(() => {
    if (isStreaming) {
      setCurrentIndex(0);
      setDisplayText('');
    }
  }, [text, isStreaming]);

  return (
    <Box flexDirection="column">
      <Text color={color}>{isStreaming ? displayText : text}</Text>
    </Box>
  );
}
