import * as THREE from "three";
import { assign, setup } from "xstate";

import type { Texture, TextureType } from "../texture/types";
import type {
  Geometry,
  GeometryType,
  Material,
  MaterialType,
} from "~/components/types";
import { TEXTURE_RESOLUTION } from "~/components/constants";
import { $Texture } from "../texture/schema";

type CanvasEvent =
  /** Add a geometry to the canvas */
  | { type: "ADD_GEOMETRY"; geometry: Geometry }
  | { type: "DELETE_GEOMETRY"; geometryId: number }
  | { type: "UPDATE_GEOMETRY"; geometryId: number; value: Partial<Geometry> }
  | { type: "SELECT_GEOMETRY"; geometry: GeometryType }

  /** Add a material to the canvas */
  | { type: "ADD_MATERIAL"; material: Material }
  | { type: "DELETE_MATERIAL"; materialId: number }
  | { type: "UPDATE_MATERIAL"; materialId: number; value: Partial<Material> }
  | { type: "SELECT_MATERIAL"; material: MaterialType }

  /** Add a texture to the canvas */
  | { type: "ADD_TEXTURE"; texture: Texture }
  | { type: "DELETE_TEXTURE"; textureId: number }
  | { type: "UPDATE_TEXTURE"; textureId: number; value: Partial<Texture> }
  | {
      type: "UPDATE_TEXTURE_UNIFORMS";
      textureId: number;
      value: Partial<Texture["uniforms"]>;
    }
  | { type: "SELECT_TEXTURE"; texture: TextureType }

  /** History */
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "CLEAR" }

  /** Utilities */
  | { type: "TOGGLE_COMMAND" }
  | {
      type: "UPDATE_SELECTED_PROPERTY";
      property: Geometry | Material | Texture;
    }
  | {
      type: "START_CONNECTION";
      sourceId: number;
    }
  | { type: "END_CONNECTION"; targetId: number }
  | { type: "CANCEL_CONNECTION" };

interface CanvasContext {
  textures: Texture[];
  rtargets: Record<number, THREE.WebGLRenderTarget>;
  geometries: Geometry[];
  materials: Material[];
  selectedTexture: TextureType | null;
  selectedGeometry: GeometryType | null;
  selectedMaterial: MaterialType | null;
  selectedProperty: Geometry | Material | Texture | null;
  isPlacingTexture: boolean;
  isPlacingGeometry: boolean;
  isPlacingMaterial: boolean;
  history: {
    past: {
      geometries: Geometry[];
      materials: Material[];
      textures: Texture[];
    }[];
    future: {
      geometries: Geometry[];
      materials: Material[];
      textures: Texture[];
    }[];
  };
  isCommandOpen: boolean;
  activeConnection: {
    sourceId: number | null;
  } | null;
}

export const canvasMachine = setup({
  types: {
    context: {} as CanvasContext,
    events: {} as CanvasEvent,
  },
  guards: {
    historyValid: ({ context }) => context.history.past.length > 0,
    validateTexture: ({ event }) => {
      if (event.type !== "ADD_TEXTURE") return false;
      try {
        $Texture.parse(event.texture);
        return true;
      } catch {
        return false;
      }
    },
  },
}).createMachine({
  id: "canvas",
  initial: "idle",
  context: {
    textures: [],
    geometries: [],
    materials: [],
    rtargets: {},
    selectedTexture: null,
    selectedGeometry: null,
    selectedMaterial: null,
    selectedProperty: null,
    isPlacingTexture: false,
    isPlacingGeometry: false,
    isPlacingMaterial: false,
    history: {
      past: [],
      future: [],
    },
    isCommandOpen: false,
    activeConnection: null,
  },
  states: {
    idle: {
      on: {
        SELECT_TEXTURE: {
          actions: assign({
            selectedTexture: ({ event }) => event.texture,
            isCommandOpen: false,
            isPlacingTexture: true,
          }),
        },
        ADD_TEXTURE: {
          guard: "validateTexture",
          actions: assign(({ context, event }) => ({
            textures: [...context.textures, event.texture],
            selectedTexture: null,
            selectedProperty: event.texture,
            isPlacingTexture: false,
            rtargets: {
              ...context.rtargets,
              [event.texture.id]: new THREE.WebGLRenderTarget(
                TEXTURE_RESOLUTION.x,
                TEXTURE_RESOLUTION.y,
              ),
            },
            history: {
              past: [
                ...context.history.past,
                {
                  geometries: context.geometries,
                  materials: context.materials,
                  textures: context.textures,
                },
              ],
              future: [],
            },
          })),
        },
        DELETE_TEXTURE: {
          actions: assign(({ context, event }) => {
            const updatedTextures = context.textures
              .map((texture) => ({
                ...texture,
                // Remove deleted texture from outputs
                outputs: texture.outputs.filter((id) => id !== event.textureId),
                // Clear input if it was the deleted texture
                input: texture.input === event.textureId ? null : texture.input,
              }))
              .filter((texture) => texture.id !== event.textureId);

            return {
              textures: updatedTextures,
              rtargets: Object.fromEntries(
                Object.entries(context.rtargets).filter(
                  ([key]) => key !== event.textureId.toString(), // @todo record is based on string during filter, but value is number. weird.
                ),
              ),
              history: {
                past: [
                  ...context.history.past,
                  {
                    geometries: context.geometries,
                    materials: context.materials,
                    textures: context.textures,
                  },
                ],
                future: [],
              },
            };
          }),
        },
        UPDATE_TEXTURE: {
          actions: assign(({ context, event }) => ({
            textures: context.textures.map((texture) =>
              texture.id === event.textureId
                ? ({ ...texture, ...event.value } as Texture)
                : texture,
            ),
            history: {
              past: [
                ...context.history.past,
                {
                  geometries: context.geometries,
                  materials: context.materials,
                  textures: context.textures,
                },
              ],
              future: [],
            },
          })),
        },
        UPDATE_TEXTURE_UNIFORMS: {
          actions: assign(({ context, event }) => {
            const updatedTextures: Texture[] = context.textures.map(
              (texture) =>
                texture.id === event.textureId
                  ? ({
                      ...texture,
                      uniforms: { ...texture.uniforms, ...event.value },
                    } as Texture)
                  : texture,
            );
            return {
              textures: updatedTextures,
              history: {
                past: [
                  ...context.history.past,
                  {
                    geometries: context.geometries,
                    materials: context.materials,
                    textures: context.textures,
                  },
                ],
                future: [],
              },
            };
          }),
        },
        SELECT_GEOMETRY: {
          actions: assign({
            selectedGeometry: ({ event }) => event.geometry,
            isCommandOpen: false,
            isPlacingGeometry: true,
          }),
        },
        ADD_GEOMETRY: {
          actions: assign(({ context, event }) => ({
            geometries: [...context.geometries, event.geometry],
            selectedGeometry: null,
            selectedProperty: event.geometry,
            isPlacingGeometry: false,
            history: {
              past: [
                ...context.history.past,
                {
                  geometries: context.geometries,
                  materials: context.materials,
                  textures: context.textures,
                },
              ],
              future: [],
            },
          })),
        },
        UPDATE_GEOMETRY: {
          actions: assign(({ context, event }) => ({
            geometries: context.geometries.map((geometry) =>
              geometry.id === event.geometryId
                ? { ...geometry, ...event.value }
                : geometry,
            ),
            history: {
              past: [
                ...context.history.past,
                {
                  geometries: context.geometries,
                  materials: context.materials,
                  textures: context.textures,
                },
              ],
              future: [],
            },
          })),
        },
        DELETE_GEOMETRY: {
          actions: assign(({ context, event }) => ({
            geometries: context.geometries.filter(
              (geometry) => geometry.id !== event.geometryId,
            ),
            history: {
              past: [
                ...context.history.past,
                {
                  geometries: context.geometries,
                  materials: context.materials,
                  textures: context.textures,
                },
              ],
              future: [],
            },
          })),
        },
        SELECT_MATERIAL: {
          actions: assign({
            selectedMaterial: ({ event }) => event.material,
            isCommandOpen: false,
            isPlacingMaterial: true,
          }),
        },
        ADD_MATERIAL: {
          actions: assign(({ context, event }) => ({
            materials: [...context.materials, event.material],
            selectedMaterial: null,
            selectedProperty: event.material,
            isPlacingMaterial: false,
            history: {
              past: [
                ...context.history.past,
                {
                  geometries: context.geometries,
                  materials: context.materials,
                  textures: context.textures,
                },
              ],
              future: [],
            },
          })),
        },
        DELETE_MATERIAL: {
          actions: assign(({ context, event }) => ({
            materials: context.materials.filter(
              (material) => material.id !== event.materialId,
            ),
            history: {
              past: [
                ...context.history.past,
                {
                  geometries: context.geometries,
                  materials: context.materials,
                  textures: context.textures,
                },
              ],
              future: [],
            },
          })),
        },
        TOGGLE_COMMAND: {
          actions: assign({
            isCommandOpen: ({ context }) => !context.isCommandOpen,
          }),
        },
        UPDATE_MATERIAL: {
          actions: assign(({ context, event }) => ({
            materials: context.materials.map((material) =>
              material.id === event.materialId
                ? { ...material, ...event.value }
                : material,
            ),
            history: {
              past: [
                ...context.history.past,
                {
                  geometries: context.geometries,
                  materials: context.materials,
                  textures: context.textures,
                },
              ],
              future: [],
            },
          })),
        },
        UPDATE_SELECTED_PROPERTY: {
          actions: assign({
            selectedProperty: ({ event }) => event.property,
          }),
        },
        UNDO: {
          actions: assign(({ context }) => {
            if (context.history.past.length === 0) return context;
            const newPast = context.history.past.slice(0, -1);
            const previousState =
              context.history.past[context.history.past.length - 1];
            return {
              geometries: previousState?.geometries ?? [],
              materials: previousState?.materials ?? [],
              textures: previousState?.textures ?? [],
              history: {
                past: newPast,
                future: [
                  {
                    geometries: context.geometries,
                    materials: context.materials,
                    textures: context.textures,
                  },
                  ...context.history.future,
                ],
              },
            };
          }),
          guard: "historyValid",
        },
        REDO: {
          actions: assign(({ context }) => {
            if (context.history.future.length === 0) return context;
            const [nextState, ...newFuture] = context.history.future;
            return {
              geometries: nextState?.geometries ?? [],
              materials: nextState?.materials ?? [],
              textures: nextState?.textures ?? [],
              history: {
                past: [
                  ...context.history.past,
                  {
                    geometries: context.geometries,
                    materials: context.materials,
                    textures: context.textures,
                  },
                ],
                future: newFuture,
              },
            };
          }),
          guard: "historyValid",
        },
        CLEAR: {
          actions: assign({
            geometries: [],
            materials: [],
            textures: [],
            selectedGeometry: null,
            selectedMaterial: null,
            selectedProperty: null,
            selectedTexture: null,
            isPlacingGeometry: false,
            isPlacingMaterial: false,
            isPlacingTexture: false,
            history: {
              past: [],
              future: [],
            },
            isCommandOpen: false,
          }),
        },
        START_CONNECTION: {
          actions: assign({
            activeConnection: ({ event }) => ({
              sourceId: event.sourceId,
            }),
          }),
        },
        END_CONNECTION: {
          actions: [
            assign(({ context, event }) => {
              const targetTexture = context.textures.find(
                (t) => t.id === event.targetId,
              );
              const oldSourceId = targetTexture?.input;

              // Update textures array
              const updatedTextures = context.textures.map((texture) => {
                // Remove connection from old source if it exists
                if (texture.id === oldSourceId) {
                  return {
                    ...texture,
                    outputs: texture.outputs.filter(
                      (id) => id !== event.targetId,
                    ),
                  };
                }

                // Add connection to new source
                if (texture.id === context.activeConnection?.sourceId) {
                  return {
                    ...texture,
                    outputs: [...texture.outputs, event.targetId],
                  };
                }

                // Update target with new input
                if (texture.id === event.targetId) {
                  return {
                    ...texture,
                    input: context.activeConnection?.sourceId ?? null,
                  };
                }
                return texture;
              });

              return {
                textures: updatedTextures,
                activeConnection: null,
                history: {
                  past: [
                    ...context.history.past,
                    {
                      geometries: context.geometries,
                      materials: context.materials,
                      textures: context.textures,
                    },
                  ],
                  future: [],
                },
              };
            }),
          ],
        },
        CANCEL_CONNECTION: {
          actions: assign({ activeConnection: null }),
        },
      },
    },
  },
});
