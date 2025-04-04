# StrictConnection Type Overview

## Type Hierarchy Diagram

```
┌───────────────────────────┐
│                           │
│       BaseConnection      │
│   (@xyflow/react type)    │
│                           │
│  source: string           │
│  target: string           │
│  sourceHandle?: string    │ ◄── Weak typing: any string allowed
│  targetHandle?: string    │
│                           │
└───────────────┬───────────┘
                │
                │ extends & strengthens
                ▼
┌───────────────────────────┐
│                           │
│     StrictConnection      │
│ (custom type enhancment)  │
│                           │
│  source: string           │
│  target: string           │
│  sourceHandle: TextureHandleId  │ ◄── Strong typing: branded type
│  targetHandle: TextureHandleId  │ ◄── Required, not optional
│                           │
└───────────────────────────┘
```

## TextureHandleId Branded Type

```typescript
// Branded type for compile-time safety
export type TextureHandleId = string & { readonly __brand: "TextureHandleId" };

// Smart constructor ensures format is valid
export function createTextureHandleId(value: string): TextureHandleId | null {
  if (!isValidTextureHandleId(value)) return null;
  return value as TextureHandleId;
}

// Type guard for runtime checks
export function isTextureHandleId(value: unknown): value is TextureHandleId {
  return typeof value === "string" && isValidTextureHandleId(value as string);
}
```

## Connection Conversion Flow

```
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  React Flow    │    │toStrictConnection│    │  API/Database │
│  Connection    │───►│     function   │───►│   Operation   │
│  (UI Event)    │    │   (Validator)  │    │  (Data Store) │
└───────────────┘    └───────────────┘    └───────────────┘
       │                     │                     │
       │                     │                     │
       ▼                     ▼                     ▼
 string handles      TextureHandleId         Strongly typed
 (weakly typed)      (strongly typed)         edge record
```

## Benefits of the StrictConnection Approach

1. **Compile-Time Safety**:

   - TypeScript can detect and prevent invalid handle usage
   - IDE autocomplete for valid handle operations only

2. **Centralized Validation**:

   - Single point of validation logic in `toStrictConnection`
   - Validation happens before any business logic

3. **Required Handles**:

   - No more incomplete connections with missing handles
   - Clear error messages when handles are missing

4. **Runtime Type Guards**:

   - `isStrictConnection` checks validity at runtime
   - Can be used in conditional logic to handle edge cases

5. **Clean API Boundaries**:
   - UI components work with generic `Connection` type
   - Business logic works with validated `StrictConnection` type
   - Database layer uses `InsertEdge` type with guaranteed valid handles

## Usage Example

```typescript
// In a React Flow component event handler
function onConnect(connection: Connection) {
  // Convert to strict connection with validation
  const strictConnection = toStrictConnection(connection);

  if (!strictConnection) {
    // Handle invalid connection
    toast.error("Invalid connection: handles must be valid");
    return;
  }

  // Safely use the connection with guaranteed valid handles
  createEdge({
    source: strictConnection.source,
    target: strictConnection.target,
    sourceHandle: strictConnection.sourceHandle, // Guaranteed to be valid TextureHandleId
    targetHandle: strictConnection.targetHandle, // Guaranteed to be valid TextureHandleId
  });
}
```

## Error Handling Flow

```
User attempts connection → React Flow generates Connection event
↓
toStrictConnection validates handles
↓
┌─────────────────────┐     ┌─────────────────────┐
│ Invalid handles     │     │ Valid handles       │
└─────────┬───────────┘     └─────────┬───────────┘
          │                           │
          ▼                           ▼
 ┌─────────────────┐         ┌─────────────────┐
 │ Show toast      │         │ Process valid   │
 │ Reject connection│         │ connection     │
 └─────────────────┘         └─────────────────┘
```
