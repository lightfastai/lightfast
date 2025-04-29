#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======== Shader Registry Initialization ========${NC}"

# Create the generated directory if it doesn't exist
if [ ! -d "src/generated" ]; then
  mkdir -p src/generated
  echo -e "${GREEN}✓ Created output directory: src/generated${NC}"
else
  echo -e "${YELLOW}⚠ Output directory already exists, continuing...${NC}"
fi

# Create placeholder files to satisfy imports until the real generation runs
if [ ! -f src/generated/shader-enum.generated.ts ]; then
  echo -e "${BLUE}Creating placeholder enum file...${NC}"
  echo 'import { z } from "zod";

/**
 * PLACEHOLDER FILE
 * This file will be replaced by the shader generator
 */

export const $ShaderValues = ["Add", "Limit", "Displace", "Noise"] as const;

export const $Shaders = z.enum($ShaderValues);

export type Shaders = z.infer<typeof $Shaders>;
' > src/generated/shader-enum.generated.ts
  echo -e "${GREEN}✓ Created placeholder enum file${NC}"
else
  echo -e "${YELLOW}⚠ Enum file already exists, skipping${NC}"
fi

if [ ! -f src/generated/shader-registry.generated.ts ]; then
  echo -e "${BLUE}Creating placeholder registry file...${NC}"
  echo 'import { registerShader } from "../registry";

/**
 * PLACEHOLDER FILE
 * This file will be replaced by the shader generator
 * 
 * Do not import real shaders here - this is just to satisfy imports
 * until the generator runs.
 */

export function registerGeneratedShaders(): void {
  // This is a placeholder until the real generation runs
  console.warn("Using placeholder shader registry - run the generator!");
}

// Placeholder - no shaders registered yet
registerGeneratedShaders();
' > src/generated/shader-registry.generated.ts
  echo -e "${GREEN}✓ Created placeholder registry file${NC}"
else
  echo -e "${YELLOW}⚠ Registry file already exists, skipping${NC}"
fi

# Run the generator if ts-node is available
echo -e "${BLUE}Attempting to run shader registry generator...${NC}"
if command -v ts-node &> /dev/null; then
  echo -e "${BLUE}Running shader registry generator...${NC}"
  ts-node scripts/generate-shader-registry.ts
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Generator ran successfully${NC}"
  else
    echo -e "${RED}✗ Generator failed${NC}"
    echo -e "${YELLOW}⚠ Using placeholder files for now${NC}"
  fi
else
  echo -e "${YELLOW}⚠ ts-node not found - placeholders created, install dependencies to run the generator${NC}"
  echo -e "${YELLOW}⚠ Run 'npm install -D ts-node glob' to install dependencies${NC}"
fi

echo -e "${GREEN}✓ Initial setup complete!${NC}"
echo -e "${BLUE}---------------------------------------${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Add the following to your package.json scripts:"
echo -e "   \"generate-shaders\": \"ts-node scripts/generate-shader-registry.ts\","
echo -e "   \"prebuild\": \"npm run generate-shaders\""
echo -e "2. Run 'npm run generate-shaders' to create the real shader registry"
echo -e "${BLUE}---------------------------------------${NC}" 