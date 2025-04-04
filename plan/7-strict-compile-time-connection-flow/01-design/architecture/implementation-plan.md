# Implementation Plan: Enhanced Edge Type Safety

## Problem Statement

The current implementation of the edge system in React TD lacks compile-time type safety for handle IDs, relying heavily on runtime validation. This creates the potential for bugs when invalid handle IDs are passed around the system. Additionally, source and target handles are currently optional, which can lead to incomplete connections.

## Goals

1. Establish a single source of truth for handle ID validation
2. Implement compile-time type checking for handle IDs
3. Enforce required handle specifications for both source and target
4. Create a more strictly typed Connection interface
5. Support multiple output handles per node
6. Maintain backward compatibility with existing code
7. Improve developer experience with better error messages
8. Minimize runtime validation overhead
9. Remove redundant fields in the texture uniform system

## Implementation Steps

### Phase 1: Enhanced Handle Types

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

2. **Create OutputHandleId Type for Multiple Outputs**

```typescript
// Define a branded type for output handles
export type OutputHandleId = string & { readonly __brand: "OutputHandleId" };

// Regular expression for output handles: "output-{name}"
export const OUTPUT_HANDLE_ID_REGEX = /^output-[a-z0-9-]+$/;

// Create function similar to input handles
export function createOutputHandleId(value: string): OutputHandleId | null {
  if (!isValidOutputHandleId(value)) return null;
  return value as OutputHandleId;
}

// Validation function
export function isValidOutputHandleId(id: string): boolean {
  return OUTPUT_HANDLE_ID_REGEX.test(id);
}

// Helper function to generate standard output handle IDs
export function generateOutputHandleId(name: string): OutputHandleId | null {
  const id = `output-${name}`;
  return createOutputHandleId(id);
}
```

3. **Update Zod Schema to Use the New Types**

```typescript
export const $TextureHandleId = z.custom<TextureHandleId>(
  (val) => typeof val === "string" && isValidTextureHandleId(val as string),
  {
    message:
      "Handle ID must be in the format 'input-N' where N is a positive integer",
  },
);

export const $OutputHandleId = z.custom<OutputHandleId>(
  (val) => typeof val === "string" && isValidOutputHandleId(val as string),
  {
    message: "Output handle ID must be in the format 'output-name'",
  },
);

// Union type for all handle IDs
export const $HandleId = z.union([$TextureHandleId, $OutputHandleId]);
export type HandleId = TextureHandleId | OutputHandleId;
```

4. **Utility Function for Creating Arrays of Valid Handles**

```typescript
export function createTextureHandleIds(count: number): TextureHandleId[] {
  return Array.from(
    { length: count },
    (_, i) => generateTextureHandleId(i) as TextureHandleId,
  );
}

export function createOutputHandleIds(names: string[]): OutputHandleId[] {
  return names
    .map((name) => generateOutputHandleId(name))
    .filter((id): id is OutputHandleId => id !== null);
}
```

### Phase 2: Create Strict Connection Type

1. **Create a Shared Connection Type Definition**

```typescript
// In apps/app/src/app/(app)/(workspace)/workspace/types/connection.ts
import { Connection as BaseConnection } from "@xyflow/react";

import {
  createOutputHandleId,
  createTextureHandleId,
  HandleId,
  isOutputHandleId,
  isTextureHandleId,
  OutputHandleId,
  TextureHandleId,
} from "@vendor/db/types";

/**
 * A strictly typed connection with guaranteed valid handle IDs
 */
export interface StrictConnection
  extends Omit<BaseConnection, "sourceHandle" | "targetHandle"> {
  sourceHandle: HandleId;
  targetHandle: HandleId;
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
    (isTextureHandleId(connection.sourceHandle) ||
      isOutputHandleId(connection.sourceHandle)) &&
    (isTextureHandleId(connection.targetHandle) ||
      isOutputHandleId(connection.targetHandle))
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

  // Try to parse as either input or output handle
  let typedSourceHandle: HandleId | null = createTextureHandleId(sourceHandle);
  if (!typedSourceHandle) {
    typedSourceHandle = createOutputHandleId(sourceHandle);
  }

  let typedTargetHandle: HandleId | null = createTextureHandleId(targetHandle);
  if (!typedTargetHandle) {
    typedTargetHandle = createOutputHandleId(targetHandle);
  }

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

1. **Update Edge.ts Schema to Use the HandleId Type and Make Handles Required**

```typescript
import { z } from "zod";

import { $HandleId, HandleId } from "../types/TextureHandle";

export const InsertEdgeSchema = z.object({
  source: z.string().min(1).max(191),
  target: z.string().min(1).max(191),
  sourceHandle: $HandleId, // Now required, accepts either type
  targetHandle: $HandleId, // Now required, accepts either type
});

export type InsertEdge = {
  source: string;
  target: string;
  sourceHandle: HandleId; // Required
  targetHandle: HandleId; // Required
};
```

2. **Update Edge Helper Functions**

```typescript
export function getUniformForEdge(edge: {
  targetHandle: HandleId; // Now required
}): string | null {
  // For texture handles, return uniform name
  if (isTextureHandleId(edge.targetHandle)) {
    return getUniformNameFromTextureHandleId(edge.targetHandle);
  }

  // For other handle types, return null or handle appropriately
  return null;
}
```

### Phase 4: Update UI Components

1. **Update NodeHandle Component Props**

```typescript
import { HandleId, OutputHandleId, TextureHandleId } from "@vendor/db/types";

export interface NodeHandleProps {
  /**
   * Unique identifier for this handle
   * Must be a valid TextureHandleId or OutputHandleId
   */
  id: HandleId;

  /**
   * The type of handle
   */
  type: "input" | "output";

  // Other props...
}
```

2. **Define a Registry for Output Handles**

```typescript
// In TextureRegistry.ts
export interface OutputHandleDefinition {
  id: string;
  name: string;
  description: string;
}

export function getOutputHandlesForType(
  textureType: string,
): OutputHandleDefinition[] {
  // Implementation based on texture type
  const outputs: OutputHandleDefinition[] = [
    { id: "main", name: "Main", description: "Main texture output" },
  ];

  // Add specialized outputs for certain texture types
  if (textureType === "composite") {
    outputs.push({
      id: "mask",
      name: "Mask",
      description: "Alpha mask output",
    });
  }

  return outputs;
}
```

3. **Update TextureNode Component**

```typescript
// Inside texture-node.tsx
import {
  createTextureHandleId,
  createOutputHandleId,
  TextureHandleId,
  OutputHandleId,
} from "@vendor/db/types";

// For input handles:
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

// For output handles, use the output handle registry
const outputHandles = getOutputHandlesForType(textureType);
return (
  <div className="flex flex-col gap-2">
    {outputHandles.map(output => {
      const outputId = createOutputHandleId(`output-${output.id}`);
      if (!outputId) return null;

      return (
        <NodeHandle
          key={output.id}
          id={outputId}
          type="output"
          position={Position.Right}
          description={output.description}
          isRequired={true}
          tooltipSide="right"
        />
      );
    })}
  </div>
);
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

### Phase 8: Simplify TextureUniform Type

1. **Update TextureUniform Type to Remove Redundant isConnected Field**

```typescript
// In packages/webgl/src/types/texture-uniform.ts

/**
 * Updated interface without redundant isConnected field
 */
export interface TextureReference {
  id: string | null; // The ID of the source texture node
  textureObject: THREE.Texture | null; // The actual WebGL/Three.js texture object
}

/**
 * Updated Zod schema for texture uniforms
 */
export const $TextureUniform = z
  .object({
    id: z.string().nullable(),
    textureObject: z.any().nullable(), // Can't strongly type THREE.Texture in Zod
  })
  .nullable();

export type TextureUniform = z.infer<typeof $TextureUniform>;
```

2. **Update Factory Functions**

```typescript
/**
 * Update the factory functions to remove isConnected
 */
export function createTextureUniform(
  id: string | null = null,
  textureObject: THREE.Texture | null = null,
): TextureUniform {
  return {
    id,
    textureObject,
  };
}

/**
 * Update the existing TextureUniform
 */
export function updateTextureUniform(
  uniform: TextureUniform,
  id: string | null,
  textureObject: THREE.Texture | null,
): TextureUniform {
  if (!uniform) {
    return createTextureUniform(id, textureObject);
  }

  return {
    ...uniform,
    id,
    textureObject,
  };
}

/**
 * Helper function to check if a texture is connected
 */
export function isTextureConnected(uniform: TextureUniform): boolean {
  return !!uniform?.id;
}
```

3. **Update Type Guard Function**

```typescript
/**
 * Check if a value is a TextureUniform
 */
export function isTextureUniform(value: unknown): value is TextureUniform {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value &&
    ("textureObject" in value || value.textureObject === null)
  );
}
```

4. **Update Shader Implementations**

```typescript
// In packages/webgl/src/shaders/add.ts, displace.ts, etc.
// Update texture uniform initialization
const defaultUniforms = {
  u_texture1: createTextureUniform(null, null),
  u_texture2: createTextureUniform(null, null),
  // Other uniforms...
};
```

5. **Update Hook Implementations**

```typescript
// In apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture-add.ts
// Replace isConnected checks with isTextureConnected utility

// Before:
if (isTextureUniform(u[uniformName as keyof typeof u])) {
  (u[uniformName as keyof typeof u] as any) = updateTextureUniform(
    u[uniformName as keyof typeof u] as any,
    sourceId,
    textureObject,
    !!sourceId, // <-- isConnected parameter
  );
}

// After:
if (isTextureUniform(u[uniformName as keyof typeof u])) {
  (u[uniformName as keyof typeof u] as any) = updateTextureUniform(
    u[uniformName as keyof typeof u] as any,
    sourceId,
    textureObject,
  );
}
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
5. **Phase 8** - Simplify TextureUniform type (after all other changes)

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
