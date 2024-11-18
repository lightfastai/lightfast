import { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

interface WorkspaceNodeWrapperProps {
  id: string;
  x: number;
  y: number;
  isSelected: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick?: (e: React.MouseEvent) => void;
  children: ReactNode;
}

export function WorkspaceNodeWrapper({
  id,
  x,
  y,
  isSelected,
  onMouseEnter,
  onMouseLeave,
  onClick,
  children,
}: WorkspaceNodeWrapperProps) {
  return (
    <div
      key={id}
      className={cn(
        "absolute transition-all",
        isSelected && "ring-2 ring-blue-500",
      )}
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
