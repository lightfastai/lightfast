"use client";

import { useEffect } from "react";

import type { LandingPhaseConfig } from "../../hooks/use-landing-phases";
import { env } from "~/env";
import { useBinaryScrollState } from "../../hooks/use-binary-scroll-state";
import {
  defaultPhaseConfig,
  testConfigs,
} from "../../hooks/use-landing-phases";
import { useLandingPhaseStore } from "../../stores/landing-phase-store";

interface LandingPhaseProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<LandingPhaseConfig>;
}

export function LandingPhaseProvider({
  children,
  initialConfig = {},
}: LandingPhaseProviderProps) {
  const setConfig = useLandingPhaseStore((state) => state.setConfig);

  // Set up binary scroll state for version 1
  const { currentState, progress, isTransitioning } = useBinaryScrollState(
    env.NODE_ENV === "development",
  );

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
      {/* Zustand Debug Panel disabled for version 1 - using binary scroll system instead */}
      {/* <ZustandDebugPanel /> */}
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
