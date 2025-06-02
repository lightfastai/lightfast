"use client";

import { useEffect } from "react";

import type { LandingPhaseConfig } from "../../hooks/use-landing-phases";
import { env } from "~/env";
import {
  defaultPhaseConfig,
  testConfigs,
} from "../../hooks/use-landing-phases";
import { useWheelInput } from "../../hooks/use-wheel-input";
import { useLandingPhaseStore } from "../../stores/landing-phase-store";
import { ZustandDebugPanel } from "./zustand-debug-panel";

interface LandingPhaseProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<LandingPhaseConfig>;
}

export function LandingPhaseProvider({
  children,
  initialConfig = {},
}: LandingPhaseProviderProps) {
  const setConfig = useLandingPhaseStore((state) => state.setConfig);

  // Set up wheel input
  useWheelInput();

  // Initialize configuration on mount
  useEffect(() => {
    const getInitialConfig = (): Partial<LandingPhaseConfig> => {
      // In development, check for URL parameters to load test configs
      if (env.NODE_ENV === "development" && typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const testConfig = urlParams.get("testConfig");

        if (testConfig && testConfig in testConfigs) {
          return testConfigs[testConfig as keyof typeof testConfigs];
        }
      }

      // Merge default config with any initial config provided
      return {
        ...initialConfig,
        debug: {
          ...defaultPhaseConfig.debug,
          ...initialConfig.debug,
          // Enable debug mode in development by default
          enabled:
            env.NODE_ENV === "development"
              ? true
              : (initialConfig.debug?.enabled ?? false),
        },
      };
    };

    const config = getInitialConfig();
    if (Object.keys(config).length > 0) {
      setConfig(config);
    }
  }, [initialConfig, setConfig]);

  return (
    <>
      {children}
      {/* Debug Panel - automatically shows/hides based on store state */}
      <ZustandDebugPanel />
    </>
  );
}

// Hook to access phase data from child components
export function useLandingPhaseData() {
  const phaseStates = useLandingPhaseStore((state) => state.phaseStates);
  const currentPhase = useLandingPhaseStore((state) => state.currentPhase);
  const globalProgress = useLandingPhaseStore((state) => state.globalProgress);
  const config = useLandingPhaseStore((state) => state.config);

  return {
    phaseStates,
    currentPhase,
    globalProgress,
    config,
  };
}
