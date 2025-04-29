# @repo/webgl

A comprehensive package for working with Three.js and WebGL in React applications.

## Features

- Ready-to-use React components for 3D rendering
- Hooks for managing render targets and pipelines
- Shader implementations and utilities
- TypeScript typings for all components and utilities

## Installation

This package is part of a monorepo and is automatically available to all applications in the workspace.

## Usage

### Basic Canvas

```tsx
import { WebGLCanvas } from "@repo/webgl";

export default function MyScene() {
  return <WebGLCanvas>{/* Your Three.js components here */}</WebGLCanvas>;
}
```

### Geometry Rendering

```tsx
import { GeometryViewer } from "@repo/webgl";
import { $GeometryType } from "@repo/webgl/utils";

export default function GeometryDemo() {
  return (
    <GeometryViewer
      geometries={[
        {
          type: $GeometryType.Enum.box,
          position: { x: -2, y: 0, z: 0 },
          rotation: { x: 0.01, y: 0.01, z: 0 },
          wireframe: true,
        },
        {
          type: $GeometryType.Enum.sphere,
          position: { x: 2, y: 0, z: 0 },
          rotation: { x: 0, y: 0.01, z: 0 },
        },
      ]}
      shouldRenderGrid={true}
      shouldRenderAxes={true}
    />
  );
}
```

### Texture Render Pipeline

The texture render pipeline requires a store to manage render targets. You can use the provided utilities to create a store:

```tsx
import { create } from "zustand";

import { TextureRenderStore } from "@repo/webgl/types";
import { createStoreCreator } from "@repo/webgl/utils";

// Create a Zustand store for texture render targets
export const useTextureRenderStore =
  create<TextureRenderStore>(createStoreCreator());
```

Then use the store with the adapter:

```tsx
import { createRenderTargetPipelineAdapter } from "@repo/webgl/hooks";

// Create a hook that connects to your store
export const useRenderTargetPipeline = createRenderTargetPipelineAdapter(() =>
  useTextureRenderStore.getState(),
);
```

And use the pipeline component:

```tsx
import { TextureRenderPipeline } from "@repo/webgl/components";

export function MyPipeline() {
  const { scene } = useRenderTargetPipeline({
    onEachFrame: {
      // Frame updates handlers
    },
    meshes: {
      // Meshes
    },
  });

  return <TextureRenderPipeline meshes={meshes} scene={scene} />;
}
```

## Architecture

The package is organized into the following main modules:

- `/components` - React components for rendering 3D scenes
  - `/canvas` - Canvas components
  - `/primitives` - Basic building blocks
  - `/renderers` - Components that handle rendering
  - `/viewers` - Higher-level components for viewing
- `/hooks` - React hooks for managing state and effects
  - `/render` - Hooks for render pipelines
- `/types` - TypeScript type definitions
- `/utils` - Utility functions and helpers
- `/shaders` - GLSL shader implementations

## License

MIT
