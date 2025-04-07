# Remove ShaderUniform Interface

This plan outlines the steps to remove the `ShaderUniform` interface and simplify the texture handling system. The current implementation stores redundant texture objects, which are already managed by render targets. This change will reduce complexity and memory usage.

## Motivation

- `ShaderUniform` stores redundant texture objects that are already managed by render targets
- The interface adds unnecessary complexity to the type system
- The actual texture assignment in shaders is done directly with `uniforms.u_texture1.value = texture`
- Only the handle information from `ShaderUniform` is valuable for connection validation

## Implementation Steps

### 1. Update Type System

- Remove `packages/webgl/src/types/shader-uniform.ts`
- Remove `TextureUniform` export from `packages/webgl/src/index.ts`
- Update `TextureInputRegistryEntry` to use `ShaderSampler2DUniform` instead of `ShaderUniform`

### 2. Update Registry System

```typescript
// Before
interface TextureInputRegistryEntry {
  defaultUniforms: Record<string, ShaderUniform>;
  // ... other fields
}

// After
interface TextureInputRegistryEntry {
  defaultUniforms: Record<string, ShaderSampler2DUniform>;
  // ... other fields
}
```

### 3. Update Shader Definitions

Update shader files to use `ShaderSampler2DUniform`:

- `packages/webgl/src/shaders/add.ts`
- `packages/webgl/src/shaders/displace.ts`
- `packages/webgl/src/shaders/limit.ts`
- `packages/webgl/src/shaders/pnoise.ts`

### 4. Update Base Shader Functions

Modify `packages/webgl/src/shaders/base.ts`:

```typescript
// Before
export type ShaderUniforms = Record<
  string,
  IUniform<ShaderUniform | number | THREE.Vector2 | THREE.Vector3 | THREE.Vector4 | null>
>;

// After
export type ShaderUniforms = Record<
  string,
  IUniform<ShaderSampler2DUniform | number | THREE.Vector2 | THREE.Vector3 | THREE.Vector4 | null>
>;
```

### 5. Update Texture Update Hooks

Update texture update hooks to work directly with `ShaderSampler2DUniform`:

- `use-update-texture-add.ts`
- `use-update-texture-displace.ts`
- `use-update-texture-limit.ts`
- `use-update-texture-noise.ts`

### 6. Clean Up Dependencies

Remove all imports and references to `ShaderUniform` across the codebase:

- Update type imports
- Remove unused functions
- Update tests that depend on `ShaderUniform`

## Testing Strategy

1. **Type Safety**

   - Ensure all type errors are resolved
   - Verify no implicit any types are introduced

2. **Runtime Testing**

   - Test texture connections still work
   - Verify shader uniforms are properly updated
   - Check texture rendering works as expected

3. **Edge Cases**
   - Test null/undefined texture handles
   - Verify error handling for invalid connections
   - Test multiple texture inputs

## Migration Guide

For any code depending on `ShaderUniform`:

1. Replace `ShaderUniform` with `ShaderSampler2DUniform`
2. Remove any texture object storage/management
3. Use render targets directly for texture assignment
4. Update type annotations and imports

## Rollback Plan

If issues are discovered:

1. Revert the removal of `shader-uniform.ts`
2. Restore type exports in `index.ts`
3. Revert changes to registry and shader systems
4. Document the specific issues that prevented the migration
