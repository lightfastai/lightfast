import { useState } from "react";

import { CursorPosition } from "./types";

interface UseSelectionBoxProps {
  onSelect?: (start: CursorPosition, end: CursorPosition, zoom: number) => void;
  exactPosition: CursorPosition;
}

export const useWorkspaceSelectionBox = ({
  onSelect,
  exactPosition,
}: UseSelectionBoxProps) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<CursorPosition>({
    x: 0,
    y: 0,
  });
  const [selectionEnd, setSelectionEnd] = useState<CursorPosition>({
    x: 0,
    y: 0,
  });

  const handleMouseMove = () => {
    if (isSelecting) {
      setSelectionEnd(exactPosition);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsSelecting(true);
      setSelectionStart(exactPosition);
      setSelectionEnd(exactPosition);
    }
  };

  const handleMouseUp = (zoom: number) => {
    if (isSelecting) {
      onSelect?.(selectionStart, selectionEnd, zoom);
      setIsSelecting(false);
    }
  };

  return {
    isSelecting,
    selectionStart,
    selectionEnd,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
  };
};
