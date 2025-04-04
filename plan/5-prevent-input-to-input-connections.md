# Preventing Input-to-Input Connections Implementation Plan

## Issue Analysis

After examining the current edge connection system, we've identified that the application doesn't prevent invalid connection types:

1. **Input-to-Input Connections**: Users can connect an input handle of one node to an input handle of another node.
2. **Output-to-Output Connections**: Similarly, output handles can be connected to other output handles.

These invalid connections break the logical flow of data in the node graph and can lead to unpredictable behavior.

## Affected Components

The following components need modification to implement proper connection validation:

1. **Validation Logic**:

   - `apps/app/src/app/(app)/(workspace)/workspace/hooks/use-validate-edge.tsx` - Add a new validator function

2. **Connection Handling**:
   - `apps/app/src/app/(app)/(workspace)/workspace/components/workspace/workspace.tsx` - Update onConnect function

## Implementation Plan

### Phase 1: Add Handle Type Validation Logic

**File**: `apps/app/src/app/(app)/(workspace)/workspace/hooks/use-validate-edge.tsx`

Create a new validator function that ensures connections only flow from outputs to inputs:

```typescript
/**
 * Validates that connections only flow from output handles to input handles.
 * @returns A function that checks if the connection is valid based on handle types.
 */
export const useHandleTypeValidator = () => {
  return useCallback(
    (sourceHandle: string | null, targetHandle: string | null): boolean => {
      // Source handles should be outputs, target handles should be inputs
      const isOutputHandle = (handle: string | null) =>
        handle?.includes("output");
      const isInputHandle = (handle: string | null) =>
        handle?.includes("input");

      if (!isOutputHandle(sourceHandle) || !isInputHandle(targetHandle)) {
        toast({
          variant: "destructive",
          description:
            "Invalid connection: Can only connect from output to input.",
        });
        return false;
      }
      return true;
    },
    [],
  );
};
```

### Phase 2: Update Workspace Connection Logic

**File**: `apps/app/src/app/(app)/(workspace)/workspace/components/workspace/workspace.tsx`

1. Import the new validator function:

```typescript
import {
  useHandleTypeValidator,
  useSelfConnectionValidator,
} from "../../hooks/use-validate-edge";
```

2. Initialize the validator in the component:

```typescript
const validateHandleTypes = useHandleTypeValidator();
```

3. Update the onConnect function to use the new validator:

```typescript
const onConnect = useCallback(
  async (params: Connection) => {
    // Require explicit targetHandle for all connections
    if (!params.targetHandle) {
      toast({
        title: "Connection Failed",
        description: "Missing target handle specification",
        variant: "destructive",
      });
      return;
    }

    // Validate handle types (outputs must connect to inputs)
    if (!validateHandleTypes(params.sourceHandle, params.targetHandle)) {
      return;
    }

    // Find any existing edge that connects TO the same handle of the target node
    const existingEdge = edges.find(
      (edge) =>
        edge.target === params.target &&
        edge.targetHandle === params.targetHandle,
    );

    if (existingEdge) {
      // Replace the existing edge for this specific handle
      await replaceEdgeMutate(existingEdge.id, params);
    } else {
      // Add a new edge to this specific handle
      await addEdgeMutate(params);
    }
  },
  [replaceEdgeMutate, addEdgeMutate, edges, toast, validateHandleTypes],
);
```

### Phase 3: Enhance Connection Mode in ReactFlow

**File**: `apps/app/src/app/(app)/(workspace)/workspace/components/workspace/workspace.tsx`

Update the ReactFlow configuration to use strict connection mode:

```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}
  onEdgesChange={onEdgesChange}
  onNodesChange={onNodesChange}
  onDelete={onDelete}
  onConnect={onConnect}
  nodeTypes={nodeTypes}
  onClick={onClick}
  onMouseMove={onMouseMove}
  connectionMode={ConnectionMode.Strict} // Change from Loose to Strict
  selectionOnDrag={false}
  panOnScroll={true}
  zoomOnScroll={false}
  proOptions={{ hideAttribution: true }}
  minZoom={0.25}
>
  {selection && render()}
  <Background variant={BackgroundVariant.Dots} />
</ReactFlow>
```

## Benefits

This implementation provides several key benefits:

1. ✅ **Logical Integrity**: Ensures data flows correctly from outputs to inputs
2. ✅ **User Feedback**: Provides clear error messages for invalid connection attempts
3. ✅ **Consistent Behavior**: Works across all node types in the application
4. ✅ **Client-side Validation**: Prevents invalid connections before they're attempted

## Testing Strategy

After implementing the changes, we should test:

1. **Connection Validation**:

   - Attempt to connect an input handle to another input handle (should fail)
   - Attempt to connect an output handle to another output handle (should fail)
   - Verify that output to input connections work correctly

2. **Error Messaging**:

   - Confirm that appropriate error messages appear for invalid connection attempts

3. **Edge Cases**:
   - Test connections with nodes that have multiple inputs/outputs
   - Test with programmatically created connections

## Compatibility

This change builds on our previous edge validation enhancements by adding type-specific validation. It's compatible with the existing explicit handle requirement and edge replacement logic.

## Conclusion

By implementing this validation, we'll create a more intuitive and error-resistant connection system that guides users toward creating valid node graphs. This addresses a critical usability issue while maintaining the flexibility of the node connection system.
