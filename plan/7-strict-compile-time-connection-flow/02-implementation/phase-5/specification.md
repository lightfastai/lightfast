# Phase 5: Hook Logic - Specification

## Overview

This phase refactors the React hooks that manage connections and edges to use the new type system. This includes the hooks for adding, updating, and deleting edges, as well as the hooks that manage connections between nodes.

## Requirements

1. Update useAddEdge hook to use StrictConnection
2. Update useEdgeStore to work with strictly typed edges
3. Update useUpdateTextureConnection hook to use TextureHandleId
4. Update useDynamicConnections hook to handle different connection types
5. Ensure backward compatibility with existing code

## Technical Design

### useAddEdge Hook Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-add-edge.ts
import { useCallback } from "react";
import { Connection } from "@xyflow/react";
import { nanoid } from "nanoid";

import { InsertEdge } from "@vendor/db/types";

import { useEdgeStore } from "../providers/edge-store-provider";
import {
  StrictConnection,
  toStrictConnection,
  validateConnection,
} from "../types/connection";

interface AddEdgeParams {
  onInvalidConnection?: (reason: string) => void;
}

export const useAddEdge = ({ onInvalidConnection }: AddEdgeParams = {}) => {
  const { addEdge } = useEdgeStore();

  const handleAddEdge = useCallback(
    (connection: Connection) => {
      // Validate connection with detailed error info
      const validationResult = validateConnection(connection);

      if (!validationResult.valid) {
        // Handle invalid connection with better error messaging
        if (onInvalidConnection) {
          onInvalidConnection(validationResult.details);
        }
        console.warn(
          `Invalid connection: ${validationResult.details}`,
          connection,
        );
        return false;
      }

      // We now have a guaranteed valid connection
      const strictConnection = validationResult.connection;

      // Create edge from strict connection
      const newEdge: InsertEdge = {
        id: nanoid(),
        source: strictConnection.source,
        target: strictConnection.target,
        sourceHandle: strictConnection.sourceHandle,
        targetHandle: strictConnection.targetHandle,
      };

      addEdge(newEdge);
      return true;
    },
    [addEdge, onInvalidConnection],
  );

  return handleAddEdge;
};
```

### useEdgeStore Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/providers/edge-store-provider.tsx
import { useCallback, useMemo } from "react";
import { create } from "zustand";

import { Edge, InsertEdge } from "@vendor/db/types";
import { prepareEdgeForInsert } from "@vendor/db/utils";

import { useProjectStore } from "./project-store-provider";

// Updated store interface with proper types
interface EdgeStore {
  edges: InsertEdge[];
  addEdge: (edge: InsertEdge) => void;
  updateEdge: (edge: InsertEdge) => void;
  deleteEdge: (edgeId: string) => void;
  setEdges: (edges: InsertEdge[]) => void;
}

// Create store with proper validation
export const useEdgeStoreBase = create<EdgeStore>((set) => ({
  edges: [],
  addEdge: (edge) => {
    // Ensure edge has valid handles before adding
    const validEdge = prepareEdgeForInsert(edge);

    set((state) => ({
      edges: [...state.edges, validEdge],
    }));
  },
  updateEdge: (edge) => {
    // Ensure edge has valid handles before updating
    const validEdge = prepareEdgeForInsert(edge);

    set((state) => ({
      edges: state.edges.map((e) => (e.id === validEdge.id ? validEdge : e)),
    }));
  },
  deleteEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    }));
  },
  setEdges: (edges) => {
    // Ensure all edges have valid handles
    const validEdges = edges.map(prepareEdgeForInsert);

    set(() => ({
      edges: validEdges,
    }));
  },
}));

// Rest of hook implementation...
```

### useUpdateTextureConnection Hook

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-update-texture-connection.ts
import { useCallback, useEffect, useRef } from "react";

import {
  getUniformNameFromTextureHandleId,
  isTextureHandleId,
  TextureHandleId,
} from "@vendor/db/types";

import { useEdgeStore } from "../providers/edge-store-provider";

/**
 * Hook for managing texture connections
 * Now using TextureHandleId to enforce type safety
 */
export const useUpdateTextureConnection = (nodeId: string) => {
  const { edges } = useEdgeStore();
  const connectionCache = useRef<Record<string, Record<string, string | null>>>(
    {},
  );

  // Initialize connection cache for this node
  if (!connectionCache.current[nodeId]) {
    connectionCache.current[nodeId] = {};
  }

  // Find all connections where this node is the target
  useEffect(() => {
    // Verify handle IDs at runtime for extra safety
    edges.forEach((edge) => {
      if (edge.target === nodeId && isTextureHandleId(edge.targetHandle)) {
        const handleId = edge.targetHandle as TextureHandleId;
        connectionCache.current[nodeId][handleId] = edge.source;
      }
    });
  }, [edges, nodeId]);

  /**
   * Get the connection for a specific handle
   */
  const getConnection = useCallback(
    (handleId: TextureHandleId): string | null => {
      return connectionCache.current[nodeId]?.[handleId] || null;
    },
    [nodeId],
  );

  /**
   * Get the uniform name for a handle
   */
  const getUniformName = useCallback(
    (handleId: TextureHandleId): string | null => {
      return getUniformNameFromTextureHandleId(handleId);
    },
    [],
  );

  return {
    getConnection,
    getUniformName,
  };
};
```

### useDynamicConnections Hook

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-dynamic-connections.ts
import { useCallback, useState } from "react";

import {
  HandleId,
  isOutputHandleId,
  isTextureHandleId,
  OutputHandleId,
  TextureHandleId,
} from "@vendor/db/types";

import {
  ConnectionValidationError,
  StrictConnection,
  validateConnection,
} from "../types/connection";

/**
 * Hook for validating connections between nodes
 * Using the new type system for better type safety
 */
export const useDynamicConnections = () => {
  const [lastValidationError, setLastValidationError] = useState<string | null>(
    null,
  );

  /**
   * Check if a connection is valid based on handle types and node types
   */
  const isValidConnection = useCallback(
    (connection: Parameters<typeof validateConnection>[0]) => {
      // Validate using the new validation system
      const result = validateConnection(connection);

      if (!result.valid) {
        setLastValidationError(result.details);
        return false;
      }

      const strictConnection = result.connection;

      // Additional validation logic for different handle types
      const sourceIsOutput = isOutputHandleId(strictConnection.sourceHandle);
      const targetIsInput = isTextureHandleId(strictConnection.targetHandle);

      // Ensure connections go from outputs to inputs
      if (!sourceIsOutput || !targetIsInput) {
        setLastValidationError(
          "Connections must be from output handles to input handles",
        );
        return false;
      }

      // Clear error and return valid
      setLastValidationError(null);
      return true;
    },
    [],
  );

  return {
    isValidConnection,
    lastValidationError,
  };
};
```

## Dependencies

1. Phase 1: Enhanced Handle Types - The branded types are used in hook parameters
2. Phase 2: Connection Types - StrictConnection is used in hook logic
3. Phase 3: Edge Schema - The updated Edge schema is used in useEdgeStore
4. Phase 4: UI Components - The updated UI components use these hooks

## Impact Analysis

| Component                  | Changes Required                                             |
| -------------------------- | ------------------------------------------------------------ |
| useAddEdge                 | Update to use StrictConnection and provide better error info |
| useEdgeStore               | Update to validate edges before adding to store              |
| useUpdateTextureConnection | Update to use TextureHandleId                                |
| useDynamicConnections      | Update to handle different handle types                      |
| Flow component             | No changes yet (handled in Phase 7)                          |

## Acceptance Criteria

1. ✅ useAddEdge hook validates connections and provides better error messages
2. ✅ useEdgeStore ensures all edges have valid handles
3. ✅ useUpdateTextureConnection uses TextureHandleId for type safety
4. ✅ useDynamicConnections correctly validates different handle types
5. ✅ Existing code continues to work with the updated hooks
6. ✅ All tests continue to pass
