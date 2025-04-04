# Addressing Race Conditions and Edge Cases in Edge Handling

This document outlines Phase 4 of the edge validation simplification plan, focusing on handling potential race conditions, edge cases, and improving error handling.

## Problem Areas

After simplifying the validation logic in Phases 1-3, several edge cases require attention:

1. **Race Conditions**:

   - A user might attempt to create multiple connections to the same handle in rapid succession
   - Several async operations might conflict when modifying the same edge
   - The optimistic UI updates could become inconsistent with server state

2. **Edge Cases**:

   - Error handling might be insufficient when backend validation fails
   - Users might not receive clear feedback about why a connection failed
   - UI state might become inconsistent if optimistic updates aren't properly cleaned up

3. **Potential Bugs**:
   - Self-connections might still occur in edge cases
   - Stale references could lead to unexpected behavior
   - Network failures could leave the application in an inconsistent state

## Implementation Plan

### 1. Implement Connection Locking Mechanism

Add a mechanism to track pending connections and prevent duplicate requests:

```typescript
// In useAddEdge.tsx
const pendingConnections = useRef(new Set());

const mutateAsync = useCallback(
  async (connection: Connection) => {
    const { target, targetHandle } = connection;
    const connectionKey = `${target}-${targetHandle || "default"}`;

    // Prevent duplicate connections in progress
    if (pendingConnections.current.has(connectionKey)) {
      return;
    }

    try {
      pendingConnections.current.add(connectionKey);

      // Existing connection logic...
      if (!validateSelfConnection(source, target)) {
        return;
      }

      // Find existing edge to the same target handle (if specified)
      const existingEdge = edges.find(
        (edge) =>
          edge.target === target &&
          ((targetHandle && edge.targetHandle === targetHandle) ||
            (!targetHandle && !edge.targetHandle)),
      );

      if (existingEdge) {
        return await replaceEdgeMutate(existingEdge.id, connection);
      } else {
        return await createRegularConnection(connection);
      }
    } finally {
      pendingConnections.current.delete(connectionKey);
    }
  },
  [validateSelfConnection, edges, replaceEdgeMutate, createRegularConnection],
);
```

### 2. Enhance Error Handling

Improve error handling to provide clear feedback and clean up optimistic updates:

```typescript
// In the mutation error handler for useAddEdge
const { mutateAsync: mut } = api.tenant.edge.create.useMutation({
  onMutate: (newEdge) => {
    const optimisticEdge: BaseEdge = {
      id: newEdge.id,
      source: newEdge.edge.source,
      target: newEdge.edge.target,
      sourceHandle: newEdge.edge.sourceHandle,
      targetHandle: newEdge.edge.targetHandle,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addEdge(optimisticEdge);
    return { optimisticEdge };
  },
  onError: (err, _newEdge, context) => {
    if (!context) return;

    // Remove the optimistic edge
    deleteEdge(context.optimisticEdge.id);

    // Add more detailed error messages based on error type
    let errorMessage = "Failed to add edge";

    if (err instanceof TRPCClientError) {
      // Extract the specific error message from the TRPC error
      errorMessage = err.message;
    }

    toast({
      title: "Connection Failed",
      description: errorMessage,
      variant: "destructive",
    });
  },
});
```

Apply similar error handling to `useReplaceEdge`:

```typescript
// In the mutation error handler for useReplaceEdge
onError: (err, variables, context) => {
  if (context?.oldEdge) {
    // Rollback: restore the old edge
    addEdge(context.oldEdge);

    // Get detailed error message
    let errorMessage = "Failed to replace edge";
    if (err instanceof TRPCClientError) {
      errorMessage = err.message;
    }

    toast({
      title: "Edge Replacement Failed",
      description: errorMessage,
      variant: "destructive",
    });
  }
},
```

### 3. Implement Edge State Reconciliation

For handling more complex scenarios or recovering from errors, implement a state reconciliation function:

```typescript
// In a shared utility file or in edge-store-provider.tsx
const reconcileEdgeState = useCallback(async () => {
  try {
    // Fetch current edges from server
    const serverEdges = await api.tenant.edge.getAll.fetch({
      workspaceId: currentWorkspaceId,
    });

    // Reset local state to match server
    resetEdges(serverEdges);
  } catch (error) {
    console.error("Failed to reconcile edge state:", error);
    toast({
      title: "Synchronization Error",
      description: "Failed to synchronize edge state with server",
      variant: "destructive",
    });
  }
}, [currentWorkspaceId, resetEdges]);

// Add a public method to trigger reconciliation
useImperativeHandle(ref, () => ({
  reconcileEdgeState,
}));
```

### 4. Add Debouncing for Rapid Connections

Implement debouncing to handle rapid connection attempts:

```typescript
// In workspace.tsx
const debouncedOnConnect = useMemo(() => {
  return debounce(async (params: Connection) => {
    await addEdgeMutate(params);
  }, 100); // 100ms debounce time
}, [addEdgeMutate]);

const onConnect = useCallback(
  (params: Connection) => {
    // Use debounced version to prevent multiple rapid connections
    debouncedOnConnect(params);
  },
  [debouncedOnConnect],
);
```

## Testing Strategy

To verify these improvements, test the following scenarios:

1. **Race Condition Testing**:

   - Attempt to rapidly create multiple connections to the same handle
   - Simulate network delays to test how the application handles concurrent operations
   - Try to create and delete the same edge in rapid succession

2. **Error Handling Testing**:

   - Simulate backend validation failures and verify proper error messages
   - Check that optimistic updates are correctly rolled back on failure
   - Verify that the UI remains in a consistent state after errors

3. **Edge Case Testing**:
   - Test with various node types and handle configurations
   - Verify behavior when network connection is lost during operations
   - Test with very large numbers of nodes and edges

## Success Criteria

These improvements will be considered successful if:

- ✅ Rapid connection attempts don't create duplicate or inconsistent edges
- ✅ Users receive clear, specific error messages when connections fail
- ✅ The UI state remains consistent with server state
- ✅ Edge operations are properly serialized to prevent race conditions
- ✅ Error recovery maintains application consistency

## Implementation Timeline

This phase should be implemented after the core refactoring (Phases 1-3) is complete and tested. It can be done incrementally:

1. First implement the connection locking mechanism
2. Then enhance error handling
3. Add state reconciliation as a fallback mechanism
4. Finally implement debouncing for rapid connections

Each step should be tested independently before moving to the next.
