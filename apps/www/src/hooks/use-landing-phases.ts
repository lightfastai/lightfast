"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Phase configuration interfaces
export interface PhaseConfig {
  enabled: boolean;
  startProgress?: number;
  endProgress?: number;
  duration?: number;
}

export interface LandingPhaseConfig {
  phases: {
    gridLines: PhaseConfig;
    textFade: PhaseConfig;
    logoMove: PhaseConfig;
    earlyAccessCard: PhaseConfig;
    earlyAccessText: PhaseConfig;
    expansion: PhaseConfig;
    categories: PhaseConfig;
  };
  debug: {
    enabled: boolean;
    manualProgress?: number;
    showPhaseIndicators?: boolean;
    skipToPhase?: keyof LandingPhaseConfig["phases"];
  };
  testing: {
    disableWheel?: boolean;
    autoAdvance?: boolean;
    phaseDelay?: number;
  };
}

export interface PhaseState {
  active: boolean;
  progress: number; // 0-1 within this phase
  enabled: boolean;
  globalProgress: number; // Overall 0-1 progress
}

export interface PhaseStates {
  gridLines: PhaseState;
  textFade: PhaseState;
  logoMove: PhaseState;
  earlyAccessCard: PhaseState;
  earlyAccessText: PhaseState;
  expansion: PhaseState;
  categories: PhaseState;
}

export interface LandingPhaseControls {
  setManualProgress: (progress: number) => void;
  jumpToPhase: (phase: keyof LandingPhaseConfig["phases"]) => void;
  reset: () => void;
  enableWheel: () => void;
  disableWheel: () => void;
}

export interface LandingPhaseReturn {
  currentPhase: keyof LandingPhaseConfig["phases"] | null;
  globalProgress: number;
  phaseStates: PhaseStates;
  controls: LandingPhaseControls;
  config: LandingPhaseConfig;
}

// Default configuration matching current system
export const defaultPhaseConfig: LandingPhaseConfig = {
  phases: {
    gridLines: {
      enabled: true,
      startProgress: 0,
      endProgress: 0.1,
      duration: 1600,
    },
    textFade: {
      enabled: true,
      startProgress: 0,
      endProgress: 0.3,
    },
    logoMove: {
      enabled: true,
      startProgress: 0.1,
      endProgress: 0.5,
    },
    earlyAccessCard: {
      enabled: true,
      startProgress: 0.3,
      endProgress: 0.5,
    },
    earlyAccessText: {
      enabled: true,
      startProgress: 0.5,
      endProgress: 0.7,
    },
    expansion: {
      enabled: false, // TEMPORARILY DISABLED for testing
      startProgress: 0.6,
      endProgress: 0.8,
    },
    categories: {
      enabled: false, // TEMPORARILY DISABLED for testing
      startProgress: 0.7,
      endProgress: 1.0,
    },
  },
  debug: {
    enabled: false,
    manualProgress: undefined,
    showPhaseIndicators: false,
    skipToPhase: undefined,
  },
  testing: {
    disableWheel: false,
    autoAdvance: false,
    phaseDelay: 2000,
  },
};

// Development/testing configurations
export const testConfigs = {
  // Skip directly to early access
  earlyAccessOnly: {
    ...defaultPhaseConfig,
    phases: {
      ...defaultPhaseConfig.phases,
      gridLines: { ...defaultPhaseConfig.phases.gridLines, enabled: false },
      textFade: { ...defaultPhaseConfig.phases.textFade, enabled: false },
      logoMove: { ...defaultPhaseConfig.phases.logoMove, enabled: false },
    },
    debug: {
      enabled: true,
      skipToPhase: "earlyAccessText" as const,
      showPhaseIndicators: true,
    },
  },
  // Categories only (for testing final state)
  categoriesOnly: {
    ...defaultPhaseConfig,
    phases: {
      ...defaultPhaseConfig.phases,
      gridLines: { ...defaultPhaseConfig.phases.gridLines, enabled: false },
      textFade: { ...defaultPhaseConfig.phases.textFade, enabled: false },
      logoMove: { ...defaultPhaseConfig.phases.logoMove, enabled: false },
      earlyAccessCard: {
        ...defaultPhaseConfig.phases.earlyAccessCard,
        enabled: false,
      },
      earlyAccessText: {
        ...defaultPhaseConfig.phases.earlyAccessText,
        enabled: false,
      },
      expansion: { ...defaultPhaseConfig.phases.expansion, enabled: false },
    },
    debug: {
      enabled: true,
      skipToPhase: "categories" as const,
      showPhaseIndicators: true,
    },
  },
  // Debug mode with all phases enabled
  debugAll: {
    ...defaultPhaseConfig,
    debug: {
      enabled: true,
      showPhaseIndicators: true,
    },
    testing: {
      disableWheel: false,
      autoAdvance: false,
    },
  },
} as const;

export function useLandingPhases(
  config: LandingPhaseConfig = defaultPhaseConfig,
): LandingPhaseReturn {
  const [globalProgress, setGlobalProgress] = useState(0);
  const [isWheelEnabled, setIsWheelEnabled] = useState(
    !config.testing.disableWheel,
  );
  const wheelListenerRef = useRef<((e: WheelEvent) => void) | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Calculate phase states based on global progress
  const calculatePhaseStates = useCallback(
    (progress: number): PhaseStates => {
      const states: PhaseStates = {} as PhaseStates;

      Object.entries(config.phases).forEach(([phaseName, phaseConfig]) => {
        const name = phaseName as keyof LandingPhaseConfig["phases"];

        if (!phaseConfig.enabled) {
          states[name] = {
            active: false,
            progress: 0,
            enabled: false,
            globalProgress: progress,
          };
          return;
        }

        const start = phaseConfig.startProgress ?? 0;
        const end = phaseConfig.endProgress ?? 1;

        let phaseProgress = 0;
        let isActive = false;

        if (progress >= start && progress <= end) {
          isActive = true;
          phaseProgress = end > start ? (progress - start) / (end - start) : 1;
        } else if (progress > end) {
          phaseProgress = 1;
        }

        states[name] = {
          active: isActive,
          progress: Math.max(0, Math.min(1, phaseProgress)),
          enabled: true,
          globalProgress: progress,
        };
      });

      return states;
    },
    [config.phases],
  );

  // Calculate current active phase
  const getCurrentPhase = useCallback(
    (states: PhaseStates): keyof LandingPhaseConfig["phases"] | null => {
      for (const [phaseName, state] of Object.entries(states)) {
        if (state.enabled && state.active) {
          return phaseName as keyof LandingPhaseConfig["phases"];
        }
      }
      return null;
    },
    [],
  );

  // Update CSS variables based on phase states
  const updateCSSVariables = useCallback(
    (states: PhaseStates, progress: number) => {
      // Only update CSS variables on the client side
      if (typeof document === "undefined") return;

      const root = document.documentElement;

      // Update main progress variable
      root.style.setProperty("--wheel-progress", progress.toString());

      // Update phase-specific variables
      root.style.setProperty(
        "--text-fade-phase",
        states.textFade.progress.toString(),
      );
      root.style.setProperty(
        "--logo-move-phase",
        states.logoMove.progress.toString(),
      );
      root.style.setProperty(
        "--early-access-card-phase",
        states.earlyAccessCard.progress.toString(),
      );
      root.style.setProperty(
        "--early-access-text-phase",
        states.earlyAccessText.progress.toString(),
      );
      root.style.setProperty(
        "--expansion-phase",
        states.expansion.progress.toString(),
      );
      root.style.setProperty(
        "--category-phase",
        states.categories.progress.toString(),
      );
    },
    [],
  );

  // Handle wheel events
  useEffect(() => {
    if (!isWheelEnabled || config.debug.manualProgress !== undefined) {
      return;
    }

    const maxDelta = 1000;
    let targetProgress = globalProgress;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const wheelDelta = e.deltaY;
      const newTarget = Math.max(
        0,
        Math.min(1, targetProgress + wheelDelta / maxDelta),
      );

      targetProgress = newTarget;
      setGlobalProgress(newTarget);
    };

    wheelListenerRef.current = handleWheel;
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      if (wheelListenerRef.current) {
        window.removeEventListener("wheel", wheelListenerRef.current);
        wheelListenerRef.current = null;
      }
    };
  }, [isWheelEnabled, globalProgress, config.debug.manualProgress]);

  // Handle manual progress override
  useEffect(() => {
    if (config.debug.manualProgress !== undefined) {
      setGlobalProgress(config.debug.manualProgress);
    }
  }, [config.debug.manualProgress]);

  // Handle skip to phase
  useEffect(() => {
    const skipPhase = config.debug.skipToPhase;
    if (!skipPhase) return;

    const validPhases = Object.keys(
      config.phases,
    ) as (keyof typeof config.phases)[];

    const isValidPhase = (
      phase: string,
    ): phase is keyof typeof config.phases => {
      return validPhases.includes(phase as keyof typeof config.phases);
    };

    if (isValidPhase(skipPhase)) {
      const phaseConfig = config.phases[skipPhase];
      if (phaseConfig.enabled) {
        const targetProgress = phaseConfig.startProgress ?? 0;
        setGlobalProgress(targetProgress);
      }
    }
  }, [config.debug.skipToPhase, config.phases]);

  // Handle auto-advance
  useEffect(() => {
    if (!config.testing.autoAdvance) return;

    const phaseNames = Object.keys(
      config.phases,
    ) as (keyof LandingPhaseConfig["phases"])[];
    let currentIndex = 0;

    const advance = () => {
      if (currentIndex < phaseNames.length) {
        const phaseName = phaseNames[currentIndex];
        if (!phaseName) return;

        const phaseConfig = config.phases[phaseName];
        if (!phaseConfig) return;

        if (phaseConfig.enabled) {
          setGlobalProgress(phaseConfig.startProgress ?? 0);
        }

        currentIndex++;

        if (currentIndex < phaseNames.length) {
          setTimeout(advance, config.testing.phaseDelay ?? 2000);
        }
      }
    };

    const timeoutId = setTimeout(advance, config.testing.phaseDelay ?? 2000);
    return () => clearTimeout(timeoutId);
  }, [config.testing.autoAdvance, config.testing.phaseDelay, config.phases]);

  // Calculate current states
  const phaseStates = calculatePhaseStates(globalProgress);
  const currentPhase = getCurrentPhase(phaseStates);

  // Update CSS variables when states change
  useEffect(() => {
    updateCSSVariables(phaseStates, globalProgress);
  }, [phaseStates, globalProgress, updateCSSVariables]);

  // Control functions
  const controls: LandingPhaseControls = {
    setManualProgress: useCallback((progress: number) => {
      setGlobalProgress(Math.max(0, Math.min(1, progress)));
    }, []),

    jumpToPhase: useCallback(
      (phase: keyof LandingPhaseConfig["phases"]) => {
        const phaseConfig = config.phases[phase];
        if (phaseConfig.enabled) {
          const targetProgress = phaseConfig.startProgress ?? 0;
          setGlobalProgress(targetProgress);
        }
      },
      [config.phases],
    ),

    reset: useCallback(() => {
      setGlobalProgress(0);
    }, []),

    enableWheel: useCallback(() => {
      setIsWheelEnabled(true);
    }, []),

    disableWheel: useCallback(() => {
      setIsWheelEnabled(false);
    }, []),
  };

  return {
    currentPhase,
    globalProgress,
    phaseStates,
    controls,
    config,
  };
}
