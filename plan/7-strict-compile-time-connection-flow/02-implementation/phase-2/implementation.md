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

## Unit Tests

Create a new test file to verify the functionality of the strict connection type:

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/types/__tests__/connection.test.ts
import { Connection } from "@xyflow/react";

import {
  createOutputHandleId,
  createTextureHandleId,
  OutputHandleId,
  TextureHandleId,
} from "@vendor/db/types";

import {
  ConnectionValidationError,
  createStrictConnection,
  isStrictConnection,
  StrictConnection,
  toStrictConnection,
  validateConnection,
} from "../connection";

describe("StrictConnection", () => {
  // Valid handles for testing
  const textureHandle: TextureHandleId = createTextureHandleId("input-1")!;
  const outputHandle: OutputHandleId = createOutputHandleId("output-main")!;

  test("isStrictConnection validates connections", () => {
    // Valid connection with texture handles
    const validConnection1: Connection = {
      source: "node1",
      target: "node2",
      sourceHandle: "output-main",
      targetHandle: "input-1",
    };

    // Valid connection with mix of handle types
    const validConnection2: Connection = {
      source: "node1",
      target: "node2",
      sourceHandle: "output-main",
      targetHandle: "input-1",
    };

    // Invalid connection - missing source handle
    const invalidConnection1: Connection = {
      source: "node1",
      target: "node2",
      targetHandle: "input-1",
    };

    // Invalid connection - invalid handle format
    const invalidConnection2: Connection = {
      source: "node1",
      target: "node2",
      sourceHandle: "invalid",
      targetHandle: "input-1",
    };

    expect(isStrictConnection(validConnection1)).toBe(true);
    expect(isStrictConnection(validConnection2)).toBe(true);
    expect(isStrictConnection(invalidConnection1)).toBe(false);
    expect(isStrictConnection(invalidConnection2)).toBe(false);
  });

  test("toStrictConnection converts valid connections", () => {
    const validConnection: Connection = {
      source: "node1",
      target: "node2",
      sourceHandle: "output-main",
      targetHandle: "input-1",
    };

    const strictConnection = toStrictConnection(validConnection);
    expect(strictConnection).not.toBeNull();
    if (strictConnection) {
      expect(strictConnection.source).toBe("node1");
      expect(strictConnection.target).toBe("node2");
      expect(strictConnection.sourceHandle).toBe("output-main");
      expect(strictConnection.targetHandle).toBe("input-1");
    }
  });

  test("toStrictConnection returns null for invalid connections", () => {
    // Missing source handle
    const invalidConnection1: Connection = {
      source: "node1",
      target: "node2",
      targetHandle: "input-1",
    };

    // Invalid handle format
    const invalidConnection2: Connection = {
      source: "node1",
      target: "node2",
      sourceHandle: "invalid",
      targetHandle: "input-1",
    };

    expect(toStrictConnection(invalidConnection1)).toBeNull();
    expect(toStrictConnection(invalidConnection2)).toBeNull();
  });

  test("validateConnection provides detailed error information", () => {
    // Missing source handle
    const noSourceHandle: Connection = {
      source: "node1",
      target: "node2",
      targetHandle: "input-1",
    };

    // Missing target handle
    const noTargetHandle: Connection = {
      source: "node1",
      target: "node2",
      sourceHandle: "output-main",
    };

    // Invalid source handle format
    const invalidSourceHandle: Connection = {
      source: "node1",
      target: "node2",
      sourceHandle: "invalid",
      targetHandle: "input-1",
    };

    // Invalid target handle format
    const invalidTargetHandle: Connection = {
      source: "node1",
      target: "node2",
      sourceHandle: "output-main",
      targetHandle: "invalid",
    };

    // Valid connection
    const validConnection: Connection = {
      source: "node1",
      target: "node2",
      sourceHandle: "output-main",
      targetHandle: "input-1",
    };

    const result1 = validateConnection(noSourceHandle);
    expect(result1.valid).toBe(false);
    if (!result1.valid) {
      expect(result1.reason).toBe(
        ConnectionValidationError.MISSING_SOURCE_HANDLE,
      );
    }

    const result2 = validateConnection(noTargetHandle);
    expect(result2.valid).toBe(false);
    if (!result2.valid) {
      expect(result2.reason).toBe(
        ConnectionValidationError.MISSING_TARGET_HANDLE,
      );
    }

    const result3 = validateConnection(invalidSourceHandle);
    expect(result3.valid).toBe(false);
    if (!result3.valid) {
      expect(result3.reason).toBe(
        ConnectionValidationError.INVALID_SOURCE_HANDLE,
      );
    }

    const result4 = validateConnection(invalidTargetHandle);
    expect(result4.valid).toBe(false);
    if (!result4.valid) {
      expect(result4.reason).toBe(
        ConnectionValidationError.INVALID_TARGET_HANDLE,
      );
    }

    const result5 = validateConnection(validConnection);
    expect(result5.valid).toBe(true);
    if (result5.valid) {
      expect(result5.connection.source).toBe("node1");
      expect(result5.connection.target).toBe("node2");
      expect(result5.connection.sourceHandle).toBe("output-main");
      expect(result5.connection.targetHandle).toBe("input-1");
    }
  });

  test("createStrictConnection creates a valid connection", () => {
    const connection = createStrictConnection(
      "node1",
      "node2",
      outputHandle,
      textureHandle,
    );

    expect(connection.source).toBe("node1");
    expect(connection.target).toBe("node2");
    expect(connection.sourceHandle).toBe(outputHandle);
    expect(connection.targetHandle).toBe(textureHandle);

    // TypeScript should recognize this as a StrictConnection
    const typedConnection: StrictConnection = connection;
    expect(typedConnection).toBe(connection);
  });
});
```

## Implementation Notes

1. The `StrictConnection` interface extends the base React Flow `Connection` type but requires the source and target handles to be properly typed.

2. We provide utility functions:

   - `isStrictConnection`: Type guard to check if a connection has valid handle IDs
   - `toStrictConnection`: Converter from base Connection to StrictConnection
   - `validateConnection`: Detailed validation with specific error information
   - `createStrictConnection`: Factory function for creating valid connections

3. This phase only introduces the type system and utility functions, but does not yet enforce their use in React Flow or the edge store. Those changes will come in later phases.

## Migration Impact

This change introduces the new type system for connections but does not yet enforce its use in the application. Existing code will continue to work with the React Flow Connection type, while new code can opt-in to the stronger type safety.

The detailed validation error information will be useful for providing better error messages to users in Phase 7.
