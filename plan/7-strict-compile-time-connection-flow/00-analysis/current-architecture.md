# Edge Architecture Review

## Overview

This document reviews the architecture that manages edges in the React TD application, focusing on type safety and data flow between components. The implementation has been enhanced with branded types and strict compile-time type checking, particularly for handle IDs and expressions.

## Core Components

### Database Schema (`Edge.ts`)

The database schema for edges is defined in `vendor/db/src/schema/tables/Edge.ts`:

- Edges are stored with fields: `id`, `source`, `target`, `sourceHandle`, `targetHandle`, `createdAt`, `updatedAt`
- `source` and `target` reference Node IDs
- `sourceHandle` and `targetHandle` use branded types for compile-time safety
- Validation happens through Zod schemas with custom type guards
- Both compile-time and runtime validation ensure handle format correctness

### Handle Types

The system now supports two distinct handle types:

1. **Texture Handles** (`TextureHandle.ts`):

   - Uses branded type `TextureHandleId`
   - Follows "input-N" format
   - Includes validation and type guards
   - Maps directly to shader uniforms

2. **Output Handles** (`OutputHandle.ts`):
   - Uses branded type `OutputHandleId`
   - Follows "output-name" format
   - Supports multiple outputs per node
   - Includes validation and type guards

### Expression System

The expression system has been enhanced with strict typing:

- Uses branded type `Expression` for compile-time safety
- Supports type-safe evaluation context
- Provides proper typing for expression results
- Includes validation and error handling
- Maps cleanly to shader uniforms

### UI Components

#### NodeHandle (`node-handle.tsx`)

A reusable component with enhanced type safety:

- Uses branded types for handle IDs
- Enforces type-safe props
- Provides compile-time validation
- Supports both input and output handles

#### TextureNode (`texture-node.tsx`)

The texture node component with improved type safety:

- Uses type-safe handle creation
- Enforces proper handle types
- Supports multiple output handles
- Integrates with expression system

### Hooks and Logic

#### useExpressionEvaluator (`use-expression-evaluator.tsx`)

A new hook that provides type-safe expression evaluation:

- Evaluates expressions with proper typing
- Handles nested context values
- Provides error handling and fallbacks
- Updates uniforms safely

#### useAddEdge (`use-add-edge.tsx`)

An enhanced hook with type safety:

- Uses branded types for validation
- Provides compile-time connection checking
- Includes optimistic updates
- Maintains backward compatibility

### WebGL Integration

The WebGL system has been updated to support:

- Type-safe uniform updates
- Expression-based animations
- Proper cleanup and disposal
- Performance optimizations

## Type Safety Improvements

1. **Branded Types:**

   - `TextureHandleId` for input handles
   - `OutputHandleId` for output handles
   - `Expression` for dynamic values
   - `HandleId` union type

2. **Validation:**

   - Compile-time type checking
   - Runtime validation where needed
   - Clear error messages
   - Performance optimizations

3. **Expression System:**
   - Type-safe evaluation
   - Proper context typing
   - Error handling
   - Performance considerations

## Future Considerations

1. **Performance Optimization:**

   - Cache evaluation results
   - Optimize uniform updates
   - Reduce unnecessary validations

2. **Enhanced Type Safety:**

   - Add more specific handle types
   - Improve error messages
   - Extend type system coverage

3. **Developer Experience:**

   - Improve error messages
   - Add development tools
   - Enhance documentation

4. **Feature Extensions:**
   - Support more expression types
   - Add custom handle types
   - Enhance validation rules
