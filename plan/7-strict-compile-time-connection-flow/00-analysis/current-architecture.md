# Edge Architecture Review

## Overview

This document reviews the architecture that manages edges in the React TD application, focusing on type safety and data flow between components. The current implementation has potential type safety issues, particularly with `sourceHandle` and `targetHandle` fields that are stored as generic varchar strings in the database but require specific formatting.

## Core Components

### Database Schema (`Edge.ts`)

The database schema for edges is defined in `vendor/db/src/schema/tables/Edge.ts`:

- Edges are stored with fields: `id`, `source`, `target`, `sourceHandle`, `targetHandle`, `createdAt`, `updatedAt`
- `source` and `target` reference Node IDs
- `sourceHandle` and `targetHandle` are stored as varchar(191) with no database-level constraints
- Validation happens through Zod schemas, particularly `InsertEdgeSchema`
- Runtime validation using `isValidTextureHandleId` ensures handles follow the "input-N" format

### Texture Handle Types (`TextureHandle.ts`)

The `vendor/db/src/schema/types/TextureHandle.ts` file defines the core types and utilities for texture handles:

- `TEXTURE_HANDLE_ID_REGEX` = `/^input-\d+$/` defines the required format
- `isValidTextureHandleId` function validates strings against this regex
- Helper functions convert between handle IDs and uniform names
- `getTextureInputsMetadata` provides metadata about texture inputs

### UI Components

#### NodeHandle (`node-handle.tsx`)

A reusable component in `apps/app/src/app/(app)/(workspace)/workspace/components/common/node-handle.tsx`:

- Renders connection points for nodes with tooltips
- Enforces handle ID format at component level:
  - Input handles must start with "input-"
  - Output handles must include "output"
- Uses React Flow's `Handle` component internally

#### TextureNode (`texture-node.tsx`)

The texture node component in `apps/app/src/app/(app)/(workspace)/workspace/components/nodes/texture-node.tsx`:

- Renders a node for textures with appropriate input handles
- Uses `getTextureInputsForType` to determine which input handles to create
- Creates a `NodeHandle` component for each input and one output

### Hooks and Logic

#### useAddEdge (`use-add-edge.tsx`)

A hook in `apps/app/src/app/(app)/(workspace)/workspace/hooks/use-add-edge.tsx` that manages edge creation:

- Provides methods to create connections between nodes
- Uses optimistic updates for better UX
- Includes validation for target handles but doesn't explicitly validate handle ID format
- Relies on server-side validation through the API

### WebGL Types and Registry

#### Texture Registry (`texture-registry.ts`)

The `packages/webgl/src/types/texture-registry.ts` file manages texture types:

- `getTextureInputsForType` returns input metadata for a texture type
- Maps between uniform names and handle IDs
- Determines the maximum number of inputs for texture types

#### Texture Uniform (`texture-uniform.ts`)

The `packages/webgl/src/types/texture-uniform.ts` file defines types for texture uniforms:

- `TextureReference` interface describes a texture reference in the shader system
- Zod schema for validation
- Functions to create and update texture uniforms

#### Field Types (`field.ts`)

The `packages/webgl/src/types/field.ts` file defines types for field metadata:

- `TextureFieldMetadata` interface defines metadata for texture input fields
- Used by the texture registry to define constraints

## Data Flow

1. **Definition Phase:**

   - Texture types define their input requirements via uniform constraints
   - `getTextureInputsForType` converts these to handle metadata

2. **Node Rendering:**

   - `TextureNode` uses texture input metadata to create `NodeHandle` components
   - Handle IDs follow the "input-N" pattern
   - Visual validation occurs in the UI components

3. **Edge Creation:**

   - User connects handles visually
   - `useAddEdge` hook is called when a connection is made
   - Handle validates connection at runtime
   - Edge is added to the database after validation

4. **Validation:**
   - Client-side: `NodeHandle` component enforces ID format
   - API/Database: `InsertEdgeSchema` validates handle format using regex
   - Both use the same pattern but in different places

## Type Safety Issues

1. **Schema Definition:**

   - Database schema allows any varchar(191) for handles
   - Type safety relies on runtime validation

2. **Handle ID Format:**

   - "input-N" format is enforced in multiple places:
     - Database schema validation (Zod schema)
     - UI component validation (NodeHandle)
     - Utility functions (TextureHandle.ts)
   - No single source of truth for this pattern

3. **Function Parameters:**
   - Many functions accept string parameters for handles without type constraints
   - TypeScript could provide better static type checking

## Recommendations

1. **Enhanced TypeScript Types:**
   - Create a branded type for TextureHandleId to enforce compile-time safety
   - Use this type consistently across the codebase

```typescript
// Example implementation
export type TextureHandleId = string & { readonly _brand: unique symbol };

export function createTextureHandleId(input: string): TextureHandleId | null {
  return isValidTextureHandleId(input) ? (input as TextureHandleId) : null;
}
```

2. **Centralized Validation:**

   - Move all validation logic to TextureHandle.ts
   - Create parsing functions that return either valid handles or errors
   - Use these functions in all places needing validation

3. **Database Schema Enhancement:**

   - Consider using a custom type or check constraint in the database
   - At minimum, add documentation about the expected format

4. **Consistent Error Handling:**

   - Standardize error messages for invalid handles
   - Provide better user feedback when invalid handles are detected

5. **Edge Schema Evolution:**
   - Consider changing the edge schema to store handle numeric indices directly
   - This would eliminate the need for string parsing/formatting

## Future Considerations

- **Strongly Typed Edge System:**

  - Define specific edge types based on source and target node types
  - Create a type registry that knows which connections are valid
  - Generate UI connection rules from this registry

- **Validation Caching:**

  - Cache validation results to improve performance
  - Pre-validate handles at UI level before sending to API

- **Enhanced Visual Feedback:**

  - Show validation errors directly on handles
  - Prevent invalid connections visually

- **Database Migration:**
  - Consider migrating to a more structured representation
  - Add explicit constraints to the database schema
