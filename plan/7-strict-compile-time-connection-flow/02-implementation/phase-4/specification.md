# Phase 4: UI Components - Specification

## Overview

This phase focuses on updating the NodeHandle component to use strictly typed handle IDs while maintaining the existing UI patterns and accessibility features.

## Requirements

1. Update NodeHandle component to use branded types (TextureHandleId and OutputHandleId)
2. Maintain existing UI/UX features and accessibility
3. Ensure type safety while preserving backward compatibility
4. Keep consistent with shadcn/ui and Radix patterns

## Technical Design

### NodeHandle Component Update

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/components/common/node-handle.tsx
import { HandleId, OutputHandleId, TextureHandleId } from "@vendor/db/types";

export interface NodeHandleProps {
  /**
   * Strictly typed handle ID - either TextureHandleId or OutputHandleId
   */
  id: HandleId;

  /**
   * Position of the handle
   */
  position: Position;

  /**
   * Description to show in tooltip
   */
  description: string;

  /**
   * Whether this handle is required (affects styling)
   */
  isRequired?: boolean;

  /**
   * Which side the tooltip should appear on
   */
  tooltipSide?: "left" | "right" | "top" | "bottom";
}

// Component implementation details...
```

### Type Safety Features

1. **Branded Types**:

   - Use `TextureHandleId` for input handles
   - Use `OutputHandleId` for output handles
   - Union type `HandleId` for generic handle references

2. **Type Validation**:

   - Compile-time validation through TypeScript
   - Runtime validation using type guards
   - Graceful fallback for invalid handles

3. **Type Inference**:
   - Handle type (input/output) inferred from ID
   - No explicit type prop needed
   - Automatic position defaults based on handle type

## Dependencies

1. Phase 1: Enhanced Handle Types - The branded types are used in component props
2. Phase 2: Connection Types - For type validation
3. Existing UI components and patterns

## Impact Analysis

| Component   | Changes Required                                     |
| ----------- | ---------------------------------------------------- |
| NodeHandle  | Update to use branded types, enhance type validation |
| TextureNode | Update to use new NodeHandle props                   |
| EdgeLine    | Minor updates to work with strict typing             |

## Acceptance Criteria

1. ✅ NodeHandle uses branded types (TextureHandleId/OutputHandleId)
2. ✅ Maintains existing UI/UX features and accessibility
3. ✅ Type safety enforced at compile time
4. ✅ Backward compatibility maintained
5. ✅ Consistent with existing UI patterns
6. ✅ All tests pass

## Migration Guide

1. Update handle IDs to use branded types:

   ```typescript
   const textureHandles = createTextureHandleIds(inputs.length);
   const outputHandle = createOutputHandleId("output-main")!;
   ```

2. Update NodeHandle usage:

   ```typescript
   <NodeHandle
     id={handleId}
     position={Position.Left}
     description="Input handle"
     isRequired={true}
   />
   ```

3. Remove explicit type props (now inferred from ID)

4. Update any custom handle components to use NodeHandle
