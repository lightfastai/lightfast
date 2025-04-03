# WebGL Components

This directory contains Three.js/WebGL components that have been refactored to use the `@repo/webgl` package. The components in this directory now serve as compatibility layers that map our application's API to the reusable components in the webgl package.

## Refactoring Changes

Most of the Three.js code has been moved to the `@repo/webgl` package. The components in this directory maintain the same API to ensure backward compatibility with existing code.

### Key Changes

1. **Component Mapping**:

   - `WebGLCanvas` → Now wraps `@repo/webgl/components.WebGLCanvas`
   - `GeometryRenderer` → Now wraps `@repo/webgl/components.GeometryRenderer`
   - `GeometryViewer` → Now wraps `@repo/webgl/components.GeometryViewer`

2. **Render Pipeline**:

   - For the texture render pipeline, we use a direct implementation in `use-render-target-pipeline-adapter.tsx` that closely mimics the original behavior while connecting to our existing store
   - This approach ensures compatibility with our Zustand store pattern and texture management

3. **Primitives**:
   - All primitive components like `OrbitControls`, `PerspectiveCamera`, etc. are now imported from `@repo/webgl/components`
   - Geometry definitions are imported from `@repo/webgl/utils`

## Implementation Details

### TextureRenderPipeline

The `TextureRenderPipeline` component was the most complex to refactor. Instead of using the generic adapter from the WebGL package, we implemented a custom adapter that directly replicates our original behavior:

1. It uses the existing Zustand store through `useTextureRenderStore`
2. It maintains mesh references directly in the component
3. It renders meshes for each texture node type (noise, limit, displace, add)

This implementation ensures that the rendered textures behave exactly as they did before the refactoring.

## Usage

Continue using these components as before. The refactoring should be transparent to the rest of the application.

### Example:

```tsx
import { WebGLCanvas } from "../components/webgl/webgl-canvas";
import { GeometryViewer } from "../components/webgl/geometry-viewer";

// Use as before
const MyComponent = () => (
  <WebGLCanvas>
    <GeometryViewer
      geometries={...}
      cameraPosition={...}
      lookAt={...}
    />
  </WebGLCanvas>
);
```

## Benefits

1. **Separation of Concerns**: Three.js code is now isolated from application logic
2. **Reusability**: The components can be used in other applications
3. **Maintainability**: Easier to update Three.js and related dependencies
4. **Performance**: Optimized components in a dedicated package
5. **Testing**: Easier to test isolated components
