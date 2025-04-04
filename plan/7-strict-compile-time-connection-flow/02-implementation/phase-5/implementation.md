# Phase 5: Hook Logic - Implementation

## Overview

This phase refactors the React hooks that manage connections and edges to use the new type system while maintaining compatibility with the existing edge store. The focus is on enhancing type safety and validation while preserving the current store's functionality.

## Implementation Details

### 1. Edge Store Types and Imports

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/stores/edge-store.ts
import type { OnEdgesChange } from "@xyflow/react";
import { applyEdgeChanges } from "@xyflow/react";
import { createStore } from "zustand";

import type { InsertEdge } from "@vendor/db/schema";
import { validateEdgeHandles } from "@vendor/db/schema";
import { prepareEdgeForInsert } from "@vendor/db/utils/edge-utils";

import type { BaseEdge } from "../types/node";

interface EdgeState {
  edges: BaseEdge[];
}

export interface EdgeActions {
  addEdge: (edge: BaseEdge) => void;
  deleteEdge: (id: string) => void;
  onEdgesChange: OnEdgesChange<BaseEdge>;
  setEdges: (edges: BaseEdge[]) => void;
}

export type EdgeStore = EdgeState & EdgeActions;

export const defaultEdgeState: EdgeState = {
  edges: [],
};

export const createEdgeStore = (initState: EdgeState = defaultEdgeState) => {
  return createStore<EdgeStore>()((set) => ({
    ...initState,
    addEdge: (edge) => {
      try {
        // Use the new prepareEdgeForInsert for validation
        const validEdge = prepareEdgeForInsert(edge as InsertEdge);
        set((state) => ({ edges: [...state.edges, validEdge as BaseEdge] }));
      } catch (error) {
        console.error("Invalid edge:", error, edge);
      }
    },
    deleteEdge: (id) =>
      set((state) => ({
        edges: applyEdgeChanges([{ id, type: "remove" }], state.edges),
      })),
    onEdgesChange: (changes) =>
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
      })),
    setEdges: (edges) => {
      try {
        // Validate all edges using prepareEdgeForInsert
        const validEdges = edges.map(
          (edge) => prepareEdgeForInsert(edge as InsertEdge) as BaseEdge,
        );
        set({ edges: validEdges });
      } catch (error) {
        console.error("Some edges had invalid handles:", error);
      }
    },
  }));
};
```

### 2. Connection Validation Hook

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-connection-validation.ts
import type { Connection } from "@xyflow/react";
import { useCallback } from "react";

import type { HandleId, InsertEdge } from "@vendor/db/schema";
import { useToast } from "@repo/ui/hooks/use-toast";
import { validateEdgeHandles } from "@vendor/db/schema";
import { prepareEdgeForInsert } from "@vendor/db/utils/edge-utils";

export interface ConnectionValidationResult {
  valid: boolean;
  error?: string;
  validatedEdge?: InsertEdge;
}

export const useConnectionValidation = () => {
  const { toast } = useToast();

  const validateConnection = useCallback(
    (connection: Connection): ConnectionValidationResult => {
      try {
        // Try to prepare the edge with validation
        const validatedEdge = prepareEdgeForInsert({
          ...connection,
          sourceHandle: connection.sourceHandle as HandleId,
          targetHandle: connection.targetHandle as HandleId,
        } as InsertEdge);

        // Additional validation for handle compatibility
        if (!validateEdgeHandles(validatedEdge)) {
          throw new Error(
            "Invalid connection: source must be an output handle and target must be a texture handle",
          );
        }

        return {
          valid: true,
          validatedEdge,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Invalid connection";

        toast({
          title: "Invalid Connection",
          description: errorMessage,
          variant: "destructive",
        });

        return {
          valid: false,
          error: errorMessage,
        };
      }
    },
    [toast],
  );

  return {
    validateConnection,
  };
};
```

### 3. Add Edge Hook

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-add-edge.ts
import type { Connection } from "@xyflow/react";
import { useCallback } from "react";

import type { InsertEdge } from "@vendor/db/schema";
import { nanoid } from "@repo/lib";

import type { BaseEdge } from "../types/node";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useConnectionValidation } from "./use-connection-validation";

export const useAddEdge = () => {
  const { addEdge } = useEdgeStore();
  const { validateConnection } = useConnectionValidation();

  const handleAddEdge = useCallback(
    async (connection: Connection) => {
      const validationResult = validateConnection(connection);

      if (!validationResult.valid || !validationResult.validatedEdge) {
        return false;
      }

      const validatedEdge = validationResult.validatedEdge;

      // Create edge with validated connection
      const newEdge: BaseEdge = {
        id: nanoid(),
        ...validatedEdge,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        addEdge(newEdge);
        return true;
      } catch (error) {
        console.error("Failed to add edge:", error);
        return false;
      }
    },
    [addEdge, validateConnection],
  );

  return handleAddEdge;
};
```

### 4. Dynamic Connections Hook

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-dynamic-connections.ts
import type { Connection } from "@xyflow/react";
import { useCallback, useState } from "react";

import { useConnectionValidation } from "./use-connection-validation";

export const useDynamicConnections = () => {
  const [lastValidationError, setLastValidationError] = useState<string | null>(
    null,
  );
  const { validateConnection } = useConnectionValidation();

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const result = validateConnection(connection);

      if (!result.valid) {
        setLastValidationError(result.error || "Invalid connection");
        return false;
      }

      setLastValidationError(null);
      return true;
    },
    [validateConnection],
  );

  return {
    isValidConnection,
    lastValidationError,
  };
};
```

## Implementation Notes

1. **Edge Store Updates**:

   - Now correctly imports `prepareEdgeForInsert` from `@vendor/db/utils/edge-utils`
   - Handles type casting between `BaseEdge` and `InsertEdge`
   - Maintains proper validation flow
   - Preserves existing store functionality while adding enhanced validation

2. **Connection Validation**:

   - Uses both `prepareEdgeForInsert` and `validateEdgeHandles`
   - Provides detailed validation results with proper typing
   - Handles errors gracefully with toast notifications
   - Centralizes validation logic for reuse

3. **Add Edge Flow**:

   - Uses validated edges from the validation hook
   - Maintains proper type safety throughout the flow
   - Preserves existing functionality with enhanced validation
   - Handles edge creation with proper error handling

4. **Dynamic Connections**:
   - Integrates with the new validation system
   - Provides real-time validation feedback
   - Maintains error state for UI feedback
   - Enables React Flow to show validation state during connection attempts

## Dependencies

1. Phase 1: Enhanced Handle Types - The branded types are used in hook parameters
2. Phase 2: Connection Types - StrictConnection is used in hook logic
3. Phase 3: Edge Schema - The updated Edge schema and utilities are used
4. Phase 4: UI Components - The updated UI components use these hooks

## Impact Analysis

| Component                    | Changes Required                                           |
| ---------------------------- | ---------------------------------------------------------- |
| edge-store.ts                | Update to use prepareEdgeForInsert and handle type casting |
| use-connection-validation.ts | New hook for centralized validation                        |
| use-add-edge.ts              | Update to use new validation system                        |
| use-dynamic-connections.ts   | New hook for real-time connection validation               |

## Testing Strategy

1. Test edge store with:

   - Valid edges with different handle types
   - Invalid edges with incorrect handle formats
   - Edge updates and deletions
   - Batch edge operations

2. Test connection validation with:

   - Valid output to texture connections
   - Invalid connection attempts
   - Edge cases in handle formats
   - Error message clarity

3. Test add edge flow with:

   - Successful edge creation
   - Failed validation cases
   - Error handling
   - Edge type consistency

4. Test dynamic connections with:
   - Real-time validation feedback
   - UI state updates
   - Error message display
   - Connection attempt feedback

## Acceptance Criteria

1. ✅ Edge store properly validates edges using prepareEdgeForInsert
2. ✅ Connection validation provides clear error messages
3. ✅ Add edge flow maintains type safety and handles errors
4. ✅ Dynamic connections provide real-time feedback
5. ✅ All tests pass and maintain coverage
6. ✅ Existing functionality is preserved
7. ✅ Type safety is maintained throughout the system
