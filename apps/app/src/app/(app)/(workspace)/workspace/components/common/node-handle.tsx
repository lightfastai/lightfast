import { Handle, Position } from "@xyflow/react";

import type { HandleId } from "@vendor/db/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { isOutputHandleId, isTextureHandleId } from "@vendor/db/types";

/**
 * Props for the NodeHandle component
 */
export interface NodeHandleProps {
  /**
   * Strictly typed handle ID - either TextureHandleId or OutputHandleId
   */
  id: HandleId;

  /**
   * Position of the handle
   */
  position: Position;

  /**
   * Description to show in tooltip
   */
  description: string;

  /**
   * Whether this handle is required (affects styling)
   */
  isRequired?: boolean;

  /**
   * Which side the tooltip should appear on
   */
  tooltipSide?: "left" | "right" | "top" | "bottom";
}

/**
 * A reusable node handle component with improved UX and type safety.
 * Separates the tooltip trigger from the actual handle for better click target.
 */
export function NodeHandle({
  id,
  position,
  description,
  isRequired = false,
  tooltipSide = position === Position.Left ? "left" : "right",
}: NodeHandleProps) {
  // Determine handle type from the ID
  const isInput = isTextureHandleId(id);
  const isOutput = isOutputHandleId(id);

  if (!isInput && !isOutput) {
    console.warn(`Invalid handle ID: ${id}`);
    return null;
  }

  return (
    <div className="relative flex h-3 w-3 items-center justify-center">
      {/* Tooltip wrapper - larger area that triggers the tooltip */}
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div className="absolute -left-4 -top-4 z-10 h-8 w-8 cursor-pointer rounded-full opacity-0" />
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="z-50">
            <span className="font-medium">{description}</span>
            {!isRequired && (
              <span className="ml-1 text-xs text-muted-foreground">
                (optional)
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Actual handle component */}
      <Handle
        id={id}
        type={isInput ? "target" : "source"}
        position={position}
        className={cn(
          "absolute z-10 h-6 w-3 border transition-opacity duration-150 hover:opacity-80",
          isRequired ? "border-primary" : "border-muted",
        )}
      />

      {/* Invisible larger click target for better UX */}
      <div
        className={cn(
          "absolute z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-crosshair bg-transparent",
          // Adjust position based on handle type
          position === Position.Left
            ? "-left-[3px]"
            : position === Position.Right
              ? "-right-[3px]"
              : "",
          position === Position.Top
            ? "-top-[3px]"
            : position === Position.Bottom
              ? "-bottom-[3px]"
              : "",
        )}
      />
    </div>
  );
}
