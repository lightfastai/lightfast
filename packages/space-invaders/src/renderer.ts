import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  INVADER_BLOB_HEIGHT,
  INVADER_BLOB_WIDTH,
  INVADER_CELL_HEIGHT,
  INVADER_CELL_WIDTH,
  INVADER_COLUMNS,
  INVADER_ROWS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_Y,
} from "./constants";
import type { SpaceInvadersState } from "./types";

const BACKGROUND = "#000000";
const FOREGROUND = "#f5f5f5";
const MUTED = "#9d9d9d";

export function renderSpaceInvaders(
  ctx: CanvasRenderingContext2D,
  state: Readonly<SpaceInvadersState>,
  options: { gameOver?: boolean } = {}
) {
  ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  ctx.fillStyle = FOREGROUND;

  for (let row = 0; row < INVADER_ROWS; row += 1) {
    for (let col = 0; col < INVADER_COLUMNS; col += 1) {
      const index = row * INVADER_COLUMNS + col;

      if (state.invaderAlive[index] !== 1) {
        continue;
      }

      const x =
        Math.round(state.rackX) +
        col * INVADER_CELL_WIDTH +
        (INVADER_CELL_WIDTH - INVADER_BLOB_WIDTH) / 2;
      const y =
        Math.round(state.rackY) +
        row * INVADER_CELL_HEIGHT +
        (INVADER_CELL_HEIGHT - INVADER_BLOB_HEIGHT) / 2;

      ctx.fillRect(x, y, INVADER_BLOB_WIDTH, INVADER_BLOB_HEIGHT);
    }
  }

  if (state.playerShot.active) {
    ctx.fillRect(
      Math.round(state.playerShot.x),
      Math.round(state.playerShot.y),
      state.playerShot.width,
      state.playerShot.height
    );
  }

  if (state.alienShot.active) {
    ctx.fillRect(
      Math.round(state.alienShot.x),
      Math.round(state.alienShot.y),
      state.alienShot.width,
      state.alienShot.height
    );
  }

  ctx.fillRect(Math.round(state.playerX), PLAYER_Y, PLAYER_WIDTH, PLAYER_HEIGHT);

  ctx.fillStyle = MUTED;
  for (let life = 1; life < state.lives; life += 1) {
    ctx.fillRect(8 + (life - 1) * 12, 246, 8, 4);
  }

  if (options.gameOver) {
    ctx.fillStyle = FOREGROUND;
    ctx.fillRect(96, 124, 32, 2);
    ctx.fillRect(96, 130, 32, 2);
  }
}
