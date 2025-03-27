import { createStore } from "zustand";

import type { BaseNode } from "../types/node";

export interface InspectorState {
  selected: Pick<BaseNode, "id" | "type"> | null;
  isOpen: boolean;
}

export interface InspectorActions {
  setSelected: ({ type, id }: { type: BaseNode["type"]; id: string }) => void;
  setIsOpen: (isOpen: boolean) => void;
}

export type InspectorStore = InspectorState & InspectorActions;

export const initInspectorState = (): InspectorState => ({
  selected: null,
  isOpen: true,
});

export const defaultInspectorState: InspectorState = {
  selected: null,
  isOpen: true,
};

export const createInspectorStore = (
  initState: InspectorState = defaultInspectorState,
) => {
  return createStore<InspectorStore>()((set) => ({
    ...initState,
    setSelected: ({ type, id }) => set(() => ({ selected: { type, id } })),
    setIsOpen: (isOpen) => set(() => ({ isOpen })),
  }));
};
