"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";

import type { ResourcesStore } from "~/stores/resources";
import { createResourcesStore, initResourcesState } from "~/stores/resources";

export type ResourcesStoreApi = ReturnType<typeof createResourcesStore>;

const ResourcesContext = createContext<ResourcesStoreApi | null>(null);

interface ResourcesProviderProps {
  children: ReactNode;
  initialState?: Parameters<typeof createResourcesStore>[0];
}

export function ResourcesProvider({
  children,
  initialState = initResourcesState(),
}: ResourcesProviderProps) {
  const storeRef = useRef<ResourcesStoreApi>(null);
  if (!storeRef.current) {
    storeRef.current = createResourcesStore(initialState);
  }

  return (
    <ResourcesContext.Provider value={storeRef.current}>
      {children}
    </ResourcesContext.Provider>
  );
}

export function useResourcesStore<T>(
  selector: (store: ResourcesStore) => T,
): T {
  const store = useContext(ResourcesContext);

  if (!store) {
    throw new Error("useResourcesStore must be used within ResourcesProvider");
  }

  return useStore(store, selector);
}
