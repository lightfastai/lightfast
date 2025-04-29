import { create } from "zustand";

import type { Database } from "~/types/supabase.types";

export type Resource = Database["public"]["Tables"]["resource"]["Row"];
export type ResourceStatus = Resource["status"];
export type ResourceType = Resource["type"];
export type ResourceEngine = Resource["engine"];

interface ResourcesState {
  resources: Resource[];
  loading: boolean;
}

interface ResourcesActions {
  setResources: (resources: Resource[]) => void;
  setLoading: (loading: boolean) => void;
  addResource: (resource: Resource) => void;
  updateResource: (id: string, updates: Partial<Resource>) => void;
  removeResource: (id: string) => void;
}

export type ResourcesStore = ResourcesState & ResourcesActions;

export const initResourcesState = (): ResourcesState => ({
  resources: [],
  loading: false,
});

export const createResourcesStore = (
  initState: ResourcesState = initResourcesState(),
) =>
  create<ResourcesStore>()((set) => ({
    ...initState,
    setResources: (resources) => set({ resources }),
    setLoading: (loading) => set({ loading }),
    addResource: (resource) =>
      set((state) => ({
        resources: [...state.resources, resource],
      })),
    updateResource: (id, updates) =>
      set((state) => ({
        resources: state.resources.map((r) =>
          r.id === id ? { ...r, ...updates } : r,
        ),
      })),
    removeResource: (id) =>
      set((state) => ({
        resources: state.resources.filter((r) => r.id !== id),
      })),
  }));
