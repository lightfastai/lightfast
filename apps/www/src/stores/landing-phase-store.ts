"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type {
  LandingPhaseConfig,
  PhaseStates,
} from "../hooks/use-landing-phases";
import { defaultPhaseConfig } from "../hooks/use-landing-phases";

interface LandingPhaseStore {
  // State
  config: LandingPhaseConfig;
  globalProgress: number;
  phaseStates: PhaseStates;
  currentPhase: keyof LandingPhaseConfig["phases"] | null;
  isWheelEnabled: boolean;

  // Actions
  setConfig: (config: Partial<LandingPhaseConfig>) => void;
  setProgress: (progress: number) => void;
  jumpToPhase: (phase: keyof LandingPhaseConfig["phases"]) => void;
  reset: () => void;
  enableWheel: () => void;
  disableWheel: () => void;

  // Internal methods
  calculatePhaseStates: (progress: number) => PhaseStates;
  getCurrentPhase: (
    states: PhaseStates,
  ) => keyof LandingPhaseConfig["phases"] | null;
  updateCSSVariables: (states: PhaseStates, progress: number) => void;
}

export const useLandingPhaseStore = create<LandingPhaseStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    config: defaultPhaseConfig,
    globalProgress: 0,
    phaseStates: {} as PhaseStates,
    currentPhase: null,
    isWheelEnabled: true,

    // Actions
    setConfig: (newConfig) => {
      const currentConfig = get().config;
      const mergedConfig: LandingPhaseConfig = {
        ...currentConfig,
        ...newConfig,
        phases: {
          ...currentConfig.phases,
          ...newConfig.phases,
        },
        debug: {
          ...currentConfig.debug,
          ...newConfig.debug,
        },
        testing: {
          ...currentConfig.testing,
          ...newConfig.testing,
        },
      };

      set({ config: mergedConfig });

      // Recalculate phase states with new config
      const {
        globalProgress,
        calculatePhaseStates,
        getCurrentPhase,
        updateCSSVariables,
      } = get();
      const newPhaseStates = calculatePhaseStates(globalProgress);
      const newCurrentPhase = getCurrentPhase(newPhaseStates);

      set({
        phaseStates: newPhaseStates,
        currentPhase: newCurrentPhase,
      });

      updateCSSVariables(newPhaseStates, globalProgress);

      // Handle skip to phase
      if (newConfig.debug?.skipToPhase) {
        const phaseConfig = mergedConfig.phases[newConfig.debug.skipToPhase];
        if (phaseConfig?.enabled) {
          const targetProgress = phaseConfig.startProgress ?? 0;
          get().setProgress(targetProgress);
        }
      }

      // Handle manual progress override
      if (newConfig.debug?.manualProgress !== undefined) {
        get().setProgress(newConfig.debug.manualProgress);
      }
    },

    setProgress: (progress) => {
      const clampedProgress = Math.max(0, Math.min(1, progress));
      const { calculatePhaseStates, getCurrentPhase, updateCSSVariables } =
        get();

      const newPhaseStates = calculatePhaseStates(clampedProgress);
      const newCurrentPhase = getCurrentPhase(newPhaseStates);

      set({
        globalProgress: clampedProgress,
        phaseStates: newPhaseStates,
        currentPhase: newCurrentPhase,
      });

      updateCSSVariables(newPhaseStates, clampedProgress);
    },

    jumpToPhase: (phase) => {
      const { config } = get();
      const phaseConfig = config.phases[phase];
      if (phaseConfig?.enabled) {
        const targetProgress = phaseConfig.startProgress ?? 0;
        get().setProgress(targetProgress);
      }
    },

    reset: () => {
      get().setProgress(0);
    },

    enableWheel: () => {
      set({ isWheelEnabled: true });
    },

    disableWheel: () => {
      set({ isWheelEnabled: false });
    },

    // Internal calculation methods
    calculatePhaseStates: (progress: number) => {
      const { config } = get();
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

    getCurrentPhase: (states: PhaseStates) => {
      for (const [phaseName, state] of Object.entries(states)) {
        if (state.enabled && state.active) {
          return phaseName as keyof LandingPhaseConfig["phases"];
        }
      }
      return null;
    },

    updateCSSVariables: (states: PhaseStates, progress: number) => {
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
  })),
);

// Initialize phase states on store creation
useLandingPhaseStore.getState().setProgress(0);
