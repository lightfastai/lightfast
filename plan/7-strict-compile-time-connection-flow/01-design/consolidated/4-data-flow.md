# Data Flow Architecture

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

## Unified System Architecture

```
┌──────────────────┐     ┌───────────────────┐     ┌────────────────────┐
│                  │     │                   │     │                    │
│  TextureTypeConfig    │     StrictConnection    │     TextureUniform  │
│  (Registry)      │     │     (Data Model)  │     │     (Simplified)   │
│                  │     │                   │     │                    │
└────────┬─────────┘     └─────────┬─────────┘     └──────────┬─────────┘
         │                         │                          │
         ▼                         ▼                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                   Unified Texture Update System                      │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌────────────────┐ ┌────────────────┐ ┌─────────────┐ ┌───────────┐ │
│ │ Connection     │ │ Shader         │ │ Expression  │ │ Uniform   │ │
│ │ Management     │ │ Management     │ │ Evaluation  │ │ Updates   │ │
│ └────────────────┘ └────────────────┘ └─────────────┘ └───────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Transformation Flow

### 1. Configuration to UI

```
Shader Constraints (ADD_UNIFORM_CONSTRAINTS, etc.)
↓
getTextureInputsForType() → TextureInput[] metadata
↓
TextureNode renders NodeHandle components
```

### 2. UI to Database

```
User connects nodes visually
↓
Connection event (source, target, sourceHandle, targetHandle)
↓
validateConnection() validates format and creates StrictConnection
↓
useAddEdge.mutateAsync() processes the connection
↓
Optimistic update to UI
↓
API call to create Edge in database
↓
InsertEdgeSchema validates format using isValidTextureHandleId()
```

### 3. Database to WebGL

```
Edge data loaded from database
↓
getUniformForEdge() converts handle to uniform name
↓
Shader receives uniform with texture data
```

## Connection Flow with Strict Typing

```
┌───────────────┐      ┌─────────────┐      ┌────────────────┐      ┌─────────────┐
│ Edge Store    │      │ Connection  │      │ TextureHandleId│      │ Texture     │
│ (Edges)       │─────►│ Cache       │─────►│ Validation     │─────►│ Update      │
│               │      │             │      │                │      │             │
└───────────────┘      └─────────────┘      └────────────────┘      └─────────────┘
```

## Shader Management System

```
┌───────────────────┐
│ Texture Data Map  │
│                   │
└─────────┬─────────┘
          │
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Texture Type Config │────►│ Shader Factory      │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                                       ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Connection Cache    │────►│ Uniform Assignment  │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                                       ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Expression Registry │────►│ Frame Update        │
└─────────────────────┘     └─────────────────────┘
```

## Handle ID Format Validation Points

1. **Type System Enforcement** - Compile-time validation of handle format

   ```typescript
   // Branded type for compile-time safety
   export type TextureHandleId = string & {
     readonly __brand: "TextureHandleId";
   };
   ```

2. **Constructor Function** - Runtime validation during handle creation

   ```typescript
   export function createTextureHandleId(
     value: string,
   ): TextureHandleId | null {
     if (!isValidTextureHandleId(value)) return null;
     return value as TextureHandleId;
   }
   ```

3. **Connection Validation** - Validation during connection creation

   ```typescript
   export function validateConnection(
     connection: BaseConnection,
   ): ConnectionValidationResult {
     // validation logic...
   }
   ```

4. **React Flow Integration** - UI-level validation

   ```typescript
   <ReactFlow isValidConnection={useConnectionValidator()} ... />
   ```

5. **Schema Validation** - Database-level validation
   ```typescript
   export const InsertEdgeSchema = z.object({
     sourceHandle: $HandleId, // Uses Zod schema with built-in validation
     targetHandle: $HandleId,
     // other fields...
   });
   ```

## Expression Flow Integration

The Expression Evaluator is also integrated into the data flow:

```
┌─────────────────┐      ┌───────────────┐      ┌─────────────────┐
│ Expression Type │      │ Context       │      │ Shader Uniform  │
│ (Branded Type)  │─────►│ Evaluation    │─────►│ Updates         │
└─────────────────┘      └───────────────┘      └─────────────────┘
```

1. Expressions defined with branded types, similar to handle IDs
2. Expression context provides runtime values for evaluation
3. Results flow into shader uniforms
4. Validation handles both compile-time and runtime safety
