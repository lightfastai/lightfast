import { createSpaceInvadersEngine, renderSpaceInvaders } from "../index";

function createFakeContext() {
  const calls: string[] = [];

  return {
    calls,
    set fillStyle(value: string) {
      calls.push(`fillStyle:${value}`);
    },
    fillRect(x: number, y: number, width: number, height: number) {
      calls.push(`fillRect:${x},${y},${width},${height}`);
    },
    clearRect(x: number, y: number, width: number, height: number) {
      calls.push(`clearRect:${x},${y},${width},${height}`);
    },
  };
}

describe("renderSpaceInvaders", () => {
  it("clears and draws the native board", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });
    const ctx = createFakeContext();

    renderSpaceInvaders(
      ctx as unknown as CanvasRenderingContext2D,
      engine.getRenderState()
    );

    expect(ctx.calls).toContain("clearRect:0,0,224,256");
    expect(ctx.calls).toContain("fillRect:0,0,224,256");
  });
});
