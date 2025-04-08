# WebGL Shader System

This directory contains the shader system for the WebGL package. The system allows for:

1. Compile-time shader registration
2. Type-safe shader definitions and validation
3. Simplified developer workflow

## Adding a New Shader

Creating a new shader is now simpler than ever. Follow these steps:

1. Copy the template from `template/example-shader.ts` to create your new shader file in `impl/`
2. Name the file according to your shader's purpose (e.g., `bloom-shader.ts`)
3. Update the `SHADER_NAME` constant to match your shader's name
4. Implement the shader's uniforms, constraints, and fragment shader code
5. Run the build or directly run the generation script: `npm run generate-shaders`

No need to manually update enum files or registration code. The build script automatically:

- Detects shader definitions in your code
- Generates a static enum file with all shader types
- Creates a static registration file that loads all shaders
- Makes all shaders available through type-safe APIs

## Shader File Structure

Each shader file should follow this structure:

1. Define the shader name using a `SHADER_NAME` constant
2. Create texture handles (if needed)
3. Define the uniform schema with Zod
4. Create a type for the params
5. Define a function that creates default values
6. Define uniform constraints
7. Create the fragment shader code
8. Export the shader definition as `{name}ShaderDefinition`

See `template/example-shader.ts` for a complete example with comments.

## Compile-Time Registration

The shader registration process happens at compile time:

1. The script `scripts/generate-shader-registry.js` scans the `impl/` directory for shader definitions
2. It generates a static enum file (`generated/shader-enum.generated.ts`)
3. It generates a registration file (`generated/shader-registry.generated.ts`)
4. These files are imported and used by the WebGL system

This ensures all shaders are properly registered without any runtime overhead.

## Build Integration

The shader generation is automatically integrated with the build process:

```json
{
  "scripts": {
    "generate-shaders": "node scripts/generate-shader-registry.js",
    "prebuild": "npm run generate-shaders",
    "predev": "npm run generate-shaders"
  }
}
```

This ensures the shader registry is up-to-date whenever you build or start development.

## Migration Guide

To migrate existing shaders to the new system:

1. Add a `SHADER_NAME` constant at the top of the file
2. Ensure your shader definition is exported with a name ending in `ShaderDefinition`
3. Run the generator or build the project

## Troubleshooting

If you encounter issues:

- Ensure your shader follows the expected format
- Check that `SHADER_NAME` is defined
- Verify the shader definition is exported with a name ending in `ShaderDefinition`
- Run the generator script directly to see detailed output

## Advanced Usage

For advanced use cases, you can:

- Customize the code generation script to match your project's structure
- Add validation or linting to the generated code
- Integrate with other build tools like webpack or rollup
