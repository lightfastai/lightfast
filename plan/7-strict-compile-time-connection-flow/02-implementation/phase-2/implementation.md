# Phase 2: Strict Connection Type - Implementation

## File Creation

Create a new file for the strict connection type and related utilities:

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/types/connection.ts
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

/**
 * Create a StrictConnection from scratch with guaranteed valid handles
 */
export function createStrictConnection(
  sourceId: string,
  targetId: string,
  sourceHandle: HandleId,
  targetHandle: HandleId,
): StrictConnection {
  return {
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
  };
}
```

## Implementation Notes

1. The `StrictConnection` interface extends the base React Flow `Connection` type but requires the source and target handles to be properly typed.

2. We provide utility functions:

   - `isStrictConnection`: Type guard to check if a connection has valid handle IDs
   - `toStrictConnection`: Converter from base Connection to StrictConnection
   - `validateConnection`: Detailed validation with specific error information
   - `createStrictConnection`: Factory function for creating valid connections

3. This phase only introduces the type system and utility functions, but does not yet enforce their use in React Flow or the edge store. Those changes will come in later phases.
