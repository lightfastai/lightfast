import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { Database } from "~/types/supabase.types";

export type Resource = Database["media_server"]["Tables"]["resource"]["Row"];
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
  create<ResourcesStore>()(
    immer((set) => ({
      ...initState,
      setResources: (resources) =>
        set((state) => {
          state.resources = resources;
        }),
      setLoading: (loading) =>
        set((state) => {
          state.loading = loading;
        }),
      addResource: (resource) =>
        set((state) => {
          state.resources.push(resource);
        }),
      updateResource: (id, updates) =>
        set((state) => {
          const resource = state.resources.find((r: Resource) => r.id === id);
          if (resource) {
            Object.assign(resource, updates);
          }
        }),
      removeResource: (id) =>
        set((state) => {
          state.resources = state.resources.filter(
            (r: Resource) => r.id !== id,
          );
        }),
    })),
  );
