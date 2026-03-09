"use client";

import type { ProviderName } from "@repo/console-providers";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";
import type { NormalizedInstallation, NormalizedResource } from "./adapters";

export interface ProviderSelectionState {
  installations: NormalizedInstallation[];
  /** Raw (un-normalized) resources — passed to buildLinkResources for provider-specific fields */
  rawSelectedResources: unknown[];
  selectedInstallation: NormalizedInstallation | null;
  selectedResources: NormalizedResource[];
}

const EMPTY_STATE: ProviderSelectionState = {
  installations: [],
  selectedInstallation: null,
  selectedResources: [],
  rawSelectedResources: [],
};

interface SourceSelectionContextValue {
  getState: (provider: ProviderName) => ProviderSelectionState;
  hasAnySelection: () => boolean;
  setInstallations: (
    provider: ProviderName,
    installations: NormalizedInstallation[]
  ) => void;
  setSelectedInstallation: (
    provider: ProviderName,
    installation: NormalizedInstallation | null
  ) => void;
  setSelectedResources: (
    provider: ProviderName,
    resources: NormalizedResource[],
    rawResources: unknown[]
  ) => void;
  toggleResource: (
    provider: ProviderName,
    resource: NormalizedResource,
    rawResource: unknown
  ) => void;
}

const SourceSelectionContext =
  createContext<SourceSelectionContextValue | null>(null);

export function SourceSelectionProvider({ children }: { children: ReactNode }) {
  const [stateMap, setStateMap] = useState<
    Map<ProviderName, ProviderSelectionState>
  >(new Map());

  const getState = useCallback(
    (provider: ProviderName): ProviderSelectionState =>
      stateMap.get(provider) ?? EMPTY_STATE,
    [stateMap]
  );

  const updateProvider = useCallback(
    (
      provider: ProviderName,
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
    (provider: ProviderName, installations: NormalizedInstallation[]) =>
      updateProvider(provider, (s) => ({ ...s, installations })),
    [updateProvider]
  );

  const setSelectedInstallation = useCallback(
    (provider: ProviderName, installation: NormalizedInstallation | null) =>
      updateProvider(provider, (s) => ({
        ...s,
        selectedInstallation: installation,
        selectedResources: [],
        rawSelectedResources: [],
      })),
    [updateProvider]
  );

  const setSelectedResources = useCallback(
    (
      provider: ProviderName,
      resources: NormalizedResource[],
      rawResources: unknown[]
    ) =>
      updateProvider(provider, (s) => ({
        ...s,
        selectedResources: resources,
        rawSelectedResources: rawResources,
      })),
    [updateProvider]
  );

  const toggleResource = useCallback(
    (
      provider: ProviderName,
      resource: NormalizedResource,
      rawResource: unknown
    ) =>
      updateProvider(provider, (s) => {
        const exists = s.selectedResources.some((r) => r.id === resource.id);
        if (exists) {
          return { ...s, selectedResources: [], rawSelectedResources: [] };
        }
        return {
          ...s,
          selectedResources: [resource],
          rawSelectedResources: [rawResource],
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
