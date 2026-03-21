"use client";

import type {
  NormalizedInstallation,
  NormalizedResource,
  ProviderSlug,
} from "@repo/app-providers";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";

export interface ProviderSelectionState {
  installations: NormalizedInstallation[];
  selectedInstallation: NormalizedInstallation | null;
  selectedResources: NormalizedResource[];
}

const EMPTY_STATE: ProviderSelectionState = {
  installations: [],
  selectedInstallation: null,
  selectedResources: [],
};

interface SourceSelectionContextValue {
  getState: (provider: ProviderSlug) => ProviderSelectionState;
  hasAnySelection: () => boolean;
  setInstallations: (
    provider: ProviderSlug,
    installations: NormalizedInstallation[]
  ) => void;
  setSelectedInstallation: (
    provider: ProviderSlug,
    installation: NormalizedInstallation | null
  ) => void;
  setSelectedResources: (
    provider: ProviderSlug,
    resources: NormalizedResource[]
  ) => void;
  toggleResource: (
    provider: ProviderSlug,
    resource: NormalizedResource
  ) => void;
}

const SourceSelectionContext =
  createContext<SourceSelectionContextValue | null>(null);

export function SourceSelectionProvider({ children }: { children: ReactNode }) {
  const [stateMap, setStateMap] = useState<
    Map<ProviderSlug, ProviderSelectionState>
  >(new Map());

  const getState = useCallback(
    (provider: ProviderSlug): ProviderSelectionState =>
      stateMap.get(provider) ?? EMPTY_STATE,
    [stateMap]
  );

  const updateProvider = useCallback(
    (
      provider: ProviderSlug,
      updater: (prev: ProviderSelectionState) => ProviderSelectionState
    ) => {
      setStateMap((prev) => {
        const next = new Map(prev);
        next.set(provider, updater(prev.get(provider) ?? EMPTY_STATE));
        return next;
      });
    },
    []
  );

  const setInstallations = useCallback(
    (provider: ProviderSlug, installations: NormalizedInstallation[]) =>
      updateProvider(provider, (s) => ({ ...s, installations })),
    [updateProvider]
  );

  const setSelectedInstallation = useCallback(
    (provider: ProviderSlug, installation: NormalizedInstallation | null) =>
      updateProvider(provider, (s) => ({
        ...s,
        selectedInstallation: installation,
        selectedResources: [],
      })),
    [updateProvider]
  );

  const setSelectedResources = useCallback(
    (provider: ProviderSlug, resources: NormalizedResource[]) =>
      updateProvider(provider, (s) => ({
        ...s,
        selectedResources: resources,
      })),
    [updateProvider]
  );

  const toggleResource = useCallback(
    (provider: ProviderSlug, resource: NormalizedResource) =>
      updateProvider(provider, (s) => {
        const exists = s.selectedResources.some((r) => r.id === resource.id);
        if (exists) {
          return { ...s, selectedResources: [] };
        }
        return {
          ...s,
          selectedResources: [resource],
        };
      }),
    [updateProvider]
  );

  const hasAnySelection = useCallback(
    () =>
      Array.from(stateMap.values()).some((s) => s.selectedResources.length > 0),
    [stateMap]
  );

  return (
    <SourceSelectionContext.Provider
      value={{
        getState,
        setInstallations,
        setSelectedInstallation,
        setSelectedResources,
        toggleResource,
        hasAnySelection,
      }}
    >
      {children}
    </SourceSelectionContext.Provider>
  );
}

export function useSourceSelection() {
  const context = useContext(SourceSelectionContext);
  if (!context) {
    throw new Error(
      "useSourceSelection must be used within SourceSelectionProvider"
    );
  }
  return context;
}
