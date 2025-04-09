// apps/app/src/app/(app)/(workspace)/workspace/stores/shader-cache-store.ts

import type * as THREE from "three";
import { createStore } from "zustand";

// Types for the store
interface ShaderCacheState {
  // Main cache for shaders indexed by node ID
  shaders: Record<string, THREE.ShaderMaterial>;
  // Cache for storing the last time a shader was accessed
  lastAccessed: Record<string, number>;
}

// Store interface including state and actions
export interface ShaderCacheStore extends ShaderCacheState {
  // Get a shader from the cache
  getShader: (id: string) => THREE.ShaderMaterial | null;
  // Store a shader in the cache
  setShader: (id: string, shader: THREE.ShaderMaterial) => void;
  // Check if a shader exists in the cache
  hasShader: (id: string) => boolean;
  // Remove a shader and dispose resources
  removeShader: (id: string) => void;
  // Clean up old shaders that haven't been accessed for a while
  cleanupOldShaders: (maxAgeMs: number) => void;
  // Dispose all shaders and clear the cache
  clearAll: () => void;
}

// Initial state for the store
export const initialShaderCacheState: ShaderCacheState = {
  shaders: {},
  lastAccessed: {},
};

// Create the store
export const createShaderCacheStore = (
  initState: ShaderCacheState = initialShaderCacheState,
) => {
  return createStore<ShaderCacheStore>()((set, get) => ({
    ...initState,

    getShader: (id: string) => {
      const shader = get().shaders[id] ?? null;

      // Update last accessed time if shader exists
      if (shader) {
        set((state) => ({
          lastAccessed: {
            ...state.lastAccessed,
            [id]: Date.now(),
          },
        }));
      }

      return shader;
    },

    setShader: (id: string, shader: THREE.ShaderMaterial) => {
      // Store the shader and update access time
      set((state) => ({
        shaders: {
          ...state.shaders,
          [id]: shader,
        },
        lastAccessed: {
          ...state.lastAccessed,
          [id]: Date.now(),
        },
      }));
    },

    hasShader: (id: string) => {
      return !!get().shaders[id];
    },

    removeShader: (id: string) => {
      const { shaders, lastAccessed } = get();

      // Dispose shader resources if it exists
      if (shaders[id]) {
        shaders[id].dispose();
      }

      // Create new objects without the removed shader
      const newShaders = { ...shaders };
      const newLastAccessed = { ...lastAccessed };

      delete newShaders[id];
      delete newLastAccessed[id];

      set({
        shaders: newShaders,
        lastAccessed: newLastAccessed,
      });
    },

    cleanupOldShaders: (maxAgeMs: number) => {
      const { shaders, lastAccessed } = get();
      const now = Date.now();
      const shadersToRemove: string[] = [];

      // Find shaders older than maxAgeMs
      Object.entries(lastAccessed).forEach(([id, lastAccessTime]) => {
        if (now - lastAccessTime > maxAgeMs) {
          shadersToRemove.push(id);
        }
      });

      // Dispose and remove old shaders
      shadersToRemove.forEach((id) => {
        if (shaders[id]) {
          shaders[id].dispose();
        }
      });

      // Update state without the removed shaders
      if (shadersToRemove.length > 0) {
        set((state) => {
          const newShaders = { ...state.shaders };
          const newLastAccessed = { ...state.lastAccessed };

          shadersToRemove.forEach((id) => {
            delete newShaders[id];
            delete newLastAccessed[id];
          });

          return {
            shaders: newShaders,
            lastAccessed: newLastAccessed,
          };
        });
      }
    },

    clearAll: () => {
      const { shaders } = get();

      // Dispose all shader resources
      Object.values(shaders).forEach((shader) => {
        shader.dispose();
      });

      // Reset to initial state
      set(initialShaderCacheState);
    },
  }));
};
