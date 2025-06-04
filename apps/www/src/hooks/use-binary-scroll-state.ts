"use client";

import { useCallback, useEffect, useRef } from "react";

import type { ScrollState } from "~/stores/binary-scroll-store";
import {
  registerCoreScrollLogic,
  useBinaryScrollStore,
} from "~/stores/binary-scroll-store";
import { useScrollAccumulator } from "./use-scroll-accumulator";
import { useSpringAnimation } from "./use-spring-animation";

// This hook no longer returns state/changeState directly.
// It sets up the global scroll listeners and updates the Zustand store.
export const useSetupBinaryScrollBehavior = (): void => {
  // Get the state update function from the Zustand store
  const currentState = useBinaryScrollStore((state) => state.currentState); // For calling actions outside of component render
  const setCurrentState = useBinaryScrollStore(
    (state) => state._setCurrentStateFromHook,
  );
  const currentStateRef = useRef<ScrollState>(currentState);
  // Keep store and ref in sync
  useEffect(() => {
    const unsubscribe = useBinaryScrollStore.subscribe(
      (state) => (currentStateRef.current = state.currentState),
    );
    return unsubscribe;
  }, []);

  const manualChangeTimeRef = useRef<number>(0);
  const MANUAL_CHANGE_COOLDOWN = 250;
  const lastScrollChangeTimeRef = useRef<number>(0);
  const SCROLL_CHANGE_COOLDOWN = 250;

  const spring = useSpringAnimation();
  const accumulator = useScrollAccumulator({
    thresholdAmount: 150,
  });

  const cssVariable = "--wheel-progress";

  const updateCSSVariable = useCallback(
    (position: number) => {
      document.documentElement.style.setProperty(
        cssVariable,
        position.toString(),
      );
    },
    [cssVariable],
  );

  const stateToProgress = useCallback((state: ScrollState): number => {
    return state === "initial" ? 0 : 1;
  }, []);

  const changeStateLogic = useCallback(
    (newState: ScrollState, isManual = false) => {
      const currentStoreState = useBinaryScrollStore.getState().currentState;

      // For non-manual (scroll-driven) changes, if already in the target state, do nothing.
      if (!isManual && newState === currentStoreState) {
        return;
      }
      // For manual changes, we allow attempting to animate even to the same state,
      // though cooldowns should prevent rapid re-triggering issues.
      // If it's a scroll-driven change to a genuinely new state, we also proceed.

      const targetProgress = stateToProgress(newState);

      if (isManual) {
        manualChangeTimeRef.current = performance.now(); // Apply cooldown for manual interaction
        accumulator.lock(); // Lock accumulator during the manual change process
        accumulator.reset(); // Reset accumulation for a clean manual animation start

        spring.animateTo(targetProgress, updateCSSVariable, () => {
          setCurrentState(newState); // Update store on animation complete
          // lastScrollChangeTimeRef should be set here to prevent immediate scroll-back if the user tries to scroll during/right after manual animation
          lastScrollChangeTimeRef.current = performance.now();
          accumulator.unlock(); // Unlock accumulator after animation and state update
        });
        return; // Animation has been initiated
      }

      // Scroll-driven changes
      const direction = targetProgress > spring.position ? 1 : -1;
      spring.addVelocity(direction * 0.1);
      accumulator.lock();
      spring.animateTo(targetProgress, updateCSSVariable, () => {
        setCurrentState(newState);
        accumulator.reset();
        lastScrollChangeTimeRef.current = performance.now();
        accumulator.unlock();
      });
    },
    [stateToProgress, spring, accumulator, updateCSSVariable, setCurrentState],
  );

  useEffect(() => {
    registerCoreScrollLogic((newState) => changeStateLogic(newState, true));
  }, [changeStateLogic]);

  const processScroll = useCallback(
    (wheelDelta: number) => {
      const now = performance.now();
      const inManualCooldown =
        now - manualChangeTimeRef.current < MANUAL_CHANGE_COOLDOWN;
      const inScrollChangeCooldown =
        now - lastScrollChangeTimeRef.current < SCROLL_CHANGE_COOLDOWN;

      if (inManualCooldown || inScrollChangeCooldown) {
        return;
      }

      const { shouldTrigger: accShouldTrigger, direction: accDirection } =
        accumulator.processScroll(wheelDelta);
      const actualCurrentState = currentStateRef.current; // Use ref for immediate value from event handler context

      if (accShouldTrigger && accDirection) {
        if (actualCurrentState === "initial") {
          if (accDirection === "down") {
            changeStateLogic("earlyAccess", false);
          }
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        } else if (actualCurrentState === "earlyAccess") {
          if (accDirection === "up") {
            changeStateLogic("initial", false);
          }
        }
      }
    },
    [
      accumulator,
      changeStateLogic,
      MANUAL_CHANGE_COOLDOWN,
      SCROLL_CHANGE_COOLDOWN,
    ],
  );

  useEffect(() => {
    const currentCSS = getComputedStyle(document.documentElement)
      .getPropertyValue(cssVariable)
      .trim();
    if (!currentCSS) {
      document.documentElement.style.setProperty(cssVariable, "0");
    }
  }, [cssVariable]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      processScroll(e.deltaY);
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [processScroll]);

  // No return value, this hook is for setup only.
};

// The old hook `useBinaryScrollState` is no longer the primary export for UI consumption.
// Components will use `useBinaryScrollStore`.
// Keep original ScrollState export for type usage if needed elsewhere or import from store.
// export type ScrollState = "initial" | "earlyAccess"; // This should be defined in one place, ideally where the store can also see it or from the store itself.
