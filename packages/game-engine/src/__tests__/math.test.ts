import { clamp, intersects } from "../math";

describe("clamp", () => {
  it("keeps values inside inclusive bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("intersects", () => {
  it("returns true when rectangles overlap", () => {
    expect(
      intersects(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 9, y: 9, width: 2, height: 2 }
      )
    ).toBe(true);
  });

  it("returns false when rectangles only touch edges", () => {
    expect(
      intersects(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 10, y: 0, width: 2, height: 2 }
      )
    ).toBe(false);
  });
});
