"use client";

import type { ReactNode } from "react";
import type * as THREE from "three";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";

import type { ShaderCacheStore } from "../stores/shader-cache-store";
import { createShaderCacheStore } from "../stores/shader-cache-store";

export type ShaderCacheStoreApi = ReturnType<typeof createShaderCacheStore>;

export const ShaderCacheStoreContext = createContext<
  ShaderCacheStoreApi | undefined
>(undefined);

export interface ShaderCacheStoreProviderProps {
  children: ReactNode;
  initialShaders: Record<string, THREE.ShaderMaterial>;
}

export const ShaderCacheStoreProvider = ({
  children,
  initialShaders,
}: ShaderCacheStoreProviderProps) => {
  const storeRef = useRef<ShaderCacheStoreApi>();
  if (!storeRef.current) {
    storeRef.current = createShaderCacheStore({
      shaders: initialShaders,
      lastAccessed: {},
    });
  }

  return (
    <ShaderCacheStoreContext.Provider value={storeRef.current}>
      {children}
    </ShaderCacheStoreContext.Provider>
  );
};

export const useShaderCacheStore = <T,>(
  selector: (store: ShaderCacheStore) => T,
): T => {
  const store = useContext(ShaderCacheStoreContext);
  if (!store) {
    throw new Error(
      "useShaderCacheStore must be used within a ShaderCacheStoreProvider",
    );
  }
  return useStore(store, selector);
};
