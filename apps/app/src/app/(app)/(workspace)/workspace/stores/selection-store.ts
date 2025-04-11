import { createStore } from "zustand";

import type {
  GeometryType,
  MaterialType,
  NodeType,
  TextureType,
  Txt2ImgType,
} from "@vendor/db/types";
import { $NodeType } from "@vendor/db/types";

interface SelectionState {
  selection: {
    type: NodeType;
    value?: GeometryType | MaterialType | TextureType | Txt2ImgType;
  } | null;
}

export interface SelectionActions {
  setGeometry: (geometry: GeometryType) => void;
  setMaterial: (material: MaterialType) => void;
  setTexture: (texture: TextureType) => void;
  setFlux: (flux: Txt2ImgType) => void;
  setWindow: () => void;
  clearSelection: () => void;
}

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
        selection: { type: $NodeType.enum.geometry, value: geometry },
      })),
    setMaterial: (material: MaterialType) =>
      set(() => ({
        selection: { type: $NodeType.enum.material, value: material },
      })),
    setTexture: (texture: TextureType) =>
      set(() => ({
        selection: { type: $NodeType.enum.texture, value: texture },
      })),
    setFlux: (flux: Txt2ImgType) =>
      set(() => ({
        selection: { type: $NodeType.enum.flux, value: flux },
      })),
    setWindow: () =>
      set(() => ({
        selection: { type: $NodeType.enum.window },
      })),
    clearSelection: () => set(() => ({ selection: null })),
  }));
};
