import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  FIXED_DT_MS,
  ALIEN_SHOT_SPEED_PX_PER_SECOND,
  ALIEN_SHOT_ATTEMPT_INTERVAL_MS,
  INVADER_BLOB_HEIGHT,
  INVADER_BLOB_WIDTH,
  INVADER_CELL_HEIGHT,
  INVADER_CELL_WIDTH,
  INVADER_COUNT,
  PLAYER_MAX_X,
  PLAYER_MIN_X,
  PLAYER_SHOT_HEIGHT,
  PLAYER_SHOT_WIDTH,
  PLAYER_START_X,
  PLAYER_WIDTH,
  PLAYER_Y,
  RACK_DOWN_STEP,
  RACK_HORIZONTAL_STEP,
  RACK_INITIAL_STEP_INTERVAL_MS,
  createSpaceInvadersEngine,
} from "../index";

const neutralInput = {
  moveLeft: false,
  moveRight: false,
  firePressed: false,
};

describe("createSpaceInvadersEngine", () => {
  it("creates a native 224 x 256 board with 55 live invaders", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });

    expect(BOARD_WIDTH).toBe(224);
    expect(BOARD_HEIGHT).toBe(256);
    expect(engine.state.invaderAlive).toHaveLength(INVADER_COUNT);
    expect(engine.state.liveInvaderCount).toBe(55);
    expect(engine.state.playerX).toBe(PLAYER_START_X);
    expect(engine.state.playerShot.active).toBe(false);
    expect(engine.state.alienShot.active).toBe(false);
  });
});

describe("player movement", () => {
  it("moves left and clamps to the minimum x", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });

    for (let i = 0; i < 200; i += 1) {
      engine.step({ ...neutralInput, moveLeft: true }, FIXED_DT_MS);
    }

    expect(engine.state.playerX).toBe(PLAYER_MIN_X);
  });

  it("moves right and clamps to the maximum x", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });

    for (let i = 0; i < 200; i += 1) {
      engine.step({ ...neutralInput, moveRight: true }, FIXED_DT_MS);
    }

    expect(engine.state.playerX).toBe(PLAYER_MAX_X);
  });

  it("cancels movement when left and right are both held", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });
    const startX = engine.state.playerX;

    engine.step({ moveLeft: true, moveRight: true, firePressed: false }, 100);

    expect(engine.state.playerX).toBe(startX);
  });
});

describe("player firing", () => {
  it("creates one player shot from the center of the player", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });

    engine.step({ ...neutralInput, firePressed: true }, FIXED_DT_MS);

    expect(engine.state.playerShot.active).toBe(true);
    expect(engine.state.playerShot.width).toBe(PLAYER_SHOT_WIDTH);
    expect(engine.state.playerShot.height).toBe(PLAYER_SHOT_HEIGHT);
    expect(engine.state.playerShot.x).toBe(
      Math.round(engine.state.playerX + PLAYER_WIDTH / 2)
    );
    expect(engine.state.playerShot.y).toBe(PLAYER_Y - PLAYER_SHOT_HEIGHT);
  });

  it("does not replace an active player shot", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });

    engine.step({ ...neutralInput, firePressed: true }, FIXED_DT_MS);
    const firstShotY = engine.state.playerShot.y;
    engine.step({ ...neutralInput, firePressed: true }, FIXED_DT_MS);

    expect(engine.state.playerShot.active).toBe(true);
    expect(engine.state.playerShot.y).toBeLessThan(firstShotY);
  });
});

describe("invaders", () => {
  it("moves the rack horizontally after the step interval", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });
    const startX = engine.state.rackX;

    engine.step(neutralInput, RACK_INITIAL_STEP_INTERVAL_MS);

    expect(engine.state.rackX).toBe(startX + RACK_HORIZONTAL_STEP);
  });

  it("reverses and drops at the right edge", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });
    engine.state.rackX = 42;
    engine.state.rackDirection = 1;
    const startY = engine.state.rackY;

    engine.step(neutralInput, RACK_INITIAL_STEP_INTERVAL_MS);

    expect(engine.state.rackDirection).toBe(-1);
    expect(engine.state.rackY).toBe(startY + RACK_DOWN_STEP);
  });

  it("player shot kills one invader and clears the shot", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });
    const targetX =
      engine.state.rackX +
      (INVADER_CELL_WIDTH - INVADER_BLOB_WIDTH) / 2 +
      INVADER_BLOB_WIDTH / 2;
    const targetY =
      engine.state.rackY +
      (INVADER_CELL_HEIGHT - INVADER_BLOB_HEIGHT) / 2 +
      INVADER_BLOB_HEIGHT / 2;

    engine.state.playerShot.active = true;
    engine.state.playerShot.x = targetX;
    engine.state.playerShot.y = targetY;
    engine.state.playerShot.width = 1;
    engine.state.playerShot.height = 4;
    engine.state.playerShot.velocityY = 0;

    engine.step(neutralInput, FIXED_DT_MS);

    expect(engine.state.liveInvaderCount).toBe(54);
    expect(engine.state.invaderAlive[0]).toBe(0);
    expect(engine.state.playerShot.active).toBe(false);
  });
});

describe("alien shots and outcomes", () => {
  it("spawns an alien shot after the cadence interval", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });

    engine.step(neutralInput, ALIEN_SHOT_ATTEMPT_INTERVAL_MS);

    expect(engine.state.alienShot.active).toBe(true);
    expect(engine.state.alienShot.velocityY).toBe(
      ALIEN_SHOT_SPEED_PX_PER_SECOND
    );
  });

  it("alien shot collision decrements lives and returns player_hit", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });

    engine.state.alienShot.active = true;
    engine.state.alienShot.x = engine.state.playerX;
    engine.state.alienShot.y = PLAYER_Y;
    engine.state.alienShot.width = 2;
    engine.state.alienShot.height = 6;
    engine.state.alienShot.velocityY = 0;

    const outcomes = engine.step(neutralInput, FIXED_DT_MS);

    expect(engine.state.lives).toBe(2);
    expect(engine.state.alienShot.active).toBe(false);
    expect(outcomes).toContainEqual({ type: "player_hit", livesRemaining: 2 });
  });

  it("returns game_over when lives reach zero", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123, lives: 1 });

    engine.state.alienShot.active = true;
    engine.state.alienShot.x = engine.state.playerX;
    engine.state.alienShot.y = PLAYER_Y;
    engine.state.alienShot.width = 2;
    engine.state.alienShot.height = 6;
    engine.state.alienShot.velocityY = 0;

    const outcomes = engine.step(neutralInput, FIXED_DT_MS);

    expect(outcomes).toContainEqual({ type: "game_over", reason: "lives" });
  });

  it("returns wave_cleared and refills invaders when the final invader dies", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });

    engine.state.invaderAlive.fill(0);
    engine.state.invaderAlive[0] = 1;
    engine.state.liveInvaderCount = 1;
    engine.state.playerShot.active = true;
    engine.state.playerShot.x = engine.state.rackX + 8;
    engine.state.playerShot.y = engine.state.rackY + 8;
    engine.state.playerShot.width = 1;
    engine.state.playerShot.height = 4;
    engine.state.playerShot.velocityY = 0;

    const outcomes = engine.step(neutralInput, FIXED_DT_MS);

    expect(outcomes).toContainEqual({ type: "wave_cleared", wave: 2 });
    expect(engine.state.liveInvaderCount).toBe(55);
    expect(engine.state.wave).toBe(2);
  });

  it("returns game_over when invaders reach the player row", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });
    engine.state.rackY =
      PLAYER_Y -
      4 * INVADER_CELL_HEIGHT -
      (INVADER_CELL_HEIGHT + INVADER_BLOB_HEIGHT) / 2;

    const outcomes = engine.step(neutralInput, FIXED_DT_MS);

    expect(outcomes).toContainEqual({
      type: "game_over",
      reason: "invaders_reached_player",
    });
  });
});
