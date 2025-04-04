# Phase 7: Validation Middleware - Specification

## Overview

This phase implements validation middleware for React Flow to enforce the strict connection types at the highest level. This includes intercepting connection events, validating them, and providing clear feedback to users about invalid connections.

## Requirements

1. Create a validation middleware for React Flow
2. Implement visual feedback for invalid connections
3. Add error tooltips for better user experience
4. Integrate with the existing validation system
5. Ensure backward compatibility with existing code

## Technical Design

### ConnectionValidationMiddleware Component

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/flow/ConnectionValidationMiddleware.tsx
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
// apps/app/src/app/(app)/(workspace)/workspace/components/flow/FlowComponent.tsx
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
// apps/app/src/app/(app)/(workspace)/workspace/components/flow/ConnectionLine.tsx
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

  // Change style based on validity
  const lineStyle = {
    stroke: isValid ? '#b1b1b7' : '#ff5555',
    strokeWidth: 2,
    strokeDasharray: isValid ? 'none' : '5,5',
  };

  // Calculate path
  const fromX = fromPosition?.x || 0;
  const fromY = fromPosition?.y || 0;

  return (
    <g>
      <path
        d={`M${fromX},${fromY} C${fromX + 50},${fromY} ${toX - 50},${toY} ${toX},${toY}`}
        style={lineStyle}
        fill="none"
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

### Toast Provider for Error Messages

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/providers/toast-provider.tsx
import { createContext, ReactNode, useCallback, useContext, useState } from "react";

interface Toast {
  id: string;
  title: string;
  description: string;
  variant: "default" | "destructive" | "success";
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((newToast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { ...newToast, id }]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      dismissToast(id);
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismissToast }}>
      {children}

      {/* Render toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.variant}`}>
            <div className="toast-header">
              <h4>{t.title}</h4>
              <button onClick={() => dismissToast(t.id)}>×</button>
            </div>
            <div className="toast-body">{t.description}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
```

## Dependencies

1. Phase 1: Enhanced Handle Types - The branded types are used throughout
2. Phase 2: Connection Types - StrictConnection and validation utilities
3. Phase 5: Hook Logic - Integration with connection hooks
4. Phase 6: WebGL Registry - Use of the texture validation hooks

## Impact Analysis

| Component                      | Changes Required                                    |
| ------------------------------ | --------------------------------------------------- |
| ConnectionValidationMiddleware | New component to intercept and validate connections |
| ConnectionLine                 | Updated to provide visual feedback                  |
| FlowComponent                  | Integration with the validation middleware          |
| ToastProvider                  | New provider for error messages                     |

## Acceptance Criteria

1. ✅ ConnectionValidationMiddleware intercepts and validates all connections
2. ✅ Invalid connections show visual feedback to the user
3. ✅ Error tooltips provide clear information about validation failures
4. ✅ The middleware integrates with the existing validation system
5. ✅ React Flow continues to function as expected
6. ✅ All tests continue to pass
