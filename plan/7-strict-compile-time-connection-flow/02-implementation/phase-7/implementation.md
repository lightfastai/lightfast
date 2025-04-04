# Phase 7: Validation Middleware - Implementation

## Overview

This phase implements validation middleware for React Flow to enforce the strict connection types at the highest level. This includes intercepting connection events, validating them, and providing clear feedback to users about invalid connections.

## Implementation Details

### ConnectionValidationMiddleware Component

```typescript
// apps/app/src/app/app/(workspace)/workspace/components/flow/ConnectionValidationMiddleware.tsx
import { ReactNode, useCallback, useState } from "react";
import {
  Connection,
  Edge,
  useReactFlow,
  OnConnect,
  OnConnectStart,
  OnConnectEnd,
} from "@xyflow/react";

import {
  useEdgeStore
} from "../../providers/edge-store-provider";

import {
  useToast
} from "../../providers/toast-provider";

import {
  useValidateTextureConnection,
} from "../../hooks/use-validate-texture-connection";

import {
  ConnectionValidationResult,
} from "../../types/connection";

interface ConnectionValidationMiddlewareProps {
  children: ReactNode;
}

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

  // When connection starts
  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    setConnectionInProgress({
      source: params.nodeId || null,
      sourceHandle: params.handleId || null,
    });

    // Reset any previous invalid connection state
    setInvalidConnection(null);
  }, []);

  // When connection ends
  const onConnectEnd: OnConnectEnd = useCallback(() => {
    setConnectionInProgress(null);

    // Clear invalid connection after a delay
    if (invalidConnection) {
      setTimeout(() => {
        setInvalidConnection(null);
      }, 2000);
    }
  }, [invalidConnection]);

  // When connection is complete
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // Validate connection
      const validationResult = validateTextureConnection(connection);

      if (!validationResult.valid) {
        // Handle invalid connection
        setInvalidConnection({
          source: connection.source || null,
          sourceHandle: connection.sourceHandle || null,
          target: connection.target || null,
          targetHandle: connection.targetHandle || null,
          message: validationResult.details,
        });

        // Show error toast
        toast({
          title: "Invalid Connection",
          description: validationResult.details,
          variant: "destructive",
        });

        return;
      }

      // Process valid connection
      const strictConnection = validationResult.connection;

      // Create edge with validated connection
      const newEdge: Edge = {
        id: `edge-${Math.random()}`,
        source: strictConnection.source,
        target: strictConnection.target,
        sourceHandle: strictConnection.sourceHandle,
        targetHandle: strictConnection.targetHandle,
      };

      // Add to the edge store
      addEdge(newEdge);

      // Add to React Flow
      setEdges((edges) => [...edges, newEdge]);

      // Clear invalid connection state
      setInvalidConnection(null);
    },
    [addEdge, setEdges, toast, validateTextureConnection]
  );

  // Render connection validation middleware
  return (
    <>
      {children}

      {/* Invalid connection indicator */}
      {invalidConnection && (
        <div className="invalid-connection-indicator" data-testid="invalid-connection">
          <div className="invalid-connection-message">
            {invalidConnection.message}
          </div>
        </div>
      )}

      {/* Pass connection handlers to React Flow */}
      <div
        className="flow-connection-handler"
        data-onconnect={JSON.stringify({
          onConnectStart,
          onConnectEnd,
          onConnect,
        })}
      />
    </>
  );
};
```

### FlowComponent Integration

```typescript
// apps/app/src/app/app/(workspace)/workspace/components/flow/FlowComponent.tsx
import {
  ReactFlowProvider,
  ReactFlow,
  Background,
  Controls,
} from "@xyflow/react";

import { ConnectionValidationMiddleware } from "./ConnectionValidationMiddleware";
import { EdgeLine } from "./EdgeLine";
import { TextureNode } from "../nodes/TextureNode";

// Define node types
const nodeTypes = {
  texture: TextureNode,
  // other node types...
};

// Define edge types
const edgeTypes = {
  default: EdgeLine,
  // other edge types...
};

export const FlowComponent = () => {
  // React Flow configuration

  return (
    <ReactFlowProvider>
      <ConnectionValidationMiddleware>
        <ReactFlow
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionLineComponent={ConnectionLine}
          // Other props...
        >
          <Background />
          <Controls />
        </ReactFlow>
      </ConnectionValidationMiddleware>
    </ReactFlowProvider>
  );
};
```

### Custom Connection Line with Validation

```typescript
// apps/app/src/app/app/(workspace)/workspace/components/flow/ConnectionLine.tsx
import { ConnectionLineComponentProps } from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";

import { useValidateTextureConnection } from "../../hooks/use-validate-texture-connection";

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

  // Calculate cubic bezier path
  const path = `M${fromX},${fromY} C${fromX + 50},${fromY} ${toX - 50},${toY} ${toX},${toY}`;

  return (
    <g>
      <path
        d={path}
        style={lineStyle}
        fill="none"
        className="connection-line"
      />

      {/* Show invalid marker if connection is invalid */}
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

### CSS Styles

```css
/* apps/app/src/app/app/(workspace)/workspace/components/flow/connection-validation.css */

.invalid-connection-indicator {
  position: absolute;
  z-index: 1000;
  padding: 8px 12px;
  background-color: #ff5252;
  border-radius: 4px;
  box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  animation: fadeIn 0.2s ease-out;
}

.invalid-connection-message {
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.invalid-connection-marker {
  animation: pulse 1s infinite;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.5;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
```

## Implementation Notes

1. The `ConnectionValidationMiddleware` component provides a high-level validation layer that intercepts all connection events.

2. Visual feedback is provided through:

   - Dynamic connection line styling
   - Invalid connection markers
   - Error tooltips
   - Toast notifications

3. The validation system integrates with:

   - React Flow's connection events
   - The edge store
   - The texture validation system
   - The toast notification system

4. The connection line component provides real-time validation feedback as users drag connections.

5. CSS animations and transitions provide smooth visual feedback for better user experience.
