import { useCallback, useRef, useState } from "react";

import type { Edge, EdgePosition, NodePosition } from "../types";

export function useNodeState() {
  const [nodePositions, setNodePositions] = useState<NodePosition[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);
  const [hoveredNodeIndex, setHoveredNodeIndex] = useState<number | null>(null);
  const draggedNodeRef = useRef<number | null>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const containerRef = useRef<HTMLDivElement>(null);

  const edges: Edge[] = [
    { from: 0, to: 1 },
    { from: 1, to: 2 },
    { from: 0, to: 3 },
    { from: 2, to: 3 },
  ];

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    draggedNodeRef.current = index;
    const dragImage = document.createElement("div");
    dragImage.style.opacity = "0";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    requestAnimationFrame(() => document.body.removeChild(dragImage));
  }, []);

  const handleDrag = useCallback((e: React.DragEvent, index: number) => {
    if (!containerRef.current || !e.clientX || !e.clientY) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left - 96;
    const y = e.clientY - containerRect.top - 64;

    setNodePositions((prev) => {
      const newPositions = [...prev];
      newPositions[index] = { x, y };
      return newPositions;
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    draggedNodeRef.current = null;
  }, []);

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
  }, [hoveredNodeIndex]);

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
