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

6. **Server-Side Validation (edge.ts)**:
   - Robust validation exists in the backend TRPC endpoints
   - Validates target node existence, handle constraints, and max edges
   - Provides transactional consistency for edge operations
   - Acts as a safety net for client-side validation

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

## Implementation Plan - Phased Approach

We'll implement the changes in distinct phases to ensure stability and maintain functionality throughout the process.

### Phase 1: Refactor Validation Functions

1. Refactor `use-validate-edge.tsx`:
   - Split each validation function into its own exported hook (useSelfConnectionValidator, etc.)
   - Update each function with proper JSDoc documentation
   - Maintain the original useEdgeValidation for backward compatibility
   - Ensure all necessary dependencies are properly managed in each hook

### Phase 2: Simplify Edge Adding Logic

2. Edit `use-add-edge.tsx`:

   - Remove the import for the full useEdgeValidation hook
   - Import only the useSelfConnectionValidator hook
   - Remove the unnecessary validation calls in `mutateAsync`
   - Implement the generalized connection logic that works for all node types
   - Remove the special `handleTextureConnection` function completely
   - Keep only the essential `validateSelfConnection` check
   - Update the dependencies array to remove unused dependencies
   - Add proper error handling for backend validation failures

3. Edit `workspace.tsx`:
   - Simplify the `onConnect` function to delegate all logic to `addEdgeMutate`
   - Remove the redundant edge-finding and replacement logic
   - Update the dependency array to only include `addEdgeMutate`
   - Remove the unused import for `replaceEdgeMutate` if it becomes unnecessary

### Phase 3: Simplify Edge Replacement Logic

4. Edit `use-replace-edge.tsx`:
   - Remove the import for the full useEdgeValidation hook
   - Import only the useSelfConnectionValidator and useSameSourceValidator hooks
   - Simplify the validation in `mutateAsync` to only include essential checks
   - Update the dependencies array to remove unused dependencies
   - Enhance error handling for backend validation responses

### Phase 4: Address Potential Race Conditions and Edge Cases

For handling race conditions, potential edge cases, and improving error handling, see the separate plan document:
`3-address-race-conditions-edge-cases.md`

## Testing Strategy for Each Phase

After each phase:

- Verify that connections still work correctly for all node types
- Ensure multi-handle nodes like texture nodes can still receive connections to their specific inputs
- Confirm edge replacement logic still functions properly
- Test with different node types to validate the flow
- Verify edge replacement functionality continues to work
- Test error scenarios and ensure proper error handling

## Safety Considerations

- **Leverage Backend Validation**: The server already has robust validation that will catch any issues our simplified client validation might miss
- **Maintain Basic Validation**: Keep the essential validators like self-connection check for immediate UX feedback
- **Enhance Error Handling**: Improve error handling to ensure users get meaningful feedback when backend validation fails
- **Use Transactions**: Both client and server operations use proper transactions for ACID compliance

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
- ✅ Robust protection through backend validation
- ✅ Better error handling and user feedback
