import { getContainedArcadeSize } from "./footer-arcade-size";

describe("getContainedArcadeSize", () => {
  it("uses the full available height when width is not the limiting axis", () => {
    expect(getContainedArcadeSize({ width: 1200, height: 328 })).toEqual({
      width: 287,
      height: 328,
    });
  });

  it("uses the full available width when height is not the limiting axis", () => {
    expect(getContainedArcadeSize({ width: 200, height: 1000 })).toEqual({
      width: 200,
      height: 228,
    });
  });

  it("returns the native board size before the container can be measured", () => {
    expect(getContainedArcadeSize({ width: 0, height: 0 })).toEqual({
      width: 224,
      height: 256,
    });
  });
});
