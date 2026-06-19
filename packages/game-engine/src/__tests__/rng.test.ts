import { createLcgRng, nextLcgValue } from "../rng";

describe("nextLcgValue", () => {
  it("produces deterministic values from the same seed", () => {
    const first = nextLcgValue(123);
    const second = nextLcgValue(123);

    expect(first).toEqual(second);
  });

  it("returns a normalized value in [0, 1)", () => {
    const result = nextLcgValue(123);

    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThan(1);
  });
});

describe("createLcgRng", () => {
  it("advances state with each next call", () => {
    const rng = createLcgRng(123);

    const first = rng.next();
    const second = rng.next();

    expect(first).not.toBe(second);
  });
});
