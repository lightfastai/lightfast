# Connection Validation Design

## Overview

The Connection Validation system provides comprehensive validation for connections between nodes, ensuring type safety and correctness. It serves as a single source of truth for validation rules, providing consistent error reporting and both compile-time and runtime validation.

## Design Goals

1. **Type Safety**: Enforce correct handle types at compile time
2. **Single Source of Truth**: Centralize validation logic
3. **Detailed Error Reporting**: Provide clear error information
4. **Performance**: Minimize validation overhead
5. **Backward Compatibility**: Support existing code

## Core Components

### StrictConnection Interface

```typescript
// Type-safe connection interface
export interface StrictConnection
  extends Omit<Connection, "sourceHandle" | "targetHandle"> {
  sourceHandle: HandleId;
  targetHandle: HandleId;
}
```

Benefits:

- Type-safe alternative to React Flow's Connection type
- Guarantees valid handle types at compile time
- Compatible with React Flow's Connection interface
- Used in all internal operations

### Validation Result Type

```typescript
// Result of validating a connection
export type ConnectionValidationResult =
  | { valid: true; connection: StrictConnection }
  | { valid: false; reason: ConnectionValidationError; details: string };

// Enumeration of validation error types
export enum ConnectionValidationError {
  MISSING_SOURCE_HANDLE = "missing_source_handle",
  MISSING_TARGET_HANDLE = "missing_target_handle",
  INVALID_SOURCE_HANDLE = "invalid_source_handle",
  INVALID_TARGET_HANDLE = "invalid_target_handle",
  INVALID_CONNECTION_TYPE = "invalid_connection_type",
  NODE_NOT_FOUND = "node_not_found",
  INCOMPATIBLE_TYPES = "incompatible_types",
}
```

Benefits:

- Discriminated union for type-safe handling
- Detailed error information with reason and message
- Categorized errors for consistent handling
- Access to validated connection when successful

### Validation Function

```typescript
// Main validation function
export function validateConnection(
  connection: Connection,
): ConnectionValidationResult {
  // Basic validation
  if (!connection.sourceHandle) {
    return {
      valid: false,
      reason: ConnectionValidationError.MISSING_SOURCE_HANDLE,
      details: "Source handle is required",
    };
  }

  if (!connection.targetHandle) {
    return {
      valid: false,
      reason: ConnectionValidationError.MISSING_TARGET_HANDLE,
      details: "Target handle is required",
    };
  }

  // Handle format validation
  const strictConnection = toStrictConnection(connection);
  if (!strictConnection) {
    // Determine which handle is invalid...
    return {
      valid: false,
      reason: ConnectionValidationError.INVALID_SOURCE_HANDLE,
      details: "Invalid source handle format",
    };
  }

  // Type compatibility validation
  const sourceIsOutput = isOutputHandleId(strictConnection.sourceHandle);
  const targetIsInput = isTextureHandleId(strictConnection.targetHandle);

  if (!sourceIsOutput || !targetIsInput) {
    return {
      valid: false,
      reason: ConnectionValidationError.INVALID_CONNECTION_TYPE,
      details: "Connections must be from output to input handles",
    };
  }

  // Valid connection
  return {
    valid: true,
    connection: strictConnection,
  };
}
```

Benefits:

- Step-by-step validation with early returns
- Detailed error information for each failure
- Type-safe result with discriminated union
- Returns a guaranteed valid connection when successful

### Connection Conversion

```typescript
// Convert base connection to strict connection
export function toStrictConnection(
  connection: Connection,
): StrictConnection | null {
  const { sourceHandle, targetHandle, ...rest } = connection;

  // Validate handles exist
  if (!sourceHandle || !targetHandle) {
    return null;
  }

  // Try to parse as valid handle types
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

  // Return typed connection
  return {
    ...rest,
    sourceHandle: typedSourceHandle,
    targetHandle: typedTargetHandle,
  };
}
```

Benefits:

- Clear pathway from untyped to typed connections
- Handles both input and output handle formats
- Safe null return for invalid connections
- Preserves other connection properties

## Connection Validation Hook

```typescript
// React hook for connection validation
export function useValidateConnection() {
  const { nodes } = useNodeStore();
  const { textureTypes } = useTextureRegistry();

  // Memoize the validation function
  const validateConnectionWithContext = useCallback(
    (connection: Connection): ConnectionValidationResult => {
      // Basic validation
      const baseResult = validateConnection(connection);
      if (!baseResult.valid) {
        return baseResult;
      }

      // Get nodes
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) {
        return {
          valid: false,
          reason: ConnectionValidationError.NODE_NOT_FOUND,
          details: "Source or target node not found",
        };
      }

      // Get node types
      const sourceType = getNodeType(sourceNode);
      const targetType = getNodeType(targetNode);

      // Validate compatibility based on node types
      // ... node-specific validation logic

      // Return valid connection
      return baseResult;
    },
    [nodes, textureTypes],
  );

  return validateConnectionWithContext;
}
```

Benefits:

- Contextual validation with access to node store
- Extended validation beyond basic handle format
- Memoized function to prevent unnecessary recreation
- Consistent error reporting with base validation

## Validation Middleware

```typescript
// React component for validation middleware
export const ConnectionValidationMiddleware = ({
  children,
}: { children: ReactNode }) => {
  const { addEdge } = useEdgeStore();
  const validateConnection = useValidateConnection();

  // Handle connection creation
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // Validate connection
      const result = validateConnection(connection);

      if (!result.valid) {
        // Show error and return
        console.warn(`Invalid connection: ${result.details}`);
        return;
      }

      // Create edge from valid connection
      const strictConnection = result.connection;
      const newEdge = {
        id: `edge-${Date.now()}`,
        source: strictConnection.source,
        target: strictConnection.target,
        sourceHandle: strictConnection.sourceHandle,
        targetHandle: strictConnection.targetHandle,
      };

      addEdge(newEdge);
    },
    [addEdge, validateConnection]
  );

  return (
    <>
      {children}
      {/* Hidden component passing the handler to React Flow */}
      <div data-onconnect={JSON.stringify({ onConnect })} />
    </>
  );
};
```

Benefits:

- Intercepts all connection events
- Validates before creating edges
- Centralizes connection handling
- Wraps React Flow without modifying it

## Progressive Validation

Connection validation occurs at multiple levels, allowing invalid connections to be caught at the earliest possible stage:

1. **Compile Time**: TypeScript enforces correct handle types in typed code
2. **Component Time**: Handle components validate IDs during render
3. **Connection Time**: Validation middleware validates connections before creation
4. **API Time**: Server-side validation ensures database integrity

This progressive approach ensures issues are caught as early as possible while maintaining safety at all levels.

## Validation Visualization

The system includes visual feedback for validation:

```typescript
// Connection line component with validation
export const ConnectionLine = ({
  fromNode,
  fromHandle,
  toX,
  toY,
  toNode,
  toHandle,
}: ConnectionLineComponentProps) => {
  const validateConnection = useValidateConnection();
  const [isValid, setIsValid] = useState(true);

  // Validate connection during dragging
  useEffect(() => {
    if (fromNode && fromHandle && toNode && toHandle) {
      const result = validateConnection({
        source: fromNode,
        sourceHandle: fromHandle,
        target: toNode,
        targetHandle: toHandle,
      });

      setIsValid(result.valid);
    }
  }, [fromNode, fromHandle, toNode, toHandle, validateConnection]);

  // Render connection line with validation status
  return (
    <g>
      <path
        d={/* ... */}
        style={{
          stroke: isValid ? "#b1b1b7" : "#ff5555",
          strokeDasharray: isValid ? "none" : "5,5",
        }}
      />
      {!isValid && <circle cx={toX} cy={toY} r={5} fill="#ff5555" />}
    </g>
  );
};
```

Benefits:

- Real-time feedback during connection creation
- Clear visual indication of validity
- Consistent styling for invalid connections
- Immediate user feedback

## Error Reporting System

The connection validation system integrates with a toast notification system for user feedback:

```typescript
// Error reporting for invalid connections
function reportInvalidConnection(result: ConnectionValidationResult) {
  if (!result.valid) {
    toast({
      title: "Invalid Connection",
      description: result.details,
      variant: "destructive",
    });
  }
}
```

Benefits:

- Consistent error messaging
- Non-disruptive user feedback
- Clear explanation of validation failures
- User-friendly experience

## Performance Optimization

Several optimizations ensure validation is fast:

1. **Caching**: Validation results are cached when possible
2. **Early Returns**: Validation fails fast for obvious issues
3. **Memoization**: Validation functions are memoized with useCallback
4. **Type Safety**: Most errors are caught at compile time

The system is designed to validate connections in under 10ms to ensure a responsive user experience.
