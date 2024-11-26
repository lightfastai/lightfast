import { createStore } from "zustand";

import {
  $NodeType,
  GeometryType,
  MaterialType,
  NodeType,
  TextureType,
} from "../../../../../../../../../../packages/db/dist/app/src/schema";

interface SelectionState {
  selection: {
    type: NodeType;
    value: GeometryType | MaterialType | TextureType;
  } | null;
}

export type SelectionActions = {
  setGeometry: (geometry: GeometryType) => void;
  setMaterial: (material: MaterialType) => void;
  setTexture: (texture: TextureType) => void;
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
    setTexture: (texture: TextureType) =>
      set(() => ({
        selection: { type: $NodeType.Enum.texture, value: texture },
      })),
    clearSelection: () => set(() => ({ selection: null })),
  }));
};
