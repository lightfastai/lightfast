"use client";

import { useEffect, useState } from "react";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

import { CommandDialog } from "./components/CommandDialog";
import { Node } from "./components/Node";
import { NodesContainer } from "./components/NodesContainer";
import { useGenerationState } from "./hooks/useGenerationState";
import { useNodeState } from "./hooks/useNodeState";

const SUGGESTED_PROMPTS = [
  "Create a blur effect node",
  "Make a color grading node",
  "Generate a particle system node",
];

export function AiNodeCreator() {
  const [isHovered, setIsHovered] = useState(false);
  const [openCommand, setOpenCommand] = useState(false);
  const {
    nodePositions,
    hoveredNodeIndex,
    draggedNodeRef,
    nodeRefs,
    containerRef,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    setHoveredNodeIndex,
    calculateEdgePositions,
  } = useNodeState();

  const { isGenerating, generationLogs, startGeneration } =
    useGenerationState();

  const [edgePositions, setEdgePositions] = useState<any[]>([]);

  useEffect(() => {
    if (nodeRefs.current.every((node) => node !== null)) {
      const positions = calculateEdgePositions();
      setEdgePositions(positions);
    }
  }, [hoveredNodeIndex, calculateEdgePositions]);

  useEffect(() => {
    const handleResize = () => {
      if (nodeRefs.current.every((node) => node !== null)) {
        const positions = calculateEdgePositions();
        setEdgePositions(positions);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [calculateEdgePositions]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpenCommand((open) => !open);
      }

      if (e.key === "Escape" && openCommand) {
        setOpenCommand(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [openCommand]);

  const handleSubmit = (value: string) => {
    startGeneration(value);
  };

  return (
    <div
      className="relative h-[420px] w-full overflow-hidden rounded-md border"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NodesContainer ref={containerRef} edges={edgePositions}>
        {[1, 2, 3, 4].map((_, index) => (
          <Node
            key={index}
            index={index}
            position={nodePositions[index] || { x: 0, y: 0 }}
            imageSrc={`/images/placeholder-node-${index + 1}.jpg`}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onMouseEnter={() => setHoveredNodeIndex(index)}
            onMouseLeave={() => setHoveredNodeIndex(null)}
            isDragged={draggedNodeRef.current === index}
          />
        ))}
      </NodesContainer>

      {isHovered && (
        <div
          className={cn(
            "absolute right-4 top-4 z-10",
            isHovered
              ? "duration-300 ease-in-out animate-in slide-in-from-top"
              : "duration-300 animate-out fade-out",
          )}
        >
          <Button
            variant="outline"
            size="sm"
            className="text-xs shadow-sm transition-all hover:shadow-md"
            onClick={() => setOpenCommand(true)}
          >
            Press{" "}
            <kbd className="ml-1 mr-1 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>{" "}
            to create
          </Button>
        </div>
      )}

      <CommandDialog
        isOpen={openCommand}
        onClose={() => setOpenCommand(false)}
        onSubmit={handleSubmit}
        suggestedPrompts={SUGGESTED_PROMPTS}
        isGenerating={isGenerating}
        generationLogs={generationLogs}
      />
    </div>
  );
}
