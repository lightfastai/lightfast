# Three.js Hooks

This directory contains React hooks for use with Three.js in the React TD application.

## Available Hooks

### useExpressionEvaluator

A unified, type-safe expression evaluator for Three.js that allows evaluating dynamic expressions in shaders and other contexts.

Features:

- Strong TypeScript typing
- Time-based variables from Three.js state
- Support for both numeric and boolean expressions
- Automatic conversion between boolean and numeric values where needed
- Compatible with webgl package's expression format (e.{expression})

#### Expression Format

This implementation uses the standard expression format from the webgl package:

- Expressions are prefixed with `e.` (e.g., `e.{time * 0.5}`)
- The expression itself is enclosed in braces

#### Integration with webgl Uniform Types

The expression evaluator is designed to work seamlessly with the uniform types defined in `@repo/webgl/src/types/uniforms.ts`:

- Uses the same expression format (`e.{expression}`)
- Compatible with the `NumericValue`, `Vec2`, and `Vec3` types
- Handles both literal values and expression strings

Example usage:

```tsx
import { useExpressionEvaluator } from "@repo/threejs";

// In your component
const { evaluate, updateShaderUniforms } = useExpressionEvaluator();

// Evaluate an expression with the current Three.js state
const value = evaluate("e.{time * 0.5}", state);

// Update shader uniforms with expressions
updateShaderUniforms(
  state,
  shader,
  { u_speed: "e.{time * 0.1}" },
  { u_speed: { pathToValue: "u_speed.value" } },
);
```

### useShaderOrchestrator

A hook that manages shared shader materials for efficient rendering.

### useShaderMaterialOrchestrator

A hook that handles shared shader material instances.

### useTextureRenderPipeline

A hook for managing texture render targets and their rendering process.
