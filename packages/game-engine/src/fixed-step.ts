export interface FixedStepAccumulatorOptions {
  fixedStepMs: number;
  maxFrameDeltaMs: number;
  maxStepsPerFrame: number;
}

export interface FixedStepAdvanceResult {
  steps: number;
  droppedTime: boolean;
}

export interface FixedStepAccumulator {
  advance(deltaMs: number): FixedStepAdvanceResult;
  reset(): void;
  getRemainingMs(): number;
}

export function createFixedStepAccumulator(
  options: FixedStepAccumulatorOptions
): FixedStepAccumulator {
  let remainingMs = 0;

  return {
    advance(deltaMs: number) {
      if (!Number.isFinite(deltaMs) || deltaMs < 0) {
        throw new Error("Fixed-step delta must be a finite non-negative number");
      }

      remainingMs += Math.min(deltaMs, options.maxFrameDeltaMs);

      let steps = 0;

      while (
        remainingMs >= options.fixedStepMs &&
        steps < options.maxStepsPerFrame
      ) {
        remainingMs -= options.fixedStepMs;
        steps += 1;
      }

      const droppedTime = steps === options.maxStepsPerFrame;

      if (droppedTime) {
        remainingMs = 0;
      }

      return { steps, droppedTime };
    },
    reset() {
      remainingMs = 0;
    },
    getRemainingMs() {
      return remainingMs;
    },
  };
}
