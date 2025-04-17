import { useCallback, useMemo, useRef, useState } from "react";

import type { Edge, EdgePosition, NodePosition } from "../types";
import { useDragOperation } from "../hooks/use-drag-operation";

export function useNodeState() {
  const [nodePositions, setNodePositions] = useState<NodePosition[]>([
    { x: 0, y: 0 }, // Top-left
    { x: 250, y: 0 }, // Top-right
    { x: 0, y: 250 }, // Bottom-left
    { x: 250, y: 250 }, // Bottom-right
  ]);
  const [hoveredNodeIndex, setHoveredNodeIndex] = useState<number | null>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const containerRef = useRef<HTMLDivElement>(null);

  const edges = useMemo<Edge[]>(
    () => [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 0, to: 3 },
      { from: 2, to: 3 },
    ],
    [],
  );

  const handlePositionChange = useCallback(
    (index: number, position: NodePosition) => {
      setNodePositions((prev) => {
        const newPositions = [...prev];
        newPositions[index] = position;
        return newPositions;
      });
    },
    [],
  );

  const { draggedNodeRef, handleDragStart, handleDrag, handleDragEnd } =
    useDragOperation({
      containerRef,
      onPositionChange: handlePositionChange,
    });

  const calculateEdgePositions = useCallback((): EdgePosition[] => {
    if (!containerRef.current) return [];

    return edges
      .map((edge) => {
        const fromNode = nodeRefs.current[edge.from];
        const toNode = nodeRefs.current[edge.to];

        if (!fromNode || !toNode || !containerRef.current) return null;

        const fromRect = fromNode.getBoundingClientRect();
        const toRect = toNode.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        const fromX = fromRect.left + fromRect.width / 2 - containerRect.left;
        const fromY = fromRect.top + fromRect.height / 2 - containerRect.top;
        const toX = toRect.left + toRect.width / 2 - containerRect.left;
        const toY = toRect.top + toRect.height / 2 - containerRect.top;

        return {
          fromX,
          fromY,
          toX,
          toY,
          active:
            hoveredNodeIndex === edge.from || hoveredNodeIndex === edge.to,
        };
      })
      .filter((edge): edge is EdgePosition => edge !== null);
  }, [edges, hoveredNodeIndex]);

  return {
    nodePositions,
    hoveredNodeIndex,
    draggedNodeRef,
    nodeRefs,
    containerRef,
    edges,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    setHoveredNodeIndex,
    calculateEdgePositions,
  };
}
