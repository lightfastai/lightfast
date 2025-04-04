# Phase 4: UI Components - Implementation

## Overview

This phase updates the NodeHandle component to work with strictly typed handles while maintaining the existing UI patterns and accessibility features. Instead of creating new components, we enhance the existing NodeHandle component to support type-safe handle IDs.

## Implementation Details

### NodeHandle Component Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/common/node-handle.tsx
import { Handle, Position } from "@xyflow/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import {
  HandleId,
  TextureHandleId,
  OutputHandleId,
  isTextureHandleId,
  isOutputHandleId,
} from "@vendor/db/types";

export interface NodeHandleProps {
  id: HandleId;
  position: Position;
  description: string;
  isRequired?: boolean;
  tooltipSide?: "left" | "right" | "top" | "bottom";
}

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

      <Handle
        id={id}
        type={isInput ? "target" : "source"}
        position={position}
        className={cn(
          "absolute z-10 h-6 w-3 border transition-opacity duration-150 hover:opacity-80",
          isRequired ? "border-primary" : "border-muted",
        )}
      />

      <div
        className={cn(
          "absolute z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-crosshair bg-transparent",
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
```

### Example Usage in Node Components

```typescript
// Example usage in TextureNode
const TextureNode = ({ data, ...props }: NodeProps<TextureNodeData>) => {
  const textureHandles = createTextureHandleIds(data.inputs.length);
  const outputHandle = createOutputHandleId("output-main")!;

  return (
    <div>
      {textureHandles.map((handleId, index) => (
        <NodeHandle
          key={handleId}
          id={handleId}
          position={Position.Left}
          description={`Input ${index + 1}`}
          isRequired={data.inputs[index].required}
        />
      ))}
      <NodeHandle
        id={outputHandle}
        position={Position.Right}
        description="Output"
      />
    </div>
  );
};
```

## Key Changes

1. **Type Safety**:

   - Replaced string-based IDs with branded types (`TextureHandleId` and `OutputHandleId`)
   - Removed explicit type prop in favor of inferring from ID
   - Added runtime validation using type guards

2. **UI/UX Features**:

   - Maintained existing tooltip functionality
   - Preserved accessibility features
   - Kept consistent styling patterns
   - Retained shadcn/ui integration

3. **Simplifications**:

   - Removed redundant type prop (now inferred from ID)
   - Simplified validation logic
   - Maintained single source of truth for handle types

4. **Component Integration**:
   - Works seamlessly with existing node components
   - Maintains consistent API
   - Preserves existing styling system

## Implementation Notes

1. **Type Safety**: The component now uses branded types from `@vendor/db/types` to ensure type safety at compile time.

2. **Runtime Validation**: Although we have compile-time type safety, we maintain runtime validation for better error handling and debugging.

3. **Backward Compatibility**: The component maintains compatibility with existing code while enforcing stricter typing.

4. **Performance**: The component remains lightweight with minimal runtime overhead.

## Migration Impact

The changes primarily affect the type system and validation logic, with minimal impact on the actual UI/UX. Existing code using NodeHandle will need to:

1. Update handle IDs to use the new branded types
2. Remove explicit type props (now inferred from ID)
3. Ensure proper handle ID creation using provided utilities

No visual or behavioral changes are required, making this a relatively safe migration.
