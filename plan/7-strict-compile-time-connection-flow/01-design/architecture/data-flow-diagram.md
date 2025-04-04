# Edge Architecture Data Flow

## Component and Data Flow Diagram

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│                             │     │                             │
│       Texture Registry      │     │         Field Types         │
│  (packages/webgl/types/)    │     │  (packages/webgl/types/)    │
│                             │     │                             │
└───────────────┬─────────────┘     └─────────────┬───────────────┘
                │                                  │
                │ Defines                          │ Provides
                │ available                        │ metadata
                │ inputs                           │ structure
                ▼                                  ▼
┌─────────────────────────────┐     ┌─────────────────────────────┐
│                             │     │                             │
│     TextureHandle Types     │◄────┤      Texture Uniform        │
│  (vendor/db/schema/types/)  │     │  (packages/webgl/types/)    │
│                             │     │                             │
└───────────────┬─────────────┘     └─────────────────────────────┘
                │
                │ Provides
                │ validation
                │ utilities
                ▼
┌─────────────────────────────┐
│                             │
│       Edge DB Schema        │
│  (vendor/db/schema/tables/) │
│                             │
└───────────────┬─────────────┘
                │
                │ Database
                │ structure
                ▼
┌─────────────────────────────┐
│                             │
│      useAddEdge Hook        │
│   (app/workspace/hooks/)    │
│                             │
└───────────────┬─────────────┘
                │
                │ Connects
                │ UI to data
                ▼
┌─────────────────────────────┐     ┌─────────────────────────────┐
│                             │     │                             │
│       TextureNode           │◄────┤        NodeHandle          │
│ (app/workspace/components/) │     │ (app/workspace/components/) │
│                             │     │                             │
└─────────────────────────────┘     └─────────────────────────────┘
```

## Data Transformation Flow

1. **Configuration to UI**:

   ```
   Shader Constraints (ADD_UNIFORM_CONSTRAINTS, etc.)
   ↓
   getTextureInputsForType() → TextureInput[] metadata
   ↓
   TextureNode renders NodeHandle components
   ```

2. **UI to Database**:

   ```
   User connects nodes visually
   ↓
   Connection event (source, target, sourceHandle, targetHandle)
   ↓
   useAddEdge.mutateAsync() validates and processes
   ↓
   Optimistic update to UI
   ↓
   API call to create Edge in database
   ↓
   InsertEdgeSchema validates format using isValidTextureHandleId()
   ```

3. **Database to WebGL**:
   ```
   Edge data loaded from database
   ↓
   getUniformForEdge() converts handle to uniform name
   ↓
   Shader receives uniform with texture data
   ```

## Handle ID Format Validation Points

1. **UI Creation** - NodeHandle component validates format

   ```typescript
   // Input handle validation
   if (type === "input" && !id.startsWith("input-")) {
     throw new Error(
       `Input handle IDs must start with "input-". Received: "${id}"`,
     );
   }
   ```

2. **Edge Creation** - useAddEdge hook checks for existence

   ```typescript
   // Validate that targetHandle exists
   if (!targetHandle) {
     toast({
       title: "Error",
       description: "Missing target handle specification",
       variant: "destructive",
     });
     return false;
   }
   ```

3. **API Validation** - InsertEdgeSchema validates format

   ```typescript
   targetHandle: z
     .string()
     .max(191)
     .optional()
     .refine((val) => val === undefined || isValidTextureHandleId(val), {
       message: "Target handle must follow the 'input-N' format or be undefined",
     }),
   ```

4. **Utility Functions** - TextureHandle.ts validates and converts
   ```typescript
   export function isValidTextureHandleId(id: string): boolean {
     return TEXTURE_HANDLE_ID_REGEX.test(id);
   }
   ```

## Type Gap Analysis

| Component        | Type Checking           | Runtime Validation  | Notes                             |
| ---------------- | ----------------------- | ------------------- | --------------------------------- |
| Database Schema  | ❌ varchar(191)         | ✅ Zod schema       | Type safety only at runtime       |
| TextureHandle.ts | ✅ TextureHandleId type | ✅ REGEX validation | Type not enforced across codebase |
| NodeHandle       | ❌ string prop          | ✅ Throws error     | Validation happens too late       |
| useAddEdge       | ❌ Connection type      | ✅ Checks existence | No format validation              |
| Texture Registry | ❌ string params        | ❓ Partial          | Assumes valid format              |

The gaps in this flow are primarily in static type checking - the system relies heavily on runtime validation rather than compile-time type safety.
