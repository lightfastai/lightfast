# Phase 4: UI Components - Specification

## Overview

This phase updates the UI components to work with strictly typed handles. The main components that need to be updated are the handle components, connection lines, and edge components in the React Flow implementation.

## Requirements

1. Update the TextureHandle component to use the branded TextureHandleId type
2. Update the Node component to use strictly typed handles
3. Update EdgeLine component to use StrictConnection
4. Ensure backward compatibility with existing code

## Technical Design

### TextureHandle Component Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/nodes/TextureHandle.tsx
import { DetailedHTMLProps, HTMLAttributes } from "react";
import { Position } from "@xyflow/react";

import {
  createTextureHandleId,
  isTextureHandleId,
  TextureHandleId,
} from "@vendor/db/types";

// Updated props with TextureHandleId
export interface TextureHandleProps
  extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  id: TextureHandleId;
  position?: Position;
  hideIfConnected?: boolean;
  isConnected?: boolean;
  isConnectable?: boolean;
  connectionIndicator?: boolean;
}

export const TextureHandle = ({
  id,
  position = Position.Left,
  hideIfConnected = false,
  isConnected = false,
  isConnectable = true,
  connectionIndicator = true,
  ...props
}: TextureHandleProps) => {
  // Same implementation, but now with type-safety on the id

  // Validation is now done at compile-time through the TextureHandleId type,
  // but we can still do runtime validation as a fallback
  if (!isTextureHandleId(id)) {
    console.warn(`Invalid TextureHandleId: ${id}`);
    return null;
  }

  // Rest of component implementation...
};
```

### OutputHandle Component

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/nodes/OutputHandle.tsx
import { DetailedHTMLProps, HTMLAttributes } from "react";
import { Position } from "@xyflow/react";

import {
  createOutputHandleId,
  isOutputHandleId,
  OutputHandleId,
} from "@vendor/db/types";

// New component for output handles
export interface OutputHandleProps
  extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  id: OutputHandleId;
  position?: Position;
  hideIfConnected?: boolean;
  isConnected?: boolean;
  isConnectable?: boolean;
  connectionIndicator?: boolean;
}

export const OutputHandle = ({
  id,
  position = Position.Right,
  hideIfConnected = false,
  isConnected = false,
  isConnectable = true,
  connectionIndicator = true,
  ...props
}: OutputHandleProps) => {
  // Similar implementation to TextureHandle but for output handles

  if (!isOutputHandleId(id)) {
    console.warn(`Invalid OutputHandleId: ${id}`);
    return null;
  }

  // Implementation...
};
```

### Edge Component Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/flow/EdgeLine.tsx
import {
  BaseEdge,
  EdgeProps,
  getStraightPath,
  useReactFlow,
} from "@xyflow/react";

import {
  HandleId,
  isOutputHandleId,
  isTextureHandleId,
} from "@vendor/db/types";

import { StrictConnection, toStrictConnection } from "../../types/connection";

// Updated EdgeLine component with stronger typing
export const EdgeLine = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandle,
  targetHandle,
  markerEnd,
  style,
}: EdgeProps) => {
  const { findNode } = useReactFlow();

  // Convert to strict connection or use default handles
  let safeSourceHandle: HandleId;
  let safeTargetHandle: HandleId;

  // Try to convert to strict connection for type safety
  const strictConnection = toStrictConnection({
    source,
    target,
    sourceHandle,
    targetHandle,
  });

  if (strictConnection) {
    // Use the validated handles from the strict connection
    safeSourceHandle = strictConnection.sourceHandle;
    safeTargetHandle = strictConnection.targetHandle;
  } else {
    // Fallback to defaults if conversion fails
    console.warn(`Invalid connection for edge ${id}, using default handles`);

    // Use types that make sense for the common case
    // Usually source is an output and target is an input
    safeSourceHandle = createOutputHandleId("output-main")!;
    safeTargetHandle = createTextureHandleId("input-1")!;
  }

  // Rest of component implementation...
};
```

### Node Component Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/nodes/TextureNode.tsx
import { NodeProps } from "@xyflow/react";

import {
  TextureHandleId,
  createTextureHandleIds,
  OutputHandleId,
  createOutputHandleId,
} from "@vendor/db/types";
import { TextureHandle } from "./TextureHandle";
import { OutputHandle } from "./OutputHandle";

export const TextureNode = ({ data, ...props }: NodeProps) => {
  // Create properly typed handles based on texture type
  const inputs = data.inputs || [];
  const textureHandles: TextureHandleId[] = createTextureHandleIds(inputs.length);

  // Create output handle with proper type
  const outputHandle: OutputHandleId = createOutputHandleId("output-main")!;

  return (
    <div className="texture-node">
      {/* Input handles */}
      {textureHandles.map((handleId, i) => (
        <TextureHandle
          key={handleId}
          id={handleId}
          isConnectable={true}
          // Other props...
        />
      ))}

      {/* Output handle */}
      <OutputHandle
        id={outputHandle}
        isConnectable={true}
        // Other props...
      />

      {/* Rest of component... */}
    </div>
  );
};
```

## Dependencies

1. Phase 1: Enhanced Handle Types - The branded types are used in component props
2. Phase 2: Connection Types - StrictConnection is used in the EdgeLine component
3. Phase 3: Edge Schema - The updated Edge schema informs the EdgeLine component

## Impact Analysis

| Component     | Changes Required                                     |
| ------------- | ---------------------------------------------------- |
| TextureHandle | Update props to use TextureHandleId                  |
| OutputHandle  | New component for output handles with OutputHandleId |
| EdgeLine      | Update to use StrictConnection                       |
| TextureNode   | Update to create properly typed handles              |
| FlowChart     | No changes yet (handled in Phase 7)                  |

## Acceptance Criteria

1. ✅ TextureHandle component uses the TextureHandleId type
2. ✅ OutputHandle component uses the OutputHandleId type
3. ✅ EdgeLine component handles both valid and invalid connections
4. ✅ Node components create properly typed handles
5. ✅ Existing UI continues to work with the updated components
6. ✅ All tests continue to pass
