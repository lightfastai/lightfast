import { describe, expect, it } from "vitest";
import { readFooterArcadeInputSnapshot } from "./footer-arcade-input";

describe("readFooterArcadeInputSnapshot", () => {
  it("maps arrow and wasd movement keys", () => {
    const firePressedRef = { current: false };

    expect(
      readFooterArcadeInputSnapshot(new Set(["ArrowLeft"]), firePressedRef)
    ).toMatchObject({ moveLeft: true, moveRight: false });
    expect(
      readFooterArcadeInputSnapshot(new Set(["d"]), firePressedRef)
    ).toMatchObject({ moveLeft: false, moveRight: true });
  });

  it("consumes fire once", () => {
    const firePressedRef = { current: true };
    const first = readFooterArcadeInputSnapshot(new Set(), firePressedRef);
    const second = readFooterArcadeInputSnapshot(new Set(), firePressedRef);

    expect(first.firePressed).toBe(true);
    expect(second.firePressed).toBe(false);
  });
});
