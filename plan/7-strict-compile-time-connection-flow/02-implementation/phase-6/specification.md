# Phase 6: WebGL Registry - Specification

## Overview

This phase updates the WebGL registry to work with the new handle type system. The registry provides information about available texture types, their inputs, and their requirements, which is crucial for ensuring valid connections between nodes.

## Requirements

1. Update texture registry to use TextureHandleId for input definitions
2. Ensure TextureFieldMetadata uses the new type system
3. Integrate with the Edge validation system
4. Maintain backward compatibility with existing code

## Technical Design

### Update TextureFieldMetadata

```typescript
// packages/webgl/src/types/field.ts
import { TextureHandleId } from "@vendor/db/types";

// Update field metadata to use TextureHandleId
export interface TextureFieldMetadata {
  id: TextureHandleId; // Now using branded type
  uniformName: string;
  description: string;
  required: boolean;
}
```

### Update Texture Registry

```typescript
// packages/webgl/src/types/texture-registry.ts
import {
  createTextureHandleId,
  generateTextureHandleId,
  TextureHandleId,
} from "@vendor/db/types";

import { TextureFieldMetadata } from "./field";

// Registry that maps texture types to their input definitions
export interface TextureRegistry {
  [textureType: string]: {
    inputs: TextureFieldMetadata[];
    maxInputs: number;
  };
}

// Map of texture types to their input metadata
export const textureRegistry: TextureRegistry = {
  noise: {
    inputs: [
      {
        id: generateTextureHandleId(0), // input-1
        uniformName: "u_texture1",
        description: "Displacement map",
        required: false,
      },
    ],
    maxInputs: 1,
  },
  displace: {
    inputs: [
      {
        id: generateTextureHandleId(0), // input-1
        uniformName: "u_texture1",
        description: "Base texture",
        required: true,
      },
      {
        id: generateTextureHandleId(1), // input-2
        uniformName: "u_texture2",
        description: "Displacement map",
        required: true,
      },
    ],
    maxInputs: 2,
  },
  // Other texture types...
};

/**
 * Get input metadata for a specific texture type
 */
export function getTextureInputsForType(
  textureType: string,
): TextureFieldMetadata[] {
  // If the texture type doesn't exist in the registry, return an empty array
  if (!textureRegistry[textureType]) {
    return [];
  }

  return textureRegistry[textureType].inputs;
}

/**
 * Get the maximum number of inputs for a texture type
 */
export function getMaxInputsForType(textureType: string): number {
  if (!textureRegistry[textureType]) {
    return 0;
  }

  return textureRegistry[textureType].maxInputs;
}

/**
 * Validate that a texture handle is valid for a given texture type
 */
export function isValidTextureHandleForType(
  textureType: string,
  handleId: TextureHandleId,
): boolean {
  const inputs = getTextureInputsForType(textureType);
  return inputs.some((input) => input.id === handleId);
}

/**
 * Check if a handle ID is required for a texture type
 */
export function isRequiredTextureHandle(
  textureType: string,
  handleId: TextureHandleId,
): boolean {
  const inputs = getTextureInputsForType(textureType);
  const input = inputs.find((input) => input.id === handleId);
  return input?.required ?? false;
}
```

### Integration with Validation System

```typescript
// apps/app/src/app/(app)/(workspace)/workspace/hooks/use-validate-texture-connection.ts
import { useCallback } from "react";
import { Connection } from "@xyflow/react";

import {
  isRequiredTextureHandle,
  isValidTextureHandleForType,
} from "@repo/webgl";
import {
  isOutputHandleId,
  isTextureHandleId,
  TextureHandleId,
} from "@vendor/db/types";

import { getNodeType, useNodeStore } from "../providers/node-store-provider";
import {
  ConnectionValidationResult,
  validateConnection,
} from "../types/connection";

/**
 * Hook for validating texture connections
 */
export const useValidateTextureConnection = () => {
  const { nodes } = useNodeStore();

  /**
   * Validate a connection with the texture registry
   */
  const validateTextureConnection = useCallback(
    (connection: Connection): ConnectionValidationResult => {
      // First validate the connection structure
      const basicValidation = validateConnection(connection);
      if (!basicValidation.valid) {
        return basicValidation;
      }

      const strictConnection = basicValidation.connection;

      // Check handle types
      const sourceIsOutput = isOutputHandleId(strictConnection.sourceHandle);
      const targetIsInput = isTextureHandleId(strictConnection.targetHandle);

      if (!sourceIsOutput || !targetIsInput) {
        return {
          valid: false,
          reason: "invalid_connection_type",
          details: "Texture connections must be from output to input handles",
        };
      }

      // Get node types
      const sourceNode = nodes.find((n) => n.id === strictConnection.source);
      const targetNode = nodes.find((n) => n.id === strictConnection.target);

      if (!sourceNode || !targetNode) {
        return {
          valid: false,
          reason: "node_not_found",
          details: "Source or target node not found",
        };
      }

      const sourceType = getNodeType(sourceNode);
      const targetType = getNodeType(targetNode);

      // Validate target handle with the registry
      const targetHandle = strictConnection.targetHandle as TextureHandleId;

      if (!isValidTextureHandleForType(targetType, targetHandle)) {
        return {
          valid: false,
          reason: "invalid_texture_handle",
          details: `Handle ${targetHandle} is not valid for texture type ${targetType}`,
        };
      }

      return {
        valid: true,
        connection: strictConnection,
      };
    },
    [nodes],
  );

  return {
    validateTextureConnection,
  };
};
```

## Dependencies

1. Phase 1: Enhanced Handle Types - The branded types are used in the registry
2. Phase 2: Connection Types - Integration with the validation system
3. Phase 3: Edge Schema - Integration with the Edge schema
4. Phase 5: Hook Logic - Integration with the hook logic

## Impact Analysis

| Component              | Changes Required                         |
| ---------------------- | ---------------------------------------- |
| TextureFieldMetadata   | Update to use TextureHandleId            |
| Texture Registry       | Update to use the new type system        |
| Validation Integration | New hook for texture-specific validation |
| WebGL Components       | No changes yet (addressed in Phase 8)    |

## Acceptance Criteria

1. ✅ TextureFieldMetadata uses TextureHandleId
2. ✅ Texture registry is updated to use the new type system
3. ✅ Integration with the connection validation system
4. ✅ New methods for validating texture-specific connections
5. ✅ Existing code continues to work with the updated registry
6. ✅ All tests continue to pass
