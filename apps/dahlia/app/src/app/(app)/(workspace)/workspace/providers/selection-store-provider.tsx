"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";

import {
  createSelectionStore,
  initSelectionState,
  SelectionStore,
} from "../stores/selection-store";

export type SelectionStoreApi = ReturnType<typeof createSelectionStore>;

export const SelectionStoreContext = createContext<
  SelectionStoreApi | undefined
>(undefined);

export interface SelectionStoreProviderProps {
  children: ReactNode;
}

export const SelectionStoreProvider = ({
  children,
}: SelectionStoreProviderProps) => {
  const storeRef = useRef<SelectionStoreApi>();
  if (!storeRef.current) {
    storeRef.current = createSelectionStore(initSelectionState());
  }

  return (
    <SelectionStoreContext.Provider value={storeRef.current}>
      {children}
    </SelectionStoreContext.Provider>
  );
};

export const useSelectionStore = <T,>(
  selector: (store: SelectionStore) => T,
): T => {
  const selectionStoreContext = useContext(SelectionStoreContext);

  if (!selectionStoreContext) {
    throw new Error(
      `useSelectionStore must be used within SelectionStoreProvider`,
    );
  }

  return useStore(selectionStoreContext, selector);
};
