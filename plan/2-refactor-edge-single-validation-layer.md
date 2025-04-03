# Edge Validation Simplification Plan

## Current Implementation Analysis

After examining the codebase, I found that edge validation happens at multiple levels:

1. **Handle Level (texture-node.tsx)**:

   - Handles are only rendered based on the texture input types
   - The `textureInputs` array from `getTextureInputsForType(data.type)` determines what handles are available
   - Each handle has properties like `required` that indicate validity

2. **Edge Creation (use-add-edge.tsx)**:

   - The `useAddEdge` hook performs validation via `useEdgeValidation`
   - It validates again whether connections are valid for texture nodes
   - Has special handling for texture connections in `handleTextureConnection`

3. **Edge Replacement (use-replace-edge.tsx)**:

   - The `useReplaceEdge` hook performs similar validations as `useAddEdge`
   - Contains redundant checks that are already handled at the handle level
   - Contains essential validation like `validateSameSource` specific to edge replacement

4. **Workspace Component (workspace.tsx)**:

   - Has connection logic in the `onConnect` method that duplicates edge replacement logic
   - Manages replacing edges for specific handles which is already handled in `useAddEdge`

5. **Validator Hooks (use-validate-edge.tsx)**:
   - All validation functions are bundled in a single hook (`useEdgeValidation`)
   - Components must import the entire validation set even when only using one or two functions
   - Creates unnecessary dependencies and makes code harder to maintain

## Redundancy Identified

The primary redundancy is that validation happens in multiple places:

1. **In use-add-edge.tsx**:

```tsx
// Current redundant validation flow in use-add-edge.tsx
const mutateAsync = useCallback(
  async (connection: Connection) => {
    const { source, target } = connection;

    // These validations are redundant if handles are properly created
    if (
      !validateSelfConnection(source, target) ||
      !validateTargetExistence(target) ||
      !validateMaxIncomingEdges(target) ||
      !validateWindowNode(target)
    ) {
      return;
    }

    // More code...
  },
  [
    /* dependencies */
  ],
);
```

2. **In use-replace-edge.tsx**:

```tsx
// Current redundant validation flow in use-replace-edge.tsx
const mutateAsync = useCallback(
  async (oldEdgeId: string, newConnection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = newConnection;

    if (
      !validateSelfConnection(source, target) ||
      !validateSameSource(source, target) ||
      !validateTargetExistence(target) ||
      !validateMaxIncomingEdges(target, { allowance: 1 }) ||
      !validateWindowNode(target)
    ) {
      return;
    }

    // Mutation code follows...
  },
  [
    /* dependencies */
  ],
);
```

3. **In workspace.tsx**:

```tsx
// Redundant logic for edge handling that duplicates useAddEdge functionality
const onConnect = useCallback(
  async (params: Connection) => {
    // For multi-handle nodes, check if we have a targetHandle specified
    if (params.targetHandle) {
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
    } else {
      // Default behavior for nodes without specific handles
      const existingEdge = edges.find((edge) => edge.target === params.target);

      if (existingEdge) {
        // Replace the existing edge (regardless of its source)
        await replaceEdgeMutate(existingEdge.id, params);
      } else {
        // Add a new edge if the target has no incoming edges
        await addEdgeMutate(params);
      }
    }
  },
  [replaceEdgeMutate, addEdgeMutate, edges],
);
```

## Proposed Implementation

### 1. Refactor the `use-validate-edge.tsx` file to export individual validators:

```tsx
/**
 * Validates that a node is not connecting to itself
 */
export const useSelfConnectionValidator = () => {
  return useCallback((source: string, target: string): boolean => {
    if (source === target) {
      toast({
        variant: "destructive",
        description: "A node cannot connect to itself.",
      });
      return false;
    }
    return true;
  }, []);
};

/**
 * Validates that the source matches the target (used for same-source validation)
 */
export const useSameSourceValidator = () => {
  return useCallback((source: string, target: string): boolean => {
    return source === target;
  }, []);
};

// Other validators refactored similarly...

/**
 * Main hook that provides all edge validation functions
 * Maintained for backward compatibility
 */
export const useEdgeValidation = () => {
  const validateSelfConnection = useSelfConnectionValidator();
  const validateSameSource = useSameSourceValidator();
  const validateTargetExistence = useTargetExistenceValidator();
  const validateWindowNode = useWindowNodeValidator();
  const validateMaxIncomingEdges = useMaxIncomingEdgesValidator();

  return {
    validateSelfConnection,
    validateTargetExistence,
    validateMaxIncomingEdges,
    validateSameSource,
    validateWindowNode,
  };
};
```

### 2. Simplify and Generalize the `useAddEdge` hook:

```tsx
// Simplified and generalized version removing redundant validation and special cases
export const useAddEdge = () => {
  // Import only the validator we need
  const validateSelfConnection = useSelfConnectionValidator();

  // ... existing code

  /**
   * Generalized function to handle all edge connections
   */
  const mutateAsync = useCallback(
    async (connection: Connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;

      // Keep only essential validation
      if (!validateSelfConnection(source, target)) {
        return;
      }

      // Find existing edge to the same target handle (if specified)
      const existingEdge = edges.find(
        (edge) =>
          edge.target === target &&
          ((targetHandle && edge.targetHandle === targetHandle) ||
            // If no targetHandle specified, match any edge to this target
            (!targetHandle && !edge.targetHandle)),
      );

      if (existingEdge) {
        // Replace the existing edge
        return await replaceEdgeMutate(existingEdge.id, connection);
      } else {
        // Add a new edge
        return await createRegularConnection(connection);
      }
    },
    [validateSelfConnection, edges, replaceEdgeMutate, createRegularConnection],
  );

  return { mutateAsync };
};
```

### 3. Simplify the `useReplaceEdge` hook:

```tsx
const useReplaceEdge = () => {
  // Import only the validators we need
  const validateSelfConnection = useSelfConnectionValidator();
  const validateSameSource = useSameSourceValidator();

  // ... existing code

  const mutateAsync = useCallback(
    async (oldEdgeId: string, newConnection: Connection) => {
      const { source, target, sourceHandle, targetHandle } = newConnection;

      // Keep only essential validations
      if (
        !validateSelfConnection(source, target) ||
        !validateSameSource(source, target)
      ) {
        return;
      }

      // Perform the replace mutation
      try {
        await mutReplace({
          oldEdgeId,
          newEdge: {
            id: nanoid(),
            source,
            target,
            sourceHandle,
            targetHandle,
          },
        });
      } catch (error) {
        console.error(error);
        // Additional error handling if needed
      }
    },
    [validateSelfConnection, validateSameSource, mutReplace],
  );

  return { mutateAsync };
};
```

### 4. Simplify the `onConnect` function in workspace.tsx:

```tsx
const onConnect = useCallback(
  async (params: Connection) => {
    // Let useAddEdge handle all the validation, edge detection AND replacement logic
    // Edge replacement will still work because useAddEdge.mutateAsync already
    // checks for existing edges and calls replaceEdgeMutate when needed
    await addEdgeMutate(params);
  },
  [addEdgeMutate],
);
```

## Implementation Steps

1. Refactor `use-validate-edge.tsx`:

   - Split each validation function into its own exported hook (useSelfConnectionValidator, etc.)
   - Update each function with proper JSDoc documentation
   - Maintain the original useEdgeValidation for backward compatibility
   - Ensure all necessary dependencies are properly managed in each hook

2. Edit `use-add-edge.tsx`:

   - Remove the import for the full useEdgeValidation hook
   - Import only the useSelfConnectionValidator hook
   - Remove the unnecessary validation calls in `mutateAsync`
   - Implement the generalized connection logic that works for all node types
   - Remove the special `handleTextureConnection` function completely
   - Keep only the essential `validateSelfConnection` check
   - Update the dependencies array to remove unused dependencies

3. Edit `use-replace-edge.tsx`:

   - Remove the import for the full useEdgeValidation hook
   - Import only the useSelfConnectionValidator and useSameSourceValidator hooks
   - Simplify the validation in `mutateAsync` to only include essential checks
   - Update the dependencies array to remove unused dependencies

4. Edit `workspace.tsx`:

   - Simplify the `onConnect` function to delegate all logic to `addEdgeMutate`
   - Remove the redundant edge-finding and replacement logic
   - Update the dependency array to only include `addEdgeMutate`
   - Remove the unused import for `replaceEdgeMutate` if it becomes unnecessary

5. Test the changes:
   - Verify that connections still work correctly for all node types
   - Ensure multi-handle nodes like texture nodes can still receive connections to their specific inputs
   - Confirm edge replacement logic still functions properly
   - Test with different node types to validate the flow
   - Verify edge replacement functionality continues to work

## Benefits

- ✅ Cleaner, more maintainable code
- ✅ Reduced complexity by trusting the UI layer's validation
- ✅ Better separation of concerns
- ✅ Single source of truth for edge creation logic
- ✅ Slight performance improvement by eliminating redundant checks
- ✅ Less risk of validation inconsistencies
- ✅ Simplified debugging flow - all edge logic in one place
- ✅ More consistent edge handling across regular connections and replacements
- ✅ Generalized approach that works for all node types
- ✅ Future-proof implementation that doesn't require special handling for new node types
- ✅ Reduced code duplication by eliminating special-case functions
- ✅ More modular validation functions that can be imported selectively
