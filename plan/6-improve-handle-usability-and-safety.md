# Improving Node Handle Usability and Type Safety

## Issue Analysis

After examining the current node handle implementation, we've identified several UX and safety issues:

1. **Handle Accessibility Issues**:

   - Handles are difficult to click due to small hit areas (only 3x3 pixels)
   - Tooltips interfere with handle interaction when hovering
   - The hover scale effect (hover:scale-125) causes handle position shifting
   - The positioning can be inconsistent across different handle types

2. **Type Safety Concerns**:
   - Handle IDs are critical for proper validation but are passed as regular props
   - No type enforcement ensures handles always have required IDs
   - Current validation relies on string pattern matching (checking for "input" or "output")

## Implementation Goals

1. Create a reusable `NodeHandle` component that:

   - Has improved UX with larger hit areas while maintaining visual styling
   - Properly separates tooltip triggers from connection points
   - Enforces type safety for handle IDs and types
   - Maintains compatibility with existing validation logic

2. Update CSS for handles to:
   - Provide consistent positioning
   - Ensure handles are easily clickable
   - Maintain visual consistency with the design

## Affected Components

1. **New Components**:

   - `apps/app/src/app/(app)/(workspace)/workspace/components/common/node-handle.tsx` - Create this new component

2. **Refactor Existing Components**:

   - `apps/app/src/app/(app)/(workspace)/workspace/components/nodes/texture-node.tsx` - Update handle implementation
   - Other node components using handles

3. **Styling**:
   - Update Tailwind classes for handle components

## Implementation Plan

### Phase 1: Create Reusable NodeHandle Component with Tailwind

**File**: `apps/app/src/app/(app)/(workspace)/workspace/components/common/node-handle.tsx`

```typescript
import { Handle, Position } from "@xyflow/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";

// Type for handle direction - enforces proper ID prefix
type HandleType = "input" | "output";

/**
 * Props for the NodeHandle component
 */
export interface NodeHandleProps {
  /**
   * Unique identifier for this handle, must be prefixed with "input-" or "output"
   * depending on the type. For inputs, should follow pattern "input-N"
   */
  id: string;

  /**
   * The type of handle, either "input" or "output"
   */
  type: HandleType;

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
  type,
  position,
  description,
  isRequired = false,
  tooltipSide = position === Position.Left ? "left" : "right",
}: NodeHandleProps) {
  // Validate ID format based on type
  if (type === "input" && !id.startsWith("input-")) {
    throw new Error(`Input handle IDs must start with "input-". Received: "${id}"`);
  }

  if (type === "output" && !id.includes("output")) {
    throw new Error(`Output handle IDs must include "output". Received: "${id}"`);
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
        type={type === "input" ? "target" : "source"}
        position={position}
        className={cn(
          "absolute z-10 h-3 w-3 rounded-full border transition-opacity duration-150 hover:opacity-80",
          isRequired
            ? "border-primary bg-primary"
            : "border-muted-foreground bg-muted"
        )}
      />

      {/* Invisible larger click target for better UX */}
      <div
        className={cn(
          "absolute z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full bg-transparent",
          // Adjust position based on handle type
          position === Position.Left ? "-left-[3px]" :
          position === Position.Right ? "-right-[3px]" : "",
          position === Position.Top ? "-top-[3px]" :
          position === Position.Bottom ? "-bottom-[3px]" : ""
        )}
      />
    </div>
  );
}
```

### Phase 2: Update TextureNode Component (Full Implementation)

**File**: `apps/app/src/app/(app)/(workspace)/workspace/components/nodes/texture-node.tsx`

```typescript
import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { Position } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import type { Texture } from "@vendor/db/types";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";
import { getTextureInputsForType } from "@repo/webgl";
import { WebGLView } from "@repo/webgl/components";
import { GeometryMap } from "@repo/webgl/globals";
import { $GeometryType } from "@vendor/db/types";

import type { BaseNode } from "../../types/node";
import type { TextureInput } from "../../types/texture";
import { api } from "~/trpc/client/react";
import { useInspectorStore } from "../../providers/inspector-store-provider";
import { useTextureRenderStore } from "../../providers/texture-render-store-provider";
import { NodeHandle } from "../../components/common/node-handle";

export const TextureNode = memo(
  ({ id, type, selected }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Texture>({ id });
    const { targets } = useTextureRenderStore((state) => state);
    const setSelected = useInspectorStore((state) => state.setSelected);

    // Get texture inputs metadata from the registry
    const textureInputs: TextureInput[] = getTextureInputsForType(data.type);

    return (
      <BaseNodeComponent
        id={id}
        selected={selected}
        onClick={() => {
          setSelected({ id, type });
        }}
      >
        <div
          key={id}
          className={cn(
            "relative flex flex-col gap-2 p-2 text-card-foreground",
          )}
        >
          <div className="flex flex-row items-center justify-between">
            <Label className="font-mono text-xs font-bold uppercase tracking-widest">
              {data.type} {id}
            </Label>
            <ToggleGroup type="single">
              <ToggleGroupItem
                value="renderInNode"
                variant="outline"
                size="sm"
                onClick={() => {
                  // Implementation details...
                }}
              >
                <ArrowRightIcon className="h-3 w-3" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-row items-center">
            <div className="flex h-full flex-col items-center justify-evenly gap-3 py-3">
              {textureInputs.length > 0 ? (
                // For nodes with inputs, create properly positioned handles
                textureInputs.map((input: TextureInput) => (
                  <div
                    key={input.id}
                    className="relative flex py-1 items-center justify-center"
                  >
                    <NodeHandle
                      id={input.id}
                      type="input"
                      position={Position.Left}
                      description={input.description}
                      isRequired={input.required}
                      tooltipSide="left"
                    />
                  </div>
                ))
              ) : (
                // No input handles for this texture type
                <></>
              )}
            </div>

            <div className="h-32 w-72 overflow-hidden rounded border">
              {targets[id]?.texture && (
                <WebGLView
                  style={{
                    position: "relative",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <mesh
                    geometry={GeometryMap[$GeometryType.Enum.plane]}
                    scale={3}
                  >
                    <meshBasicMaterial map={targets[id].texture} />
                  </mesh>
                </WebGLView>
              )}
            </div>

            <div className="ml-1 flex items-center justify-center">
              <NodeHandle
                id="output"
                type="output"
                position={Position.Right}
                description="Output"
                isRequired={true}
                tooltipSide="right"
              />
            </div>
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
```

### Phase 3: Update FluxNode Component

**File**: `apps/app/src/app/(app)/(workspace)/workspace/components/nodes/flux-node.tsx`

The FluxNode needs to be updated to include handles for connections. After analyzing the component, we need to add both input and output handles.

```typescript
import type { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { Position } from "@xyflow/react";
import Image from "next/image";
import { PlayIcon } from "lucide-react";

import type { Txt2Img } from "@vendor/db/types";
import { createFalClient } from "@repo/ai/fal";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import type { BaseNode } from "../../types/node";
import { api } from "~/trpc/client/react";
import { useInspectorStore } from "../../providers/inspector-store-provider";
import { NodeHandle } from "../../components/common/node-handle";

const fal = createFalClient({
  proxyUrl: "/api/fal/proxy",
});

export const FluxNode = memo(
  ({ id, type, selected, isConnectable }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Txt2Img>({ id });
    const setSelected = useInspectorStore((state) => state.setSelected);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Implementation details...

    return (
      <BaseNodeComponent
        id={id}
        selected={selected}
        onClick={() => {
          setSelected({ id, type });
        }}
      >
        <div
          key={id}
          className={cn(
            `relative flex flex-col space-y-1 p-1 text-card-foreground shadow-sm`,
          )}
        >
          <div className="flex flex-row items-center justify-between">
            <Label className="font-mono text-xs font-bold uppercase tracking-widest">
              {data.type}
            </Label>
          </div>

          <div className="flex flex-row gap-1">
            {/* Add input handle for prompt source */}
            <div className="flex flex-col justify-center mr-1">
              <NodeHandle
                id="input-1"
                type="input"
                position={Position.Left}
                description="Prompt Input"
                isRequired={false}
                tooltipSide="left"
              />
            </div>

            <div className="h-32 w-72 overflow-hidden border">
              {result && (
                <Image
                  src={result}
                  alt="Flux image"
                  width={512}
                  height={512}
                  className="object-contain"
                />
              )}
            </div>

            {/* Add output handle for generated image */}
            <div className="flex flex-col justify-center ml-1">
              <NodeHandle
                id="output"
                type="output"
                position={Position.Right}
                description="Generated Image"
                isRequired={true}
                tooltipSide="right"
              />
            </div>
          </div>

          <div className="flex flex-row justify-end gap-1">
            <ToggleGroup type="single" variant="outline" size="sm">
              <ToggleGroupItem
                value="generate"
                onClick={async (e) => {
                  e.stopPropagation();
                  generateImage();
                }}
              >
                <PlayIcon className="h-3 w-3" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
```

### Phase 4: Update Global Styles (Optional)

**File**: `apps/app/src/app/globals.css`

If we need to update any global styles for React Flow handles, we can add the following, but most of the styling will now be handled by the Tailwind classes in our components:

```css
/* Update existing handle styles to be more consistent */
.react-flow .react-flow__handle {
  @apply h-2 w-2 border-2 border-background bg-primary;
}

/* Ensure consistent positioning */
.react-flow .react-flow__handle-left {
  @apply -left-1;
}

.react-flow .react-flow__handle-right {
  @apply -right-1;
}

/* Remove hover transforms from base handles if they still exist */
.react-flow .react-flow__handle:hover {
  @apply transform-none;
}
```

## Benefits

This implementation provides several key benefits:

1. ✅ **Improved UX**:

   - Larger click targets make handles easier to interact with
   - Tooltips won't interfere with handle interaction
   - No more position shifting on hover
   - Tailwind classes for consistent styling across the app

2. ✅ **Type Safety**:

   - Enforces proper ID naming conventions
   - Provides clear error messages for incorrect usage
   - Better developer experience with TypeScript interfaces

3. ✅ **Maintainability**:

   - Centralizes handle logic in one component
   - Consistent styling across different node types
   - Uses Tailwind for consistent design language with the rest of the app
   - Easier to update in the future

4. ✅ **Compatibility**:
   - Works with existing validation logic
   - No changes needed to edge connection validation

## Testing Strategy

After implementing the changes, we should test:

1. **Interaction Testing**:

   - Verify handles are easy to click and drag
   - Confirm tooltips appear only when hovering on tooltip areas
   - Test that connections can be made properly

2. **Visual Testing**:

   - Ensure handles maintain visual consistency with design
   - Verify handles position correctly in different layouts
   - Check that Tailwind styles apply correctly

3. **Developer Experience**:

   - Test TypeScript errors when incorrect IDs are provided
   - Verify errors are thrown for improperly formatted IDs

4. **Edge Cases**:
   - Test with different node types
   - Test with multiple input/output handles
   - Verify handles behave correctly at different zoom levels

## Implementation Notes

- The implementation separates the tooltip trigger from the actual handle interactive area
- We've added an invisible larger hit area for better click targeting
- The tooltip now has a delay to avoid appearing immediately while trying to click
- We've replaced CSS transitions with Tailwind equivalents
- Type safety is enforced both through TypeScript and runtime validation
- All styling is now done with Tailwind classes for consistency

## Conclusion

By implementing this reusable NodeHandle component with improved UX and type safety, we'll create a more user-friendly and developer-friendly node connection system. Users will find it easier to create connections, and developers will have better guarantees that handles are implemented correctly.
