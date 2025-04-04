# Future Considerations for Edge Connection System

## Multi-Output Support

The current implementation focuses on a single output handle per node (`OUTPUT_HANDLE_ID = "output-main"`), but a more flexible approach would support multiple outputs:

### Implementation Strategy

1. **OutputHandleId Type**

   ```typescript
   // Define a branded type for output handles
   export type OutputHandleId = string & { readonly __brand: "OutputHandleId" };

   // Regular expression for output handles: "output-{name}"
   export const OUTPUT_HANDLE_ID_REGEX = /^output-[a-z0-9-]+$/;

   // Create function similar to input handles
   export function createOutputHandleId(value: string): OutputHandleId | null {
     if (!isValidOutputHandleId(value)) return null;
     return value as OutputHandleId;
   }

   // Validation function
   export function isValidOutputHandleId(id: string): boolean {
     return OUTPUT_HANDLE_ID_REGEX.test(id);
   }
   ```

2. **Registry for Output Types**

   - Create a registry of available output types for each node
   - Define metadata for each output (name, description, data type)
   - Map output handles to corresponding data paths in the node

3. **UI Component Updates**
   - Enhance the TextureNode component to render multiple output handles
   - Position output handles appropriately based on count and node size
   - Add visual indicators for different output types

## Strictly Typed Handle Props

Currently, the NodeHandle component accepts `id: string` which doesn't enforce type safety. This should be updated to:

```typescript
export interface NodeHandleProps {
  /**
   * Unique identifier for this handle
   */
  id: TextureHandleId | OutputHandleId;

  /**
   * The type of handle
   */
  type: "input" | "output";

  // Other props remain the same
}
```

This change ensures that only properly constructed handle IDs can be used, catching errors at compile time rather than runtime.

## Generalized Handle System

To support different types of connections beyond textures (Material, Geometry, etc.), we should implement a generalized handle system:

### Handle Type Hierarchy

1. **Base Handle Type**

   ```typescript
   // Base interface for all handle types
   export interface HandleId {
     readonly __type: string; // Discriminator for type checking
     readonly value: string; // The actual ID value
   }
   ```

2. **Specialized Handle Types**

   ```typescript
   export interface TextureHandleId extends HandleId {
     readonly __type: "texture";
   }

   export interface MaterialHandleId extends HandleId {
     readonly __type: "material";
   }

   export interface GeometryHandleId extends HandleId {
     readonly __type: "geometry";
   }
   ```

3. **Factory Functions**

   ```typescript
   export function createHandleId<T extends HandleId["__type"]>(
     type: T,
     value: string,
   ): (HandleId & { readonly __type: T }) | null {
     // Validate based on type
     const isValid = validateHandleId(type, value);
     if (!isValid) return null;

     return { __type: type, value } as HandleId & { readonly __type: T };
   }
   ```

### Connection Validation System

1. **Connection Rules Registry**

   - Define which handle types can connect to which
   - Specify type compatibility (e.g., TextureOutput → MaterialInput is valid)
   - Enable complex validation rules based on node and handle types

   ```typescript
   type ConnectionRule = {
     sourceType: string; // Handle type
     targetType: string; // Handle type
     isValid: (source: any, target: any) => boolean; // Custom validation
   };

   const connectionRules: ConnectionRule[] = [
     {
       sourceType: "texture",
       targetType: "material",
       isValid: (source, target) => true, // Additional validation logic
     },
     // More rules...
   ];
   ```

2. **Enhanced Connection Validation**

   ```typescript
   function canConnect(source: HandleId, target: HandleId): boolean {
     // Find matching rule
     const rule = connectionRules.find(
       (r) => r.sourceType === source.__type && r.targetType === target.__type,
     );

     // No rule found = connection not allowed
     if (!rule) return false;

     // Apply additional validation
     return rule.isValid(source, target);
   }
   ```

## Simplifying Data Models

### Redundant Field Removal

The current `TextureUniform` type contains a redundant `isConnected` field that can be inferred from the presence of an ID:

```typescript
// Current
interface TextureUniform {
  id: string | null;
  textureObject: THREE.Texture | null;
  isConnected: boolean; // Redundant - can be determined from id !== null
}

// Proposed
interface TextureUniform {
  id: string | null;
  textureObject: THREE.Texture | null;
}

// Helper function to check connection status
function isTextureConnected(uniform: TextureUniform): boolean {
  return !!uniform?.id;
}
```

Benefits of this simplification:

1. **Less State to Maintain**: Reduces the chance of inconsistent state where `id` exists but `isConnected` is false
2. **Simplified API**: Makes the API surface smaller and more intuitive
3. **Data Integrity**: Eliminates one source of potential bugs
4. **Better Type Safety**: Fewer fields mean fewer places for type errors

### Other Redundant State Considerations

Other areas where similar simplifications could be applied:

1. **Edge Connection State**: Connection status can often be derived from existing data rather than stored explicitly
2. **Node Type Information**: Some node types repeat information that could be derived from a registry
3. **Handle Metadata**: Separate the static metadata from dynamic connection state

## Visual Enhancements

1. **Color-Coded Handles**

   - Different handle types represented by different colors
   - Visual indicators showing compatible connections

2. **Smart Connection Preview**

   - Show preview of connection only when connecting to compatible handle
   - Filter available connection points based on compatibility

3. **Connection Type Indicators**
   - Show data flow type in the edge (e.g., texture, material, geometry)
   - Visual indicators for data transformation

## Implementation Strategy

1. **Phase 1**: Implement the basic branded types for TextureHandleId
2. **Phase 2**: Add OutputHandleId support and multi-output UI
3. **Phase 3**: Implement the generalized handle system with type hierarchy
4. **Phase 4**: Add the connection rules registry
5. **Phase 5**: Enhance UI with visual indicators and smart connections
6. **Phase 6**: Simplify data models by removing redundant fields

## Database Considerations

- Store handle type information in database schema
- Consider using composite types for handles (type + value)
- Implement validation at database level for type safety
- Add migrations for existing edges to support the new type system
