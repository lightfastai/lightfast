# Migration Guide: Strict Compile-Time Connection Flow

## Overview

This guide is for developers migrating code to use the new Strict Compile-Time Connection Flow system. The new system provides enhanced type safety for connections between nodes, with compile-time validation of handle IDs and a single source of truth for connection validation.

## Migration Timeline

- **Current Phase**: Preparation and documentation
- **Migration Start**: [START_DATE]
- **Adoption Deadline**: [END_DATE] (3 months after release)
- **Legacy Support Ends**: [LEGACY_END_DATE] (6 months after release)

## Key Changes

1. **Branded Types for Handles**: New TypeScript branded types for handle IDs
2. **Strict Connection Interface**: Type-safe connection interface
3. **Enhanced Validation**: Better connection validation with detailed error reporting
4. **WebGL Registry Integration**: Texture registry integrated with handle types
5. **Connection Middleware**: New middleware for connection validation

## Migrating Existing Code

### Step 1: Update Handle References

#### Before:

```typescript
// Using string handles
function connectNodes(sourceHandle: string, targetHandle: string) {
  // Check handle format at runtime
  if (!isValidTextureHandleId(targetHandle)) {
    throw new Error("Invalid target handle");
  }

  // Create connection
  // ...
}
```

#### After:

```typescript
// Using branded types
import { HandleId, OutputHandleId, TextureHandleId } from "@vendor/db/types";

function connectNodes(sourceHandle: HandleId, targetHandle: TextureHandleId) {
  // Types are already validated at compile-time
  // Create connection
  // ...
}
```

### Step 2: Use Constructor Functions

#### Before:

```typescript
// Constructing handles as strings
const handleId = `input-${index + 1}`;
node.addHandle(handleId);
```

#### After:

```typescript
// Using constructor functions
import { generateTextureHandleId } from "@vendor/db/types";

const handleId = generateTextureHandleId(index);
node.addHandle(handleId);
```

### Step 3: Update Component Props

#### Before:

```typescript
interface HandleProps {
  id: string;
  // Other props
}

// Component usage
<Handle id="input-1" />
```

#### After:

```typescript
interface HandleProps {
  id: TextureHandleId;
  // Other props
}

// Component usage
const handleId = generateTextureHandleId(0); // Creates "input-1"
<Handle id={handleId} />
```

### Step 4: Adopt StrictConnection

#### Before:

```typescript
import { Connection } from "@xyflow/react";

function addEdge(connection: Connection) {
  // Manual validation
  if (!connection.sourceHandle || !connection.targetHandle) {
    return false;
  }

  // Add edge
  // ...
}
```

#### After:

```typescript
import { Connection } from "@xyflow/react";

import { toStrictConnection, validateConnection } from "../types/connection";

function addEdge(connection: Connection) {
  // Use validation utility
  const validationResult = validateConnection(connection);

  if (!validationResult.valid) {
    console.warn(`Invalid connection: ${validationResult.details}`);
    return false;
  }

  // Use guaranteed valid connection
  const strictConnection = validationResult.connection;

  // Add edge with typed handles
  // ...
}
```

### Step 5: Update Edge Store Usage

#### Before:

```typescript
// Creating edges with untyped handles
edgeStore.addEdge({
  id: "edge-1",
  source: "node-1",
  target: "node-2",
  sourceHandle: "output-main",
  targetHandle: "input-1",
});
```

#### After:

```typescript
// Creating edges with typed handles
import { createOutputHandleId, createTextureHandleId } from "@vendor/db/types";

const sourceHandle = createOutputHandleId("output-main")!;
const targetHandle = createTextureHandleId("input-1")!;

edgeStore.addEdge({
  id: "edge-1",
  source: "node-1",
  target: "node-2",
  sourceHandle,
  targetHandle,
});
```

### Step 6: Adopt Validation Middleware

#### Before:

```typescript
<ReactFlow
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  onConnect={handleConnect}
  // Other props
/>
```

#### After:

```typescript
<ConnectionValidationMiddleware>
  <ReactFlow
    nodeTypes={nodeTypes}
    edgeTypes={edgeTypes}
    // No need for onConnect, middleware handles it
    // Other props
  />
</ConnectionValidationMiddleware>
```

### Step 7: Update WebGL Integration

#### Before:

```typescript
// Getting uniform name from handle
const uniformName = getUniformNameFromTextureHandleId(handleId);
```

#### After:

```typescript
// No change needed if using the updated utility function
// It now accepts both string and TextureHandleId types
const uniformName = getUniformNameFromTextureHandleId(handleId);

// For new code, use the typed version
const uniformName = getUniformName(textureHandleId);
```

## Testing Migrated Code

1. **Compile-Time Checks**: Ensure TypeScript compiles without errors
2. **Unit Tests**: Run unit tests to validate functionality
3. **Integration Tests**: Run integration tests to verify end-to-end flow
4. **Migration Tests**: Run migration tests to validate data compatibility

## Common Migration Issues

### Issue: Type Errors During Compilation

```
Type 'string' is not assignable to type 'TextureHandleId'
```

**Solution**: Use constructor functions like `createTextureHandleId` or `generateTextureHandleId` to create properly typed handles.

### Issue: Runtime Type Validation Errors

```
Invalid texture handle: "input-invalid"
```

**Solution**: Ensure your code uses the correct format for handles, and use the validation utilities to check handles at runtime when working with external data.

### Issue: Connection Validation Fails

```
Invalid connection: Source handle "invalid" is not a valid handle ID
```

**Solution**: Use the `validateConnection` utility to get detailed error information, and ensure connections use properly formatted handles.

### Issue: Component Props Type Errors

```
Type '{ id: string; ... }' is not assignable to type '{ id: TextureHandleId; ... }'
```

**Solution**: Update component props to use the new handle types, and ensure you pass properly typed values.

## Feature Flag Support

During the migration period, you can use feature flags to toggle between the legacy and new behavior:

```typescript
if (featureFlags.strictConnectionFlow) {
  // Use new typed approach
  const handleId = generateTextureHandleId(index);
} else {
  // Legacy approach
  const handleId = `input-${index + 1}`;
}
```

## API Changes Reference

### New Types

- `TextureHandleId`: Branded type for texture input handles
- `OutputHandleId`: Branded type for node output handles
- `HandleId`: Union type for all handle types
- `StrictConnection`: Strictly typed connection interface

### New Functions

- `createTextureHandleId(value: string): TextureHandleId | null`: Create a texture handle ID from string
- `createOutputHandleId(value: string): OutputHandleId | null`: Create an output handle ID from string
- `generateTextureHandleId(index: number): TextureHandleId`: Generate a texture handle ID from index
- `generateOutputHandleId(name: string): OutputHandleId | null`: Generate an output handle ID from name
- `isTextureHandleId(value: unknown): value is TextureHandleId`: Type guard for texture handles
- `isOutputHandleId(value: unknown): value is OutputHandleId`: Type guard for output handles
- `validateConnection(connection: Connection): ConnectionValidationResult`: Validate a connection

### New Components

- `TextureHandle`: Typed component for texture input handles
- `OutputHandle`: Typed component for node output handles
- `ConnectionValidationMiddleware`: Middleware for connection validation

## Support Resources

- **Documentation**: [Link to documentation]
- **Example Code**: [Link to example repository]
- **Migration Repository**: [Link to migration examples]
- **Support Channel**: [Link to Slack channel]

## Timeline for Legacy Code Removal

1. **Phase 1 (Immediate)**: Begin migrating new code to use new types
2. **Phase 2 (1 month)**: Migrate existing components to use new types
3. **Phase 3 (2 months)**: Update all edge store and connection handling code
4. **Phase 4 (3 months)**: Complete migration of all code
5. **Phase 5 (6 months)**: Remove legacy code paths and type support
