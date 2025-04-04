# Phase 4: UI Components - Implementation

## Overview

This phase focuses on updating the UI components to use the new strongly typed handle IDs. The key components being updated are the texture handle components, edge components, and node components. These changes will ensure type safety at the component level and provide better visual feedback for connection validation.

## Implementation Details

### TextureHandle Component Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/nodes/TextureHandle.tsx
import { Position } from "@xyflow/react";
import { DetailedHTMLProps, HTMLAttributes } from "react";
import { Handle } from "@xyflow/react";
import { cn } from "@repo/ui";

import {
  TextureHandleId,
  isTextureHandleId,
} from "@vendor/db/types";

// Update props to use TextureHandleId
export interface TextureHandleProps
  extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  id: TextureHandleId;
  position?: Position;
  hideIfConnected?: boolean;
  isConnected?: boolean;
  isConnectable?: boolean;
  connectionIndicator?: boolean;
}

export const TextureHandle = ({
  id,
  position = Position.Left,
  hideIfConnected = false,
  isConnected = false,
  isConnectable = true,
  connectionIndicator = true,
  className,
  ...props
}: TextureHandleProps) => {
  // Runtime validation as a safety measure
  if (!isTextureHandleId(id)) {
    console.warn(`Invalid TextureHandleId: ${id}`);
    return null;
  }

  // Hide handle if it's connected and hideIfConnected is true
  if (hideIfConnected && isConnected) {
    return null;
  }

  return (
    <div
      className={cn(
        "texture-handle-container",
        isConnected && "is-connected",
        className
      )}
      data-testid={`handle-${id}`}
      data-handleid={id}
      {...props}
    >
      <Handle
        type="target"
        position={position}
        id={id} // ID is now type-safe
        isConnectable={isConnectable}
        className={cn(
          "texture-handle",
          isConnected && "connected",
          connectionIndicator && "with-indicator"
        )}
      />

      {/* Connection indicator (optional) */}
      {connectionIndicator && isConnected && (
        <div className="connection-indicator" />
      )}
    </div>
  );
};
```

### OutputHandle Component Implementation

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/nodes/OutputHandle.tsx
import { Position } from "@xyflow/react";
import { DetailedHTMLProps, HTMLAttributes } from "react";
import { Handle } from "@xyflow/react";
import { cn } from "@repo/ui";

import {
  OutputHandleId,
  isOutputHandleId,
} from "@vendor/db/types";

// Output handle props with OutputHandleId
export interface OutputHandleProps
  extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  id: OutputHandleId;
  position?: Position;
  hideIfConnected?: boolean;
  isConnected?: boolean;
  isConnectable?: boolean;
  connectionIndicator?: boolean;
}

export const OutputHandle = ({
  id,
  position = Position.Right,
  hideIfConnected = false,
  isConnected = false,
  isConnectable = true,
  connectionIndicator = true,
  className,
  ...props
}: OutputHandleProps) => {
  // Runtime validation as a safety measure
  if (!isOutputHandleId(id)) {
    console.warn(`Invalid OutputHandleId: ${id}`);
    return null;
  }

  // Hide handle if it's connected and hideIfConnected is true
  if (hideIfConnected && isConnected) {
    return null;
  }

  return (
    <div
      className={cn(
        "output-handle-container",
        isConnected && "is-connected",
        className
      )}
      data-testid={`handle-${id}`}
      data-handleid={id}
      {...props}
    >
      <Handle
        type="source"
        position={position}
        id={id} // ID is now type-safe
        isConnectable={isConnectable}
        className={cn(
          "output-handle",
          isConnected && "connected",
          connectionIndicator && "with-indicator"
        )}
      />

      {/* Connection indicator (optional) */}
      {connectionIndicator && isConnected && (
        <div className="connection-indicator" />
      )}
    </div>
  );
};
```

### TextureNode Component Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/nodes/TextureNode.tsx
import { NodeProps } from "@xyflow/react";
import { memo, useMemo } from "react";
import { cn } from "@repo/ui";

import {
  createTextureHandleIds,
  OutputHandleId,
  TextureHandleId,
  createOutputHandleId,
} from "@vendor/db/types";

import { getTextureInputsForType } from "@repo/webgl";
import { TextureHandle } from "./TextureHandle";
import { OutputHandle } from "./OutputHandle";
import { useConnections } from "../../hooks/use-connections";

interface TextureNodeData {
  type: string;
  // Other texture node properties...
}

const TextureNodeBase = ({
  id,
  data,
  selected,
}: NodeProps<TextureNodeData>) => {
  const { getConnectionsForNode } = useConnections();
  const nodeConnections = getConnectionsForNode(id);

  // Get texture type
  const textureType = data.type || "default";

  // Get input metadata for this texture type
  const textureInputs = getTextureInputsForType(textureType);

  // Create texture handle IDs with proper typing
  const textureHandles = useMemo(
    () => createTextureHandleIds(textureInputs.length),
    [textureInputs.length]
  );

  // Create output handle ID with proper typing
  const outputHandle = useMemo(
    () => createOutputHandleId("output-main")!,
    []
  );

  // Check which handles are connected
  const isConnected = (handleId: TextureHandleId | OutputHandleId) => {
    return nodeConnections.some(
      conn => conn.sourceHandle === handleId || conn.targetHandle === handleId
    );
  };

  return (
    <div className={cn("texture-node", selected && "selected")}>
      <div className="node-header">
        <div className="node-title">{textureType}</div>
      </div>

      <div className="node-content">
        {/* Input handles */}
        <div className="input-handles">
          {textureHandles.map((handleId, index) => {
            const input = textureInputs[index];
            return (
              <div key={handleId} className="input-container">
                <TextureHandle
                  id={handleId}
                  isConnected={isConnected(handleId)}
                  isConnectable={true}
                  connectionIndicator={true}
                />
                <span className="input-label">{input.description}</span>
              </div>
            );
          })}
        </div>

        {/* Output handle */}
        <div className="output-handles">
          <div className="output-container">
            <span className="output-label">Output</span>
            <OutputHandle
              id={outputHandle}
              isConnected={isConnected(outputHandle)}
              isConnectable={true}
              connectionIndicator={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Memoize the component for performance
export const TextureNode = memo(TextureNodeBase);
```

### EdgeLine Component Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/flow/EdgeLine.tsx
import { BaseEdge, EdgeProps, getStraightPath } from "@xyflow/react";
import { memo } from "react";
import { cn } from "@repo/ui";

import {
  HandleId,
  createOutputHandleId,
  createTextureHandleId,
} from "@vendor/db/types";

import { toStrictConnection } from "../../types/connection";

const EdgeLineBase = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandle,
  targetHandle,
  style = {},
  markerEnd,
}: EdgeProps) => {
  // Try to convert to strict connection for type safety
  let safeSourceHandle: HandleId;
  let safeTargetHandle: HandleId;

  const strictConnection = toStrictConnection({
    source,
    target,
    sourceHandle,
    targetHandle,
  });

  if (strictConnection) {
    // Use the validated handles from the strict connection
    safeSourceHandle = strictConnection.sourceHandle;
    safeTargetHandle = strictConnection.targetHandle;
  } else {
    // Fallback to defaults if conversion fails
    console.warn(`Invalid connection for edge ${id}, using default handles`);

    // Use types that make sense for the common case
    safeSourceHandle = createOutputHandleId("output-main")!;
    safeTargetHandle = createTextureHandleId("input-1")!;
  }

  // Get path
  const [path, centerX, centerY] = getStraightPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={{
        ...style,
        stroke: "#b1b1b7",
        strokeWidth: 2,
      }}
      className={cn("edge-line")}
    />
  );
};

// Memoize the component for performance
export const EdgeLine = memo(EdgeLineBase);
```

### ConnectionLine Component Implementation

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/flow/ConnectionLine.tsx
import { ConnectionLineComponentProps } from "@xyflow/react";
import { useEffect, useState } from "react";

import { useValidateConnection } from "../../hooks/use-validate-connection";

export const ConnectionLine = ({
  fromNode,
  fromHandle,
  fromX,
  fromY,
  toX,
  toY,
  toNode,
  toHandle,
}: ConnectionLineComponentProps) => {
  const validateConnection = useValidateConnection();
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
      const validationResult = validateConnection(tempConnection);
      setIsValid(validationResult.valid);
    } else {
      // Default to valid when not fully connected
      setIsValid(true);
    }
  }, [fromNode, fromHandle, toNode, toHandle, validateConnection]);

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

### InvalidConnectionIndicator Component

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/flow/InvalidConnectionIndicator.tsx
export interface InvalidConnectionIndicatorProps {
  message: string;
  position?: { x: number; y: number };
}

export const InvalidConnectionIndicator = ({
  message,
  position,
}: InvalidConnectionIndicatorProps) => {
  // If no position is provided, render in the center of the screen
  const style = position
    ? { top: position.y + 20, left: position.x }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div
      className="invalid-connection-indicator"
      style={style}
      data-testid="invalid-connection"
    >
      <div className="invalid-connection-message">
        {message}
      </div>
    </div>
  );
};
```

## CSS Styles

Add the following CSS styles to support the updated components:

```css
/* apps/app/src/app/(app)/(workspace)/workspace/components/nodes/handle-styles.css */

/* Texture Handle Styles */
.texture-handle-container {
  position: relative;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.texture-handle {
  width: 12px !important;
  height: 12px !important;
  background-color: #424242 !important;
  border: 2px solid #666 !important;
  border-radius: 6px !important;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.texture-handle.connected {
  background-color: #4caf50 !important;
  border-color: #2e7d32 !important;
}

.texture-handle-container:hover .texture-handle {
  background-color: #5c6bc0 !important;
  border-color: #3949ab !important;
}

/* Output Handle Styles */
.output-handle-container {
  position: relative;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.output-handle {
  width: 12px !important;
  height: 12px !important;
  background-color: #424242 !important;
  border: 2px solid #666 !important;
  border-radius: 6px !important;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.output-handle.connected {
  background-color: #ff9800 !important;
  border-color: #e65100 !important;
}

.output-handle-container:hover .output-handle {
  background-color: #5c6bc0 !important;
  border-color: #3949ab !important;
}

/* Connection Indicator */
.connection-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  background-color: #fff;
  border-radius: 3px;
  pointer-events: none;
}

/* Invalid Connection Indicator */
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
```

## Unit Tests

Create unit tests for the updated components:

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/nodes/__tests__/TextureHandle.test.tsx
import { render, screen } from "@testing-library/react";
import { TextureHandle } from "../TextureHandle";
import { generateTextureHandleId } from "@vendor/db/types";

describe("TextureHandle", () => {
  test("renders with valid handle ID", () => {
    const handle = generateTextureHandleId(0); // input-1

    render(
      <TextureHandle id={handle} data-testid="test-handle" />
    );

    expect(screen.getByTestId("test-handle")).toBeInTheDocument();
    expect(screen.getByTestId(`handle-${handle}`)).toBeInTheDocument();
  });

  test("shows connection indicator when connected", () => {
    const handle = generateTextureHandleId(0);

    render(
      <TextureHandle
        id={handle}
        isConnected={true}
        connectionIndicator={true}
      />
    );

    expect(screen.getByTestId(`handle-${handle}`)).toHaveClass("is-connected");
    expect(document.querySelector(".connection-indicator")).toBeInTheDocument();
  });

  test("doesn't render when hideIfConnected is true and isConnected is true", () => {
    const handle = generateTextureHandleId(0);

    render(
      <TextureHandle
        id={handle}
        isConnected={true}
        hideIfConnected={true}
      />
    );

    expect(screen.queryByTestId(`handle-${handle}`)).not.toBeInTheDocument();
  });
});
```

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/flow/__tests__/ConnectionLine.test.tsx
import { render, screen } from "@testing-library/react";
import { ConnectionLine } from "../ConnectionLine";

// Mock the validation hook
jest.mock("../../hooks/use-validate-connection", () => ({
  useValidateConnection: () => (connection) => {
    // Return valid for specific test connections, invalid otherwise
    const isValid = connection.sourceHandle === "output-main" &&
                   connection.targetHandle === "input-1";

    return {
      valid: isValid,
      ...(isValid
        ? { connection }
        : { reason: "invalid_connection", details: "Invalid connection" })
    };
  }
}));

describe("ConnectionLine", () => {
  test("renders valid connection with correct style", () => {
    render(
      <ConnectionLine
        fromNode="node1"
        fromHandle="output-main"
        toNode="node2"
        toHandle="input-1"
        fromX={0}
        fromY={0}
        toX={100}
        toY={100}
      />
    );

    const path = document.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("stroke", "#b1b1b7");
    expect(path).toHaveAttribute("stroke-dasharray", "none");

    // No error marker should be present
    expect(document.querySelector("circle")).not.toBeInTheDocument();
  });

  test("renders invalid connection with error style", () => {
    render(
      <ConnectionLine
        fromNode="node1"
        fromHandle="invalid-handle"
        toNode="node2"
        toHandle="input-1"
        fromX={0}
        fromY={0}
        toX={100}
        toY={100}
      />
    );

    const path = document.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("stroke", "#ff5555");
    expect(path).toHaveAttribute("stroke-dasharray", "5,5");

    // Error marker should be present
    const errorMarker = document.querySelector("circle");
    expect(errorMarker).toBeInTheDocument();
    expect(errorMarker).toHaveAttribute("fill", "#ff5555");
  });
});
```

## Implementation Notes

1. **Component Props**: All component props now use the branded types to ensure type safety.

2. **Runtime Validation**: Although the type system ensures compile-time safety, we still include runtime validation as a safeguard for dynamically created components and for better developer experience.

3. **Visual Feedback**: We've enhanced the visual feedback for connections:

   - Connected handles show different colors
   - Hover states provide visual cues
   - Invalid connections show dashed red lines
   - Error tooltips show validation messages

4. **Performance Optimization**: Components are memoized to prevent unnecessary re-renders.

5. **Backward Compatibility**: The components handle both typed and untyped data through converters like `toStrictConnection`.

## Migration Impact

These changes affect the UI components but don't change their behavior from the user's perspective. Existing code that uses these components may need updates to pass the proper handle types, but the components themselves include fallbacks for backward compatibility.

The most visible change for users will be the enhanced visual feedback for invalid connections, which improves usability.
