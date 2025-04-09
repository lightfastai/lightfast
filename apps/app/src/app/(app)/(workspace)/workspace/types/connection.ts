import type { Connection as BaseConnection } from "@xyflow/react";

import type { InputHandleId, OutputHandleId } from "@vendor/db/types";
import {
  createInputHandleId,
  createOutputHandleId,
  isInputHandleId,
  isOutputHandleId,
} from "@vendor/db/types";

/**
 * A strictly typed connection with guaranteed valid handle IDs
 */
export interface StrictConnection
  extends Omit<BaseConnection, "sourceHandle" | "targetHandle"> {
  sourceHandle: OutputHandleId;
  targetHandle: InputHandleId;
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
    (isInputHandleId(connection.sourceHandle) ||
      isOutputHandleId(connection.sourceHandle)) &&
    (isInputHandleId(connection.targetHandle) ||
      isOutputHandleId(connection.targetHandle))
  );
}

/**
 * Convert a standard React Flow connection to a strict connection
 * Returns null if the connection is invalid
 */
export function convertToStrictConnection(
  connection: BaseConnection,
): StrictConnection | null {
  const { sourceHandle, targetHandle, ...rest } = connection;

  // Validate both handles exist
  if (!sourceHandle || !targetHandle) {
    return null;
  }

  // Try to parse as either input or output handle
  const _outputHandle = createOutputHandleId(sourceHandle);
  const _inputHandle = createInputHandleId(targetHandle);

  if (!_outputHandle || !_inputHandle) {
    return null;
  }

  return {
    ...rest,
    sourceHandle: _outputHandle,
    targetHandle: _inputHandle,
  };
}
