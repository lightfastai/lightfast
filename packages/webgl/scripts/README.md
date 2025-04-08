# WebGL Shader Code Generation Scripts

This directory contains scripts used for the WebGL shader registration system.

## Overview

The shader registration system uses a compile-time code generation approach to:

1. Discover shader implementations in the codebase
2. Generate a static enum with all shader types
3. Create a registry file that loads all shaders automatically

This eliminates the need for manual registration and maintenance of shader types.

## Scripts

### `generate-shader-registry.ts`

The main code generation script that:

- Scans the `src/shaders/impl` directory for shader implementations
- Extracts shader metadata from each file
- Generates type-safe enums and registration code
- Creates files in the `src/generated` directory

Run this script before building the application:

```bash
npx ts-node scripts/generate-shader-registry.ts
```

### `gen-initial.sh`

A bootstrapping script that:

- Creates the output directory structure
- Initializes placeholder files to satisfy imports
- Attempts to run the generator if dependencies are available

Run this once to initialize the system:

```bash
bash scripts/gen-initial.sh
```

## Integration

To integrate with your build process:

1. Add the following to your `package.json`:

```json
{
  "scripts": {
    "generate-shaders": "ts-node scripts/generate-shader-registry.ts",
    "prebuild": "npm run generate-shaders",
    "predev": "npm run generate-shaders"
  }
}
```

2. Install development dependencies:

```bash
npm install -D ts-node glob
```

## Creating a New Shader

1. Create a new file in `src/shaders/impl/your-shader.ts`
2. Define the shader using the template pattern
3. Include a `SHADER_NAME` constant
4. Export a shader definition with a name ending in `ShaderDefinition`
5. Run the generator or build the project

The script will automatically detect your shader and generate the necessary code.

## Troubleshooting

If you encounter issues:

- Ensure your shader follows the expected format
- Check that `SHADER_NAME` is defined
- Verify the shader definition is exported with a name ending in `ShaderDefinition`
- Run the generator with Node debugging for more detailed information:
  ```bash
  NODE_DEBUG=* npx ts-node scripts/generate-shader-registry.ts
  ```
