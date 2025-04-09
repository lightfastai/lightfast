# Pipeline

## Texture Render Pipeline

The texture render pipeline is a component that renders a texture to a WebGLRenderTarget.

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

We have three layers of abstraction:

1. PureWebGLShaderRegistry (lowest level)

   - manages a list of pure WebGL [shaders](../packages/webgl/src/shaders)
   - exposes a registry API of the various configuration of shaders based on their uniform schema (compromised of base uniforms and constraints)
   - base uniforms are derived based on Sampler2D (special case for vUv mapping through the DB layer)
   - constraints are associated with the type of the uniform field and the expected range of values
   - framework agnostic

2. R3FShaderMaterialOrchestrator

   - remaps the shaders in PureWebGLShaderRegistry API to the ThreeJS ShaderMaterial API
   - manages a singleton instance of the ShaderMaterial
   - efficiently reuses the same ShaderMaterial instance across multiple textures
   - automatically disposes of the ShaderMaterial when the component unmounts

3. R3FUniformUpdateOrchestrator

   - manages the update of the uniforms of the ShaderMaterial
   - handles Expression conversion to the correct uniform value
