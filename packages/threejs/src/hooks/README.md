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

### useExpressionUniformUpdater

An enhanced version of the expression evaluator that specifically targets shader uniforms with type-safe integration.

Features:

- Direct integration with shader-uniforms.ts
- Type-safe updates for numeric, Vec2, and Vec3 uniforms
- Support for updating individual vector components
- Compatible with UniformFieldValue constraints from @repo/webgl

Example usage:

```tsx
import { useExpressionUniformUpdater } from "@repo/threejs";
import { ValueType } from "@repo/webgl";

// In your component
const {
  updateUniformsWithExpressions,
  updateVectorUniformsWithExpressions,
  updateUniformsFromConstraints,
} = useExpressionUniformUpdater();

// Basic uniform updates with expressions
updateUniformsWithExpressions(state, shader, [
  {
    uniformName: "u_speed",
    expression: "e.{time * 0.1}",
    type: ValueType.Numeric,
  },
]);

// Update specific components of vector uniforms
updateVectorUniformsWithExpressions(state, shader, [
  {
    uniformName: "u_direction",
    expression: "e.{sin(time)}",
    type: ValueType.Vec2,
    component: "x",
  },
  {
    uniformName: "u_direction",
    expression: "e.{cos(time)}",
    type: ValueType.Vec2,
    component: "y",
  },
]);

// Update uniforms based on constraints from WebGL package
updateUniformsFromConstraints(
  state,
  shader,
  shaderConstraints, // Record<string, UniformFieldValue>
  {
    u_speed: "e.{time * 0.5}",
    u_scale: "e.{sin(time) * 0.5 + 0.5}",
  },
);
```

### useExpressionUniforms

A powerful hook that handles NumericValue, Vec2, and Vec3 values that may contain expressions. This hook uses the expression adapters to automatically evaluate expressions embedded in shader uniform values.

Features:

- Support for NumericValue, Vec2, and Vec3 with embedded expressions
- Automatic detection and evaluation of expressions in vector components
- Type-safe uniform updates with proper Three.js value conversion
- Seamless integration with WebGL constraints and uniform types

Example usage:

```tsx
import { useExpressionUniforms } from "@repo/threejs";
import { ValueType } from "@repo/webgl";

// In your component
const {
  updateNumericUniform,
  updateVec2Uniform,
  updateVec3Uniform,
  updateUniformsWithExpressions,
  updateUniformsFromConstraints,
} = useExpressionUniforms();

// Update a numeric uniform with an expression
updateNumericUniform(
  state,
  shader,
  "u_speed",
  "e.{sin(time) * 0.5}", // Expression will be evaluated
);

// Update a Vec2 uniform with expressions in components
updateVec2Uniform(state, shader, "u_position", {
  x: "e.{sin(time)}", // Expression in x component
  y: "e.{cos(time)}", // Expression in y component
});

// Update multiple uniforms with expressions
updateUniformsWithExpressions(state, shader, [
  {
    uniformName: "u_scale",
    value: "e.{sin(time) * 0.5 + 0.5}",
    type: ValueType.Numeric,
  },
  {
    uniformName: "u_direction",
    value: {
      x: "e.{sin(time)}",
      y: "e.{cos(time)}",
    },
    type: ValueType.Vec2,
  },
]);

// Update uniforms from constraints with embedded expressions
updateUniformsFromConstraints(
  state,
  shader,
  shaderConstraints, // Record<string, UniformFieldValue>
  {
    u_speed: "e.{time * 0.5}",
    u_position: {
      x: "e.{sin(time)}",
      y: "e.{cos(time)}",
    },
  },
);
```

### useShaderOrchestrator

A hook that manages shared shader materials for efficient rendering.

### useShaderMaterialOrchestrator

A hook that handles shared shader material instances.

### useTextureRenderPipeline

A hook for managing texture render targets and their rendering process.
