# Phase 2: Strict Connection Type - Specification

## Overview

This phase implements a strictly typed Connection interface that guarantees valid handle IDs. This builds on the enhanced handle ID types from Phase 1 and provides compile-time validation of connection parameters.

## Requirements

1. Create a strictly typed Connection interface that enforces correct handle ID types
2. Implement converters between React Flow's Connection type and our strict type
3. Provide type guards to check if a connection uses valid handle IDs
4. Maintain backward compatibility with existing code

## Technical Design

### StrictConnection Interface

```typescript
// In apps/app/src/app/(app)/(workspace)/workspace/types/connection.ts
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

### Type Guards and Converters

```typescript
/**
 * Type guard to check if a connection is a StrictConnection with valid handle IDs
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

### ConnectionValidationResult Type

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
}

/**
 * Validate a connection with detailed error information
 */
export function validateConnection(
  connection: BaseConnection,
): ConnectionValidationResult {
  const { sourceHandle, targetHandle } = connection;

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

## Dependencies

Phase 1: Enhanced Handle Types - The branded types from Phase 1 are used in the connection interface.

## Impact Analysis

| Component             | Changes Required                    |
| --------------------- | ----------------------------------- |
| Connection interface  | New type in a new file              |
| Connection validation | New utility functions in same file  |
| useAddEdge            | No changes yet (handled in Phase 5) |
| Flow component        | No changes yet (handled in Phase 7) |

## Acceptance Criteria

1. ✅ `StrictConnection` interface enforces correct handle ID types
2. ✅ `toStrictConnection` converts React Flow connections to strict connections
3. ✅ `isStrictConnection` correctly identifies connections with valid handle IDs
4. ✅ `validateConnection` provides detailed error information for invalid connections
5. ✅ All existing tests continue to pass
