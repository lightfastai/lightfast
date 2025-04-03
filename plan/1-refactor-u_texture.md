# Texture System Reimplementation Tasks

Here's a breakdown of the tasks needed to implement the improved texture system, organized in a sequential order that minimizes dependencies and allows for incremental progress:

## Phase 1: Schema and Type Definitions

### Task 1: Create TextureHandle Schema

- Create/update `vendor/db/src/schema/types/TextureHandle.ts`
- Implement regex-based handle ID validation
- Add helper functions for handle ID generation and parsing
- Create functions to map between handle IDs and uniform names

```tsx
// Regular expression for validating handle IDs in the format "input-N"
export const TEXTURE_HANDLE_ID_REGEX = /^input-\d+$/;

// Zod schema for validating texture handle IDs
export const $TextureHandleId = z.string().regex(TEXTURE_HANDLE_ID_REGEX, {
  message:
    "Handle ID must be in the format 'input-N' where N is a positive integer",
});

// Helper function to generate a handle ID from an index
export function generateTextureHandleId(index: number): string {
  return `input-${index + 1}`; // Convert from zero-based to one-based
}

// Helper function to get the numeric index from a handle ID
export function getTextureHandleIndex(handleId: string): number | null {
  if (!isValidTextureHandleId(handleId)) return null;
  const match = handleId.match(/^input-(\d+)$/);
  if (!match?.[1]) return null;
  return parseInt(match[1], 10) - 1; // Convert to zero-based index
}
```

### Task 2: Create TextureUniform Type

- Create `packages/webgl/src/types/texture-uniform.ts`
- Define TextureReference interface and TextureUniform type
- Implement Zod schema for texture uniforms
- Add helper functions for creating and manipulating texture uniforms

```tsx
import { z } from "zod";

// Represents a texture reference in the shader system
export interface TextureReference {
  id: string | null; // The ID of the source texture node
  textureObject: any; // The actual WebGL/Three.js texture object
  isConnected: boolean; // Whether this texture input has a connection
}

// Zod schema for texture uniforms
export const $TextureUniform = z
  .object({
    id: z.string().nullable(),
    textureObject: z.any().nullable(),
    isConnected: z.boolean().default(false),
  })
  .nullable();

export type TextureUniform = z.infer<typeof $TextureUniform>;

// Factory function to create a texture uniform schema with description
export function createTextureUniformSchema(description: string) {
  return $TextureUniform.describe(description);
}
```

### Task 3: Update Edge Schema

- Modify `vendor/db/src/schema/tables/Edge.ts`
- Update validation for handle IDs using the new schema
- Add helper functions for working with edges and handles
- Ensure backward compatibility with existing edges

```tsx
import {
  $TextureHandleId,
  isValidTextureHandleId,
} from "../types/TextureHandle";

// Enhanced schema with handle validation
export const InsertEdgeSchema = z.object({
  source: z.string().min(1).max(191),
  target: z.string().min(1).max(191),
  sourceHandle: z
    .string()
    .max(191)
    .optional()
    .refine((val) => val === undefined || isValidTextureHandleId(val), {
      message: "Source handle must follow the 'input-N' format or be undefined",
    }),
  targetHandle: z
    .string()
    .max(191)
    .optional()
    .refine((val) => val === undefined || isValidTextureHandleId(val), {
      message: "Target handle must follow the 'input-N' format or be undefined",
    }),
});

// Helper function to get the corresponding uniform name for a handle
export function getUniformForEdge(edge: {
  targetHandle?: string | null;
}): string | null {
  if (!edge.targetHandle) return null;
  return getUniformNameFromTextureHandleId(edge.targetHandle);
}
```

## Phase 2: Shader System Updates

### Task 4: Refactor Shader Definitions

- Update shader files (add.ts, displace.ts, limit.ts, pnoise.ts)
- Separate texture uniforms from regular uniforms
- Use the new TextureUniform type for texture inputs
- Create helper functions for generating shader schemas

```tsx
import { getTextureInputsMetadata } from "@vendor/db/schema/types/TextureHandle";

import { createTextureUniformSchema } from "../types/texture-uniform";

// Define texture uniforms separately
export const $AddTextureUniforms = z.object({
  u_texture1: createTextureUniformSchema("The first input texture (A)"),
  u_texture2: createTextureUniformSchema("The second input texture (B)"),
});

// Define regular uniforms
export const $AddRegularUniforms = z.object({
  u_addValue: $Float
    .describe("Constant value to add to the result")
    .transform((val) => Math.max(-1, Math.min(1, val)))
    .default(0.0),
  u_enableMirror: $Boolean
    .default(false)
    .describe("Whether to mirror the result vertically"),
});

// Combine them for the full shader definition
export const $Add = $AddTextureUniforms.merge($AddRegularUniforms);
```

### Task 5: Create Texture Type Registry or Perhaps a simple lookup table

- Automatically generate the lookup table from the shader files based on the $<Texture>TextureUniforms
- Remove `getMaxTargetEdges` from `Node.ts`

### Task 6: Update Default Texture Creation

- Modify createDefaultTexture functions in shader files
- Use the new schema for initializing texture uniforms
- Ensure backward compatibility with existing textures

```tsx
import {
  createTextureUniform,
  TextureUniform,
} from "@repo/webgl/types/texture-uniform";

export const createDefaultTexture = ({
  type,
}: {
  type: TextureType;
}): Texture => {
  switch (type) {
    case $TextureTypes.enum.Add:
      return {
        type,
        uniforms: {
          // Use the new TextureUniform type for texture inputs
          u_texture1: createTextureUniform(null, null),
          u_texture2: createTextureUniform(null, null),
          // Regular uniforms remain the same
          u_addValue: 0.0,
          u_enableMirror: false,
        },
        resolution: { width: 256, height: 256 },
      };
    // Other cases...
  }
};
```

## Phase 3: Workspace Component Updates

### Task 7: Update TextureNode Component

- Modify `apps/app/src/app/(app)/(workspace)/workspace/components/nodes/texture-node.tsx`
- Use the texture handle schema to generate handles dynamically
- Implement improved UI for displaying handles
- Add visual indicators for required vs. optional handles

```tsx
import { getTextureInputsMetadata } from "@vendor/db/schema/types/TextureHandle";

export const TextureNode = memo(
  ({ id, type, selected }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Texture>({ id });

    // Get handle configuration from the schema
    const handleConfig = getTextureInputsMetadata(data.type);

    return (
      <BaseNodeComponent
        id={id}
        selected={selected}
        onClick={() => setSelected({ id, type })}
      >
        {/* Node header */}
        <div className="flex flex-row items-center justify-between">
          <Label className="font-mono text-xs font-bold uppercase tracking-widest">
            {data.type} {id}
          </Label>
        </div>

        {/* Input handles */}
        <div className="mt-1 flex flex-row gap-1">
          <div className="flex h-full flex-col items-center justify-center">
            {handleConfig.map((handle, index) => {
              const topPercentage =
                handleConfig.length > 1
                  ? (index / (handleConfig.length - 1)) * 100
                  : 50;

              return (
                <div key={handle.id} className="handle-container">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Handle
                            id={handle.id}
                            type="target"
                            position={Position.Left}
                            className={`h-10 w-3 ${handle.required ? "required-handle" : ""}`}
                            style={{ top: `${topPercentage}%` }}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        {handle.description}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              );
            })}
          </div>

          {/* Node content */}
          <div className="h-32 w-72 border">
            {targets[id]?.texture && (
              <WebGLView>
                <mesh
                  geometry={GeometryMap[$GeometryType.Enum.plane]}
                  scale={3}
                >
                  <meshBasicMaterial map={targets[id].texture} />
                </mesh>
              </WebGLView>
            )}
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
```

### Task 8: Update Edge Connection Logic

- Modify `apps/app/src/app/(app)/(workspace)/workspace/components/workspace/workspace.tsx`
- Use the new schema for validating connections
- Implement improved connection management
- Ensure backward compatibility with existing connections

```tsx
import { getTextureInputsMetadata } from "@vendor/db/schema/types/TextureHandle";

const onConnect = useCallback(
  async (params: Connection) => {
    // Get node data to check texture type
    const targetNode = nodes.find((node) => node.id === params.target);
    if (!targetNode || targetNode.type !== "texture") return;

    const nodeData = await utils.tenant.node.data.get.fetch({
      id: params.target,
    });
    if (!nodeData || !("type" in nodeData)) return;

    // Get handle configuration for this texture type
    const handleConfig = getTextureInputsMetadata(nodeData.type);
    const targetHandle = params.targetHandle || "input-1";

    // Find the handle in the configuration
    const handleInfo = handleConfig.find((h) => h.id === targetHandle);
    if (!handleInfo) return;

    // For required handles, replace any existing connection
    if (handleInfo.required) {
      const existingEdge = edges.find(
        (edge) =>
          edge.target === params.target && edge.targetHandle === targetHandle,
      );

      if (existingEdge) {
        await replaceEdgeMutate(existingEdge.id, params);
      } else {
        await addEdgeMutate(params);
      }
    } else {
      // For optional handles, just add the connection
      await addEdgeMutate(params);
    }
  },
  [replaceEdgeMutate, addEdgeMutate, edges, nodes, utils.tenant.node.data],
);
```

### Task 9: Update Texture Update Hooks

- Modify hooks like useUpdateTextureAdd
- Use the new TextureUniform type for updating shader uniforms
- Implement separate handling for texture uniforms vs. regular uniforms
- Optimize performance for texture updates

```tsx
import {
  isTextureUniform,
  updateTextureUniform,
} from "@repo/webgl/types/texture-uniform";
import { getTextureInputsMetadata } from "@vendor/db/schema/types/TextureHandle";

export const useUpdateTextureAdd = ({
  textureDataMap,
}: UpdateTextureAddProps): WebGLRenderTargetNode[] => {
  // ...existing code...

  return useMemo(() => {
    return Object.entries(textureDataMap)
      .filter(([_, data]) => data.type === "Add")
      .map(([id, data]) => {
        // Create or get cached shader
        const shader =
          shaderCache.current[id] ||
          new THREE.ShaderMaterial({
            vertexShader: baseVertexShader,
            fragmentShader: addFragmentShader,
            uniforms: {
              // Initialize uniforms...
            },
          });

        return {
          id,
          shader,
          onEachFrame: (state: WebGLRootState) => {
            // Get texture handle configuration
            const textureHandles = getTextureInputsMetadata("Add");

            // Update texture uniforms based on connections
            textureHandles.forEach((handle) => {
              const uniformName = handle.uniformName;
              if (shader.uniforms[uniformName]) {
                const sourceId = connectionCache.current[id]?.[handle.id];
                const textureObject = sourceId
                  ? targets[sourceId]?.texture
                  : null;

                // Update the shader uniform
                shader.uniforms[uniformName].value = textureObject;

                // Also update the data structure for serialization if needed
                if (isTextureUniform(data.uniforms[uniformName])) {
                  data.uniforms[uniformName] = updateTextureUniform(
                    data.uniforms[uniformName],
                    sourceId,
                    textureObject,
                  );
                }
              }
            });

            // Update regular uniforms using the expression evaluator
            updateShaderUniforms(state, shader, expressions, uniformPathMap);
          },
        };
      });
  }, [textureDataMap, targets, updateShaderUniforms]);
};
```
