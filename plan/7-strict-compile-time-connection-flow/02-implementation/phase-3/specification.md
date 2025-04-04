# Phase 3: Edge Schema - Specification

## Overview

This phase updates the Edge database schema to use the enhanced handle ID types created in Phase 1. This ensures that handle IDs are validated at both the database and application levels, establishing a single source of truth for handle ID validation.

## Requirements

1. Update the Edge schema to use the new HandleId types
2. Make source and target handles required in the schema
3. Update Edge type definitions to reflect the schema changes
4. Ensure backward compatibility with existing data

## Technical Design

### Edge Database Schema Update

```typescript
// vendor/db/src/schema/tables/Edge.ts
import { z } from "zod";

import { $HandleId, HandleId } from "../types/TextureHandle";

// Update the schema to use the HandleId type and make handles required
export const InsertEdgeSchema = z.object({
  source: z.string().min(1).max(191),
  target: z.string().min(1).max(191),
  sourceHandle: $HandleId, // Now required, accepts either input or output handle
  targetHandle: $HandleId, // Now required, accepts either input or output handle
});

// Update the type to reflect the schema changes
export type InsertEdge = {
  source: string;
  target: string;
  sourceHandle: HandleId; // Required handle with strict typing
  targetHandle: HandleId; // Required handle with strict typing
};

// Edge table definition doesn't need to change - we just need to update the schema
```

### Edge Helper Functions

```typescript
// Update functions that work with edge handles
import {
  getUniformNameFromTextureHandleId,
  HandleId,
  isTextureHandleId,
} from "../types/TextureHandle";

/**
 * Get the uniform name for an edge's target handle
 * Returns null if the handle is not a valid TextureHandleId
 */
export function getUniformForEdge(edge: {
  targetHandle: HandleId; // Now requires a valid HandleId
}): string | null {
  // Only texture handles map to uniform names
  if (isTextureHandleId(edge.targetHandle)) {
    return getUniformNameFromTextureHandleId(edge.targetHandle);
  }
  return null;
}
```

### Edge Migration Logic

We need to add logic to handle existing edges that might not have valid handles:

```typescript
// Migration utility to ensure all edges have valid handles
export function migrateEdgeHandles(edge: {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): {
  sourceHandle: string;
  targetHandle: string;
} {
  // Provide defaults for missing or invalid values
  return {
    sourceHandle: edge.sourceHandle || "output-main",
    targetHandle: edge.targetHandle || "input-1",
  };
}
```

## Dependencies

1. Phase 1: Enhanced Handle Types - The branded types are used in the Edge schema
2. Phase 2: Connection Types - The strict connection logic informs the Edge schema design

## Impact Analysis

| Component         | Changes Required                                                 |
| ----------------- | ---------------------------------------------------------------- |
| Edge.ts           | Update schema to use HandleId and make handles required          |
| getUniformForEdge | Update to work with HandleId and handle different handle types   |
| Migration Code    | Add utilities to handle existing data                            |
| Database          | No immediate changes, but validation is enforced through schemas |

## Acceptance Criteria

1. ✅ Edge schema uses the HandleId type for source and target handles
2. ✅ Source and target handles are required in the schema
3. ✅ Edge type definitions reflect the schema changes
4. ✅ Helper functions work correctly with the updated types
5. ✅ Existing database records still work with the new schema
6. ✅ All tests continue to pass
