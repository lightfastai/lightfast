"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";

import {
  createTextureRenderStore,
  initTextureRenderState,
  TextureRenderStore,
} from "../stores/texture-render-store";
import { BaseNode } from "../types/node";

export type TextureRenderStoreApi = ReturnType<typeof createTextureRenderStore>;

export const TextureRenderStoreContext = createContext<
  TextureRenderStoreApi | undefined
>(undefined);

export interface TextureRenderStoreProviderProps {
  children: ReactNode;
  initialNodes: BaseNode[];
}

export const TextureRenderStoreProvider = ({
  children,
  initialNodes,
}: TextureRenderStoreProviderProps) => {
  const storeRef = useRef<TextureRenderStoreApi>();
  if (!storeRef.current) {
    storeRef.current = createTextureRenderStore(
      initTextureRenderState(initialNodes),
    );
  }

  return (
    <TextureRenderStoreContext.Provider value={storeRef.current}>
      {children}
    </TextureRenderStoreContext.Provider>
  );
};

export const useTextureRenderStore = <T,>(
  selector: (store: TextureRenderStore) => T,
): T => {
  const textureRenderStoreContext = useContext(TextureRenderStoreContext);

  if (!textureRenderStoreContext) {
    throw new Error(
      `useTextureRenderStore must be used within TextureRenderStoreProvider`,
    );
  }

  return useStore(textureRenderStoreContext, selector);
};
