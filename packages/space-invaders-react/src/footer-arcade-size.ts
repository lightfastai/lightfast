import { BOARD_HEIGHT, BOARD_WIDTH } from "@repo/space-invaders";

interface ArcadeContainerSize {
  width: number;
  height: number;
}

export function getContainedArcadeSize(container: ArcadeContainerSize) {
  if (container.width <= 0 || container.height <= 0) {
    return {
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
    };
  }

  const aspectRatio = BOARD_WIDTH / BOARD_HEIGHT;
  let width = container.width;
  let height = width / aspectRatio;

  if (height > container.height) {
    height = container.height;
    width = height * aspectRatio;
  }

  return {
    width: Math.floor(width),
    height: Math.floor(height),
  };
}
