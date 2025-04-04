# New Architecture Diagram

## Component Structure

```
┌─────────────────────────────────┐
│                                 │
│     Texture Configuration       │
│         Registry                │
│                                 │
└────────────────┬────────────────┘
                 │
                 │ Defines
                 │
     ┌───────────▼────────────┐
     │                        │
     │  useUpdateTexture      │
     │  (Unified Hook)        │
     │                        │
     └───────────┬────────────┘
                 │
                 │ Creates
                 │
     ┌───────────▼────────────┐
     │                        │
     │  WebGLRenderTargetNodes│
     │                        │
     └────────────────────────┘
```

## Data Flow Architecture

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

## Type Safety Implementation

```
┌───────────────────────┐
│                       │
│  UniformType          │◄─────┐
│  'texture'|'number'|...│      │
│                       │      │
└───────────────────────┘      │
                               │
┌───────────────────────┐      │
│  BaseUniformConfig    │      │
│                       │──────┘
│  type: UniformType    │
│  defaultValue: any    │
│  isExpression?: bool  │
│                       │
└─────────┬─────────────┘
          │
          ├─────────────────┬───────────────┬─────────────┐
          │                 │               │             │
┌─────────▼──────┐  ┌──────▼─────┐  ┌──────▼────┐ ┌──────▼────────┐
│TextureUniform   │  │NumberUniform│  │BooleanUnif│ │VectorUniform │
│Config           │  │Config       │  │ormConfig  │ │Config        │
└─────────────────┘  └─────────────┘  └───────────┘ └───────────────┘
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

## Migration Path

```
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│                   │     │                   │     │                   │
│ Individual Hooks  │────►│ Unified Hook +    │────►│ Unified Hook      │
│                   │     │ Legacy Wrappers   │     │                   │
│                   │     │                   │     │                   │
└───────────────────┘     └───────────────────┘     └───────────────────┘
     Current                  Transition                  Target
```
