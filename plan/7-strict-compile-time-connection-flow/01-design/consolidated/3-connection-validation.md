# Connection Validation System

## Overview

The connection validation system ensures that connections between nodes have valid handle IDs and follow proper connection rules. It builds on the handle type system to provide compile-time and runtime validation of connections.

## StrictConnection Type

```typescript
import { Connection as BaseConnection } from "@xyflow/react";

import { HandleId, OutputHandleId, TextureHandleId } from "@vendor/db/types";

/**
 * A strictly typed connection with guaranteed valid handle IDs
 */
export interface StrictConnection
  extends Omit<BaseConnection, "sourceHandle" | "targetHandle"> {
  sourceHandle: HandleId;
  targetHandle: HandleId;
}
```

## Type Hierarchy Diagram

```
┌───────────────────────────┐
│                           │
│       BaseConnection      │
│   (@xyflow/react type)    │
│                           │
│  source: string           │
│  target: string           │
│  sourceHandle?: string    │ ◄── Weak typing: any string allowed
│  targetHandle?: string    │
│                           │
└───────────────┬───────────┘
                │
                │ extends & strengthens
                ▼
┌───────────────────────────┐
│                           │
│     StrictConnection      │
│ (custom type enhancement) │
│                           │
│  source: string           │
│  target: string           │
│  sourceHandle: HandleId   │ ◄── Strong typing: branded type
│  targetHandle: HandleId   │ ◄── Required, not optional
│                           │
└───────────────────────────┘
```

## Type Guards and Converters

```typescript
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

## Detailed Validation Results

```typescript
/**
 * Result of validating a connection, with detailed error information if invalid
 */
export type ConnectionValidationResult =
  | { valid: true; connection: StrictConnection }
  | { valid: false; reason: ConnectionValidationError; details: string };

/**
 * Possible validation errors for connections
 */
export enum ConnectionValidationError {
  MISSING_SOURCE_HANDLE = "missing_source_handle",
  MISSING_TARGET_HANDLE = "missing_target_handle",
  INVALID_SOURCE_HANDLE = "invalid_source_handle",
  INVALID_TARGET_HANDLE = "invalid_target_handle",
  INVALID_CONNECTION_TYPE = "invalid_connection_type",
  SELF_CONNECTION = "self_connection",
  UNSUPPORTED_NODE_TYPES = "unsupported_node_types",
}

/**
 * Validate a connection with detailed error information
 */
export function validateConnection(
  connection: BaseConnection,
): ConnectionValidationResult {
  const { source, target, sourceHandle, targetHandle } = connection;

  // Prevent self connections
  if (source === target) {
    return {
      valid: false,
      reason: ConnectionValidationError.SELF_CONNECTION,
      details: "Cannot connect a node to itself",
    };
  }

  if (!sourceHandle) {
    return {
      valid: false,
      reason: ConnectionValidationError.MISSING_SOURCE_HANDLE,
      details: "Source handle is required",
    };
  }

  if (!targetHandle) {
    return {
      valid: false,
      reason: ConnectionValidationError.MISSING_TARGET_HANDLE,
      details: "Target handle is required",
    };
  }

  // Try to convert to strict connection
  const strictConnection = toStrictConnection(connection);
  if (!strictConnection) {
    // Determine which handle is invalid
    const sourceValid =
      createTextureHandleId(sourceHandle) !== null ||
      createOutputHandleId(sourceHandle) !== null;

    const targetValid =
      createTextureHandleId(targetHandle) !== null ||
      createOutputHandleId(targetHandle) !== null;

    if (!sourceValid) {
      return {
        valid: false,
        reason: ConnectionValidationError.INVALID_SOURCE_HANDLE,
        details: `Source handle "${sourceHandle}" is not a valid handle ID`,
      };
    }

    if (!targetValid) {
      return {
        valid: false,
        reason: ConnectionValidationError.INVALID_TARGET_HANDLE,
        details: `Target handle "${targetHandle}" is not a valid handle ID`,
      };
    }

    return {
      valid: false,
      reason: ConnectionValidationError.INVALID_CONNECTION_TYPE,
      details: "Connection could not be converted to a strict connection",
    };
  }

  return {
    valid: true,
    connection: strictConnection,
  };
}
```

## Connection Flow

```
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  React Flow    │    │toStrictConnection│    │  API/Database │
│  Connection    │───►│     function   │───►│   Operation   │
│  (UI Event)    │    │   (Validator)  │    │  (Data Store) │
└───────────────┘    └───────────────┘    └───────────────┘
       │                     │                     │
       │                     │                     │
       ▼                     ▼                     ▼
 string handles      HandleId typed          Strongly typed
 (weakly typed)      (strongly typed)         edge record
```

## React Flow Integration

```typescript
// In apps/app/src/app/(app)/(workspace)/workspace/hooks/use-connection-validator.ts

import { useCallback } from "react";
import { Connection } from "@xyflow/react";

import { toast } from "@repo/ui/hooks/use-toast";

import { validateConnection } from "../types/connection";

export function useConnectionValidator() {
  return useCallback((connection: Connection) => {
    // Validate the connection
    const result = validateConnection(connection);

    if (!result.valid) {
      // Show error message
      toast({
        title: "Invalid Connection",
        description: result.details,
        variant: "destructive",
      });
      return false;
    }

    // Connection is valid
    return true;
  }, []);
}

// Usage in Flow component:
// const isValidConnection = useConnectionValidator();
// <ReactFlow isValidConnection={isValidConnection} ... />
```

## Error Handling Flow

```
User attempts connection → React Flow generates Connection event
↓
validateConnection checks handle validity
↓
┌─────────────────────┐     ┌─────────────────────┐
│ Invalid handles     │     │ Valid handles       │
└─────────┬───────────┘     └─────────┬───────────┘
          │                           │
          ▼                           ▼
 ┌─────────────────┐         ┌─────────────────┐
 │ Show toast      │         │ Process valid   │
 │ Reject connection│         │ connection     │
 └─────────────────┘         └─────────────────┘
```

## Benefits of the Approach

1. **Compile-Time Safety**:

   - TypeScript can detect and prevent invalid handle usage
   - IDE autocomplete for valid handle operations only

2. **Centralized Validation**:

   - Single point of validation logic in `validateConnection`
   - Detailed error messages for different validation failures

3. **Required Handles**:

   - No more incomplete connections with missing handles
   - Clear error messages when handles are missing

4. **Runtime Type Guards**:

   - `isStrictConnection` checks validity at runtime
   - Can be used in conditional logic to handle edge cases

5. **Clean API Boundaries**:
   - UI components work with generic `Connection` type
   - Business logic works with validated `StrictConnection` type
   - Database layer uses `InsertEdge` type with guaranteed valid handles
