import { createStore } from "zustand";

import {
  $NodeType,
  GeometryType,
  MaterialType,
  NodeType,
} from "@repo/db/schema";

interface SelectionState {
  selection: {
    type: NodeType;
    value: GeometryType | MaterialType;
  } | null;
}

export type SelectionActions = {
  setGeometry: (geometry: GeometryType) => void;
  setMaterial: (material: MaterialType) => void;
  clearSelection: () => void;
};

export type SelectionStore = SelectionState & SelectionActions;

export const initSelectionState = (): SelectionState => ({
  selection: null,
});

export const defaultSelectionState: SelectionState = {
  selection: null,
};

export const createSelectionStore = (
  initState: SelectionState = defaultSelectionState,
) => {
  return createStore<SelectionStore>()((set) => ({
    ...initState,
    setGeometry: (geometry: GeometryType) =>
      set(() => ({
        selection: { type: $NodeType.Enum.geometry, value: geometry },
      })),
    setMaterial: (material: MaterialType) =>
      set(() => ({
        selection: { type: $NodeType.Enum.material, value: material },
      })),
    clearSelection: () => set(() => ({ selection: null })),
  }));
};
