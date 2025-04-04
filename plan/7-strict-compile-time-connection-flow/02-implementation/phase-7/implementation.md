# Phase 7: Validation Middleware - Implementation

## Overview

This phase implements the validation middleware with the new TextureHandle interface and proper architectural boundaries.

## Implementation Details

### Connection Types Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/types/connection.ts
import type { Connection as BaseConnection } from "@xyflow/react";

import type { TextureHandle } from "@repo/webgl";
import type { OutputHandleId } from "@vendor/db/types";

export interface StrictConnection {
  source: string;
  target: string;
  sourceHandle: OutputHandleId;
  targetHandle: TextureHandle;
}

export type ConnectionValidationResult =
  | { valid: true; connection: StrictConnection }
  | { valid: false; reason: ConnectionValidationError; details: string };

export function validateConnection(
  connection: BaseConnection,
): ConnectionValidationResult {
  const { sourceHandle, targetHandle } = connection;

  // Validate source handle (output)
  if (!isOutputHandleId(sourceHandle)) {
    return {
      valid: false,
      reason: ConnectionValidationError.INVALID_HANDLE_TYPE,
      details: "Source must be an output handle",
    };
  }

  // Validate target handle (texture)
  const textureHandle = createTextureHandle(targetHandle);
  if (!textureHandle) {
    return {
      valid: false,
      reason: ConnectionValidationError.INVALID_HANDLE_TYPE,
      details: "Target must be a valid texture handle",
    };
  }

  return {
    valid: true,
    connection: {
      ...connection,
      sourceHandle,
      targetHandle: textureHandle,
    },
  };
}
```

### ConnectionValidationMiddleware Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/flow/ConnectionValidationMiddleware.tsx
import type { TextureHandle } from "@repo/webgl";

export const ConnectionValidationMiddleware = ({
  children,
}: ConnectionValidationMiddlewareProps) => {
  const { addEdge } = useEdgeStore();
  const { toast } = useToast();
  const { validateTextureConnection } = useValidateTextureConnection();
  const { setEdges } = useReactFlow();

  // Keep track of connection state
  const [connectionInProgress, setConnectionInProgress] = useState<{
    source: string | null;
    sourceHandle: string | null;
  } | null>(null);

  // Track invalid connection for visual feedback
  const [invalidConnection, setInvalidConnection] = useState<{
    source: string | null;
    sourceHandle: string | null;
    target: string | null;
    targetHandle: string | null;
    message: string;
  } | null>(null);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const validationResult = validateTextureConnection(connection);

      if (!validationResult.valid) {
        setInvalidConnection({
          source: connection.source || null,
          sourceHandle: connection.sourceHandle || null,
          target: connection.target || null,
          targetHandle: connection.targetHandle || null,
          message: validationResult.details,
        });

        toast({
          title: "Invalid Connection",
          description: validationResult.details,
          variant: "destructive",
        });

        return;
      }

      const strictConnection = validationResult.connection;

      // Create edge with validated connection
      const newEdge: Edge = {
        id: `edge-${Math.random()}`,
        source: strictConnection.source,
        target: strictConnection.target,
        sourceHandle: strictConnection.sourceHandle,
        targetHandle: strictConnection.targetHandle.id, // Use handle ID for edge
      };

      addEdge(newEdge);
      setEdges((edges) => [...edges, newEdge]);
      setInvalidConnection(null);
    },
    [addEdge, setEdges, toast, validateTextureConnection],
  );

  // ... rest of implementation ...
};
```

### Custom Connection Line with Validation

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/flow/ConnectionLine.tsx
import type { TextureHandle } from "@repo/webgl";

export const ConnectionLine = ({
  fromNode,
  fromHandle,
  toX,
  toY,
  toNode,
  toHandle,
}: ConnectionLineComponentProps) => {
  const { validateTextureConnection } = useValidateTextureConnection();
  const [isValid, setIsValid] = useState<boolean>(true);

  // Dynamically validate as the user is dragging the connection
  useEffect(() => {
    if (fromNode && fromHandle && toNode && toHandle) {
      // Create a temporary connection object for validation
      const tempConnection = {
        source: fromNode,
        sourceHandle: fromHandle,
        target: toNode,
        targetHandle: toHandle,
      };

      // Validate the temporary connection
      const validationResult = validateTextureConnection(tempConnection);
      setIsValid(validationResult.valid);
    } else {
      // Default to valid when not fully connected
      setIsValid(true);
    }
  }, [fromNode, fromHandle, toNode, toHandle, validateTextureConnection]);

  // Style based on validity
  const lineStyle = {
    stroke: isValid ? '#b1b1b7' : '#ff5555',
    strokeWidth: 2,
    strokeDasharray: isValid ? 'none' : '5,5',
  };

  return (
    <g>
      <path
        d={`M${fromX},${fromY} C${fromX + 50},${fromY} ${toX - 50},${toY} ${toX},${toY}`}
        style={lineStyle}
        fill="none"
        className="connection-line"
      />
      {!isValid && toNode && toHandle && (
        <circle
          cx={toX}
          cy={toY}
          r={5}
          fill="#ff5555"
          className="invalid-connection-marker"
        />
      )}
    </g>
  );
};
```

## Implementation Notes

1. **Type-Safe Connections**:

   - Strict typing for connections using `TextureHandle`
   - Clear validation boundaries
   - Proper error handling and feedback

2. **Validation Flow**:

   - Connection validation happens at multiple levels
   - Visual feedback for invalid connections
   - Clear error messages for users

3. **Handle Management**:

   - Proper handling of both output and texture handles
   - Clear distinction between handle types
   - Consistent handle-to-uniform mapping

4. **User Experience**:
   - Real-time validation feedback
   - Clear visual indicators
   - Helpful error messages
   - Smooth animations and transitions
