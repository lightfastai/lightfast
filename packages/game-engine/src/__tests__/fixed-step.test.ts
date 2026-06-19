import { createFixedStepAccumulator } from "../fixed-step";

describe("createFixedStepAccumulator", () => {
  it("does not step before enough time accumulates", () => {
    const accumulator = createFixedStepAccumulator({
      fixedStepMs: 100,
      maxFrameDeltaMs: 250,
      maxStepsPerFrame: 5,
    });

    const result = accumulator.advance(99);

    expect(result.steps).toBe(0);
    expect(result.droppedTime).toBe(false);
  });

  it("returns the number of fixed steps to process", () => {
    const accumulator = createFixedStepAccumulator({
      fixedStepMs: 100,
      maxFrameDeltaMs: 250,
      maxStepsPerFrame: 5,
    });

    const result = accumulator.advance(250);

    expect(result.steps).toBe(2);
    expect(result.droppedTime).toBe(false);
  });

  it("caps catch-up steps and drops excess accumulated time", () => {
    const accumulator = createFixedStepAccumulator({
      fixedStepMs: 10,
      maxFrameDeltaMs: 100,
      maxStepsPerFrame: 5,
    });

    const result = accumulator.advance(100);

    expect(result.steps).toBe(5);
    expect(result.droppedTime).toBe(true);
    expect(accumulator.getRemainingMs()).toBe(0);
  });
});
