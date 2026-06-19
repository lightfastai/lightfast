import type { SpaceInvadersInputSnapshot } from "@repo/space-invaders";

export function readFooterArcadeInputSnapshot(
  keys: Set<string>,
  firePressedRef: { current: boolean }
): SpaceInvadersInputSnapshot {
  const firePressed = firePressedRef.current;
  firePressedRef.current = false;

  return {
    moveLeft: keys.has("ArrowLeft") || keys.has("a") || keys.has("A"),
    moveRight: keys.has("ArrowRight") || keys.has("d") || keys.has("D"),
    firePressed,
  };
}
