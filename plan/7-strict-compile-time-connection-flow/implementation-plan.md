# Implementation Plan: Enhanced Edge Type Safety

## Problem Statement

The current implementation of the edge system in React TD lacks compile-time type safety for handle IDs, relying heavily on runtime validation. This creates the potential for bugs when invalid handle IDs are passed around the system. Additionally, source and target handles are currently optional, which can lead to incomplete connections.

## Goals

1. Establish a single source of truth for handle ID validation
2. Implement compile-time type checking for handle IDs
3. Enforce required handle specifications for both source and target
4. Create a more strictly typed Connection interface
5. Maintain backward compatibility with existing code
6. Improve developer experience with better error messages
7. Minimize runtime validation overhead

## Implementation Steps

### Phase 1: Enhanced TextureHandleId Type

1. **Update TextureHandleId Type in vendor/db/src/schema/types/TextureHandle.ts**

```typescript
// Current implementation
export type TextureHandleId = z.infer<typeof $TextureHandleId>;

// New implementation using branded types
export type TextureHandleId = string & { readonly __brand: 'TextureHandleId' };

// Safe constructor function
export function createTextureHandleId(value: string): TextureHandleId | null {
  if (!isValidTextureHandleId(value)) return null;
  return value as TextureHandleId;
}

// Type guard
export function isTextureHandleId(value: unknown): value is TextureHandleId {
  return typeof value === 'string' && isValidTextureHandleId(value as string);
}
```

2. **Update Zod Schema to Use the New Type**

```typescript
export const $TextureHandleId = z.custom<TextureHandleId>(
  (val) => typeof val === "string" && isValidTextureHandleId(val as string),
  {
    message:
      "Handle ID must be in the format 'input-N' where N is a positive integer",
  },
);
```

3. **Utility Function for Creating Arrays of Valid Handles**

```typescript
export function createTextureHandleIds(count: number): TextureHandleId[] {
  return Array.from(
    { length: count },
    (_, i) => generateTextureHandleId(i) as TextureHandleId,
  );
}
```

### Phase 2: Create Strict Connection Type

1. **Create a Shared Connection Type Definition**

```typescript
// In apps/app/src/app/(app)/(workspace)/workspace/types/connection.ts
import { Connection as BaseConnection } from "@xyflow/react";

import {
  createTextureHandleId,
  isTextureHandleId,
  TextureHandleId,
} from "@vendor/db/types";

/**
 * A strictly typed connection with guaranteed valid handle IDs
 */
export interface StrictConnection
  extends Omit<BaseConnection, "sourceHandle" | "targetHandle"> {
  sourceHandle: TextureHandleId;
  targetHandle: TextureHandleId;
}

/**
 * Type guard to check if a connection is a StrictConnection
 */
export function isStrictConnection(
  connection: BaseConnection,
): connection is StrictConnection {
  return (
    !!connection.sourceHandle &&
    !!connection.targetHandle &&
    isTextureHandleId(connection.sourceHandle) &&
    isTextureHandleId(connection.targetHandle)
  );
}

/**
 * Convert a standard React Flow connection to a strict connection
 * Returns null if the connection is invalid
 */
export function toStrictConnection(
  connection: BaseConnection,
): StrictConnection | null {
  const { sourceHandle, targetHandle, ...rest } = connection;

  // Validate both handles exist
  if (!sourceHandle || !targetHandle) {
    return null;
  }

  // Validate both handles have correct format
  const typedSourceHandle = createTextureHandleId(sourceHandle);
  const typedTargetHandle = createTextureHandleId(targetHandle);

  if (!typedSourceHandle || !typedTargetHandle) {
    return null;
  }

  return {
    ...rest,
    sourceHandle: typedSourceHandle,
    targetHandle: typedTargetHandle,
  };
}
```

### Phase 3: Update Edge Schema

1. **Update Edge.ts Schema to Use the TextureHandleId Type and Make Handles Required**

```typescript
import { z } from "zod";

import { $TextureHandleId, TextureHandleId } from "../types/TextureHandle";

export const InsertEdgeSchema = z.object({
  source: z.string().min(1).max(191),
  target: z.string().min(1).max(191),
  sourceHandle: $TextureHandleId, // Now required
  targetHandle: $TextureHandleId, // Now required
});

export type InsertEdge = {
  source: string;
  target: string;
  sourceHandle: TextureHandleId; // Required
  targetHandle: TextureHandleId; // Required
};
```

2. **Update Edge Helper Functions**

```typescript
export function getUniformForEdge(edge: {
  targetHandle: TextureHandleId; // Now required
}): string {
  return getUniformNameFromTextureHandleId(edge.targetHandle);
}
```

### Phase 4: Update UI Components

1. **Update NodeHandle Component Props**

```typescript
import { TextureHandleId } from "@vendor/db/types";

export interface NodeHandleProps {
  /**
   * Unique identifier for this handle
   * For input handles, must be a valid TextureHandleId
   * For output handles, must include "output"
   */
  id: string | TextureHandleId;

  // Other props...
}
```

2. **Define a Standard Output Handle Format**

```typescript
// In TextureHandle.ts
export const OUTPUT_HANDLE_ID = "output-main";

// Type guard for output handles
export function isOutputHandleId(id: string): boolean {
  return id === OUTPUT_HANDLE_ID;
}
```

3. **Update TextureNode Component**

```typescript
// Inside texture-node.tsx
import {
  createTextureHandleId,
  TextureHandleId,
  OUTPUT_HANDLE_ID
} from "@vendor/db/types";

// When creating NodeHandle components:
const handleId = createTextureHandleId(input.id);
if (!handleId) {
  console.error(`Invalid texture handle ID: ${input.id}`);
  return null;
}

return (
  <div key={input.id} className="relative flex items-center justify-center py-1">
    <NodeHandle
      id={handleId}
      type="input"
      position={Position.Left}
      description={input.description}
      isRequired={input.required}
      tooltipSide="left"
    />
  </div>
);

// For output handles, use the standard output handle ID
<NodeHandle
  id={OUTPUT_HANDLE_ID}
  type="output"
  position={Position.Right}
  description="Output"
  isRequired={true}
  tooltipSide="right"
/>
```

### Phase 5: Update Hook Logic

1. **Update useAddEdge Hook to Use StrictConnection**

```typescript
import { Connection } from "@xyflow/react";

import { toast } from "@repo/ui/hooks/use-toast";

import { StrictConnection, toStrictConnection } from "../types/connection";

export const useAddEdge = () => {
  // Other code...

  /**
   * Create a regular edge connection
   */
  const createRegularConnection = useCallback(
    async (connection: StrictConnection) => {
      try {
        await mut({
          id: nanoid(),
          edge: {
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle, // Now strongly typed
            targetHandle: connection.targetHandle, // Now strongly typed
          },
        });
        return true;
      } catch (error) {
        console.error("Error creating edge:", error);
        return false;
      }
    },
    [mut],
  );

  /**
   * Main function to handle edge connections with strict typing
   */
  const mutateAsync = useCallback(
    async (connection: Connection) => {
      const { source, target } = connection;

      // Convert to strict connection with validation
      const strictConnection = toStrictConnection(connection);
      if (!strictConnection) {
        toast({
          title: "Error",
          description:
            "Invalid connection handles. Both source and target handles must be specified and valid.",
          variant: "destructive",
        });
        return false;
      }

      // Only keep essential client-side validation
      if (!validateSelfConnection(source, target)) {
        return false;
      }

      // Use the strict connection
      return await createRegularConnection(strictConnection);
    },
    [validateSelfConnection, createRegularConnection],
  );

  return { mutateAsync };
};
```

### Phase 6: Update WebGL Registry

1. **Update Texture Registry Functions**

```typescript
import { createTextureHandleId, TextureHandleId } from "@vendor/db/types";

export function getTextureInputsForType(textureType: string): {
  id: TextureHandleId;
  uniformName: string;
  description: string;
  required: boolean;
}[] {
  // Implementation...
  return Object.entries(constraints)
    .filter(([_, value]) => value.type === ValueType.Texture)
    .map(([key, value]) => {
      const constraint = value.constraint as TextureFieldMetadata;
      const handleId = getTextureHandleFromUniformName(key);
      // Validate the handle ID
      if (!handleId) {
        console.error(`Invalid handle ID generated from uniform ${key}`);
        // Fallback to a safe default
        return {
          id: createTextureHandleId("input-1")!,
          uniformName: key,
          description: constraint.description || value.label,
          required: constraint.required || false,
        };
      }
      return {
        id: handleId,
        uniformName: key,
        description: constraint.description || value.label,
        required: constraint.required || false,
      };
    });
}

function getTextureHandleFromUniformName(
  uniformName: string,
): TextureHandleId | null {
  // Implementation...
}
```

### Phase 7: Implement Connection Validation Middleware

1. **Create a Connection Validation Middleware for React Flow**

```typescript
// In apps/app/src/app/(app)/(workspace)/workspace/hooks/use-connection-validator.ts
import { useCallback } from "react";
import { Connection } from "@xyflow/react";

import { toast } from "@repo/ui/hooks/use-toast";

import { toStrictConnection } from "../types/connection";

export function useConnectionValidator() {
  return useCallback((connection: Connection) => {
    // Attempt to convert to a strict connection
    const strictConnection = toStrictConnection(connection);

    // If conversion fails, show error and prevent connection
    if (!strictConnection) {
      toast({
        title: "Invalid Connection",
        description: "Both source and target handles must be valid",
        variant: "destructive",
      });
      return false;
    }

    // Connection is valid
    return true;
  }, []);
}

// Then use this in your Flow component:
// const isValidConnection = useConnectionValidator();
// <ReactFlow isValidConnection={isValidConnection} ... />
```

## Testing Strategy

1. **Unit Tests**

   - Test TextureHandleId creation and validation
   - Test StrictConnection conversion and validation
   - Test conversion between uniform names and handle IDs
   - Test edge schema validation

2. **Integration Tests**

   - Test UI component rendering with valid and invalid handles
   - Test edge creation flow end-to-end
   - Test connection validation middleware

3. **Migration Tests**
   - Test backward compatibility with existing data
   - Ensure existing edges are properly handled

## Rollout Plan

1. **Phase 1-2** - Core type and connection updates (minimal impact)
2. **Phase 3** - Schema updates (requires database compatibility testing)
3. **Phase 4-6** - UI and logic updates (can be done incrementally)
4. **Phase 7** - Connection validation middleware (after all other changes)

## Migration Considerations

Since we're making handles required instead of optional, we need a migration strategy:

1. **Database Migration**

   - Identify edges with missing handles
   - Either add default handles or mark for cleanup
   - Update schema constraints after data is cleaned

2. **API Backward Compatibility**
   - Temporarily maintain compatibility with optional handles
   - Add deprecation warnings for missing handles
   - Phase out support after migration period

## Future Work

After implementing the above changes, consider these further improvements:

1. **Database Constraints** - Add custom types or check constraints at the database level

2. **Generated Node Types** - Create specific node types for each texture type that know their valid inputs

3. **Visual Connection Validation** - Implement visual feedback during connection attempts to prevent invalid connections

4. **Connection Type Registry** - Build a registry of valid connection types between different node types

5. **Edge Type Specialization** - Define different types of edges based on the types of nodes they connect
