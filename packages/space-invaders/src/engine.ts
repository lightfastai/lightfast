import { clamp, intersects, nextLcgValue } from "@repo/game-engine";
import {
  ALIEN_SHOT_ATTEMPT_INTERVAL_MS,
  ALIEN_SHOT_HEIGHT,
  ALIEN_SHOT_SPEED_PX_PER_SECOND,
  ALIEN_SHOT_WIDTH,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  INVADER_BLOB_HEIGHT,
  INVADER_BLOB_WIDTH,
  INVADER_CELL_HEIGHT,
  INVADER_CELL_WIDTH,
  INVADER_COLUMNS,
  INVADER_COUNT,
  INVADER_ROWS,
  PLAYER_MAX_X,
  PLAYER_MIN_X,
  PLAYER_HEIGHT,
  PLAYER_SHOT_HEIGHT,
  PLAYER_SHOT_SPEED_PX_PER_SECOND,
  PLAYER_SHOT_WIDTH,
  PLAYER_SPEED_PX_PER_SECOND,
  PLAYER_START_X,
  PLAYER_WIDTH,
  PLAYER_Y,
  RACK_DOWN_STEP,
  RACK_HORIZONTAL_STEP,
  RACK_INITIAL_STEP_INTERVAL_MS,
  RACK_LEFT_PADDING,
  RACK_MIN_STEP_INTERVAL_MS,
  RACK_RIGHT_PADDING,
  RACK_MAX_WAVE_Y_STEPS,
  RACK_START_X,
  RACK_START_Y,
  RACK_WAVE_INTERVAL_BONUS_MS,
  RACK_WAVE_Y_STEP,
} from "./constants";
import type {
  SpaceInvadersEngine,
  SpaceInvadersEngineOptions,
  SpaceInvadersEngineResetOptions,
  SpaceInvadersInputSnapshot,
  SpaceInvadersState,
  SpaceInvadersStepOutcome,
} from "./types";

const DEFAULT_LIVES = 3;

function getInvaderIndex(row: number, col: number) {
  return row * INVADER_COLUMNS + col;
}

function createInactiveShot() {
  return {
    active: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    velocityY: 0,
  };
}

function clearShots(state: SpaceInvadersState) {
  state.playerShot.active = false;
  state.alienShot.active = false;
}

function getInvaderRect(state: SpaceInvadersState, row: number, col: number) {
  const cellX = state.rackX + col * INVADER_CELL_WIDTH;
  const cellY = state.rackY + row * INVADER_CELL_HEIGHT;

  return {
    x: cellX + (INVADER_CELL_WIDTH - INVADER_BLOB_WIDTH) / 2,
    y: cellY + (INVADER_CELL_HEIGHT - INVADER_BLOB_HEIGHT) / 2,
    width: INVADER_BLOB_WIDTH,
    height: INVADER_BLOB_HEIGHT,
  };
}

function getLiveRackBounds(state: SpaceInvadersState) {
  let minCol = INVADER_COLUMNS;
  let maxCol = -1;
  let maxRow = -1;

  for (let row = 0; row < INVADER_ROWS; row += 1) {
    for (let col = 0; col < INVADER_COLUMNS; col += 1) {
      const index = getInvaderIndex(row, col);

      if (state.invaderAlive[index] === 1) {
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        maxRow = Math.max(maxRow, row);
      }
    }
  }

  return { minCol, maxCol, maxRow };
}

function resolvePlayerShotVsInvaders(state: SpaceInvadersState) {
  if (!state.playerShot.active) {
    return false;
  }

  let hitIndex = -1;
  let hitY = Number.POSITIVE_INFINITY;
  const shot = state.playerShot;

  for (let row = 0; row < INVADER_ROWS; row += 1) {
    for (let col = 0; col < INVADER_COLUMNS; col += 1) {
      const index = getInvaderIndex(row, col);

      if (state.invaderAlive[index] !== 1) {
        continue;
      }

      const invaderRect = getInvaderRect(state, row, col);

      if (intersects(shot, invaderRect) && invaderRect.y < hitY) {
        hitIndex = index;
        hitY = invaderRect.y;
      }
    }
  }

  if (hitIndex >= 0) {
    state.invaderAlive[hitIndex] = 0;
    state.liveInvaderCount -= 1;
    state.playerShot.active = false;
    return true;
  }

  return false;
}

function getRackStepInterval(state: SpaceInvadersState) {
  const liveRatio = (state.liveInvaderCount - 1) / (INVADER_COUNT - 1);
  const baseInterval =
    RACK_MIN_STEP_INTERVAL_MS +
    liveRatio * (RACK_INITIAL_STEP_INTERVAL_MS - RACK_MIN_STEP_INTERVAL_MS);
  const waveBonus = RACK_WAVE_INTERVAL_BONUS_MS * (state.wave - 1);

  return Math.max(RACK_MIN_STEP_INTERVAL_MS, baseInterval - waveBonus);
}

function advanceRack(state: SpaceInvadersState, dtMs: number) {
  state.rackStepAccumulatorMs += dtMs;

  const interval = getRackStepInterval(state);

  if (state.rackStepAccumulatorMs < interval) {
    return;
  }

  state.rackStepAccumulatorMs -= interval;

  const bounds = getLiveRackBounds(state);
  const nextRackX = state.rackX + state.rackDirection * RACK_HORIZONTAL_STEP;
  const liveLeft =
    nextRackX +
    bounds.minCol * INVADER_CELL_WIDTH +
    (INVADER_CELL_WIDTH - INVADER_BLOB_WIDTH) / 2;
  const liveRight =
    nextRackX +
    bounds.maxCol * INVADER_CELL_WIDTH +
    (INVADER_CELL_WIDTH + INVADER_BLOB_WIDTH) / 2;

  if (
    liveLeft < RACK_LEFT_PADDING ||
    liveRight > BOARD_WIDTH - RACK_RIGHT_PADDING
  ) {
    state.rackDirection = state.rackDirection === 1 ? -1 : 1;
    state.rackY += RACK_DOWN_STEP;
    return;
  }

  state.rackX = nextRackX;
}

function advanceAlienShot(state: SpaceInvadersState, dtSeconds: number) {
  if (!state.alienShot.active) {
    return;
  }

  state.alienShot.y += state.alienShot.velocityY * dtSeconds;

  if (state.alienShot.y > BOARD_HEIGHT) {
    state.alienShot.active = false;
  }
}

function countLiveShooterColumns(state: SpaceInvadersState) {
  let count = 0;

  for (let col = 0; col < INVADER_COLUMNS; col += 1) {
    for (let row = INVADER_ROWS - 1; row >= 0; row -= 1) {
      if (state.invaderAlive[getInvaderIndex(row, col)] === 1) {
        count += 1;
        break;
      }
    }
  }

  return count;
}

function findLiveShooterByOrdinal(state: SpaceInvadersState, ordinal: number) {
  let current = 0;

  for (let col = 0; col < INVADER_COLUMNS; col += 1) {
    for (let row = INVADER_ROWS - 1; row >= 0; row -= 1) {
      if (state.invaderAlive[getInvaderIndex(row, col)] !== 1) {
        continue;
      }

      if (current === ordinal) {
        return { row, col };
      }

      current += 1;
      break;
    }
  }

  return null;
}

function maybeSpawnAlienShot(state: SpaceInvadersState, dtMs: number) {
  if (state.alienShot.active || state.liveInvaderCount <= 0) {
    return;
  }

  state.alienShotAccumulatorMs += dtMs;

  if (state.alienShotAccumulatorMs < ALIEN_SHOT_ATTEMPT_INTERVAL_MS) {
    return;
  }

  state.alienShotAccumulatorMs -= ALIEN_SHOT_ATTEMPT_INTERVAL_MS;

  const shooterCount = countLiveShooterColumns(state);

  if (shooterCount <= 0) {
    return;
  }

  const random = nextLcgValue(state.rngState);
  state.rngState = random.state;

  const ordinal = Math.min(
    shooterCount - 1,
    Math.floor(random.value * shooterCount)
  );
  const shooter = findLiveShooterByOrdinal(state, ordinal);

  if (!shooter) {
    return;
  }

  const shooterRect = getInvaderRect(state, shooter.row, shooter.col);

  state.alienShot.active = true;
  state.alienShot.x = Math.round(shooterRect.x + shooterRect.width / 2);
  state.alienShot.y = shooterRect.y + shooterRect.height;
  state.alienShot.width = ALIEN_SHOT_WIDTH;
  state.alienShot.height = ALIEN_SHOT_HEIGHT;
  state.alienShot.velocityY = ALIEN_SHOT_SPEED_PX_PER_SECOND;
}

function resolveAlienShotVsPlayer(
  state: SpaceInvadersState,
  outcomes: SpaceInvadersStepOutcome[]
) {
  if (!state.alienShot.active) {
    return false;
  }

  const playerRect = {
    x: state.playerX,
    y: PLAYER_Y,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
  };

  if (!intersects(state.alienShot, playerRect)) {
    return false;
  }

  state.lives -= 1;
  clearShots(state);

  if (state.lives <= 0) {
    outcomes.push({ type: "game_over", reason: "lives" });
  } else {
    outcomes.push({ type: "player_hit", livesRemaining: state.lives });
  }

  return true;
}

function advanceWave(state: SpaceInvadersState) {
  state.wave += 1;
  state.invaderAlive.fill(1);
  state.liveInvaderCount = INVADER_COUNT;
  state.rackX = RACK_START_X;
  state.rackY =
    RACK_START_Y +
    Math.min(state.wave - 1, RACK_MAX_WAVE_Y_STEPS) * RACK_WAVE_Y_STEP;
  state.rackDirection = 1;
  state.rackStepAccumulatorMs = 0;
  state.alienShotAccumulatorMs = 0;
  clearShots(state);
}

function haveInvadersReachedPlayer(state: SpaceInvadersState) {
  const bounds = getLiveRackBounds(state);

  if (bounds.maxRow < 0) {
    return false;
  }

  const liveBottom =
    state.rackY +
    bounds.maxRow * INVADER_CELL_HEIGHT +
    (INVADER_CELL_HEIGHT + INVADER_BLOB_HEIGHT) / 2;

  return liveBottom >= PLAYER_Y;
}

function createState(options: SpaceInvadersEngineOptions): SpaceInvadersState {
  const invaderAlive = new Uint8Array(INVADER_COUNT);
  invaderAlive.fill(1);

  return {
    lives: options.lives ?? DEFAULT_LIVES,
    wave: 1,
    elapsedMs: 0,
    playerX: PLAYER_START_X,
    invaderAlive,
    liveInvaderCount: INVADER_COUNT,
    rackX: RACK_START_X,
    rackY: RACK_START_Y,
    rackDirection: 1,
    rackStepAccumulatorMs: 0,
    playerShot: createInactiveShot(),
    alienShot: createInactiveShot(),
    alienShotAccumulatorMs: 0,
    rngState: options.rngSeed ?? (Date.now() >>> 0),
  };
}

export function createSpaceInvadersEngine(
  options: SpaceInvadersEngineOptions = {}
): SpaceInvadersEngine {
  let state = createState(options);

  return {
    get state() {
      return state;
    },
    reset(resetOptions: SpaceInvadersEngineResetOptions = {}) {
      state = createState({ ...options, ...resetOptions });
    },
    step(
      input: SpaceInvadersInputSnapshot,
      dtMs: number
    ): SpaceInvadersStepOutcome[] {
      if (!Number.isFinite(dtMs) || dtMs < 0) {
        throw new Error(
          "Space Invaders step delta must be finite and non-negative"
        );
      }

      state.elapsedMs += dtMs;

      const dtSeconds = dtMs / 1000;
      const direction =
        input.moveLeft === input.moveRight ? 0 : input.moveLeft ? -1 : 1;

      state.playerX = clamp(
        state.playerX + direction * PLAYER_SPEED_PX_PER_SECOND * dtSeconds,
        PLAYER_MIN_X,
        PLAYER_MAX_X
      );

      if (state.playerShot.active) {
        state.playerShot.y += state.playerShot.velocityY * dtSeconds;

        if (state.playerShot.y + state.playerShot.height < 0) {
          state.playerShot.active = false;
        }
      }

      advanceAlienShot(state, dtSeconds);

      const outcomes: SpaceInvadersStepOutcome[] = [];
      const invaderHit = resolvePlayerShotVsInvaders(state);

      if (invaderHit && state.liveInvaderCount === 0) {
        advanceWave(state);
        outcomes.push({ type: "wave_cleared", wave: state.wave });
        return outcomes;
      }

      if (resolveAlienShotVsPlayer(state, outcomes)) {
        return outcomes;
      }

      if (input.firePressed && !state.playerShot.active) {
        state.playerShot.active = true;
        state.playerShot.x = Math.round(state.playerX + PLAYER_WIDTH / 2);
        state.playerShot.y = PLAYER_Y - PLAYER_SHOT_HEIGHT;
        state.playerShot.width = PLAYER_SHOT_WIDTH;
        state.playerShot.height = PLAYER_SHOT_HEIGHT;
        state.playerShot.velocityY = PLAYER_SHOT_SPEED_PX_PER_SECOND;
      }

      advanceRack(state, dtMs);

      if (haveInvadersReachedPlayer(state)) {
        outcomes.push({
          type: "game_over",
          reason: "invaders_reached_player",
        });
        return outcomes;
      }

      maybeSpawnAlienShot(state, dtMs);

      return outcomes;
    },
    getRenderState() {
      return state;
    },
  };
}
