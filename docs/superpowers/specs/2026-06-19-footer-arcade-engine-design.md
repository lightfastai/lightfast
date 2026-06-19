# Footer Arcade Engine Design

Date: 2026-06-19
Status: Ready for user review
Area: `apps/www` v2 marketing footer arcade engine

## Summary

Build a tiny deterministic game engine for the footer arcade feature. The engine owns the Space Invaders-style simulation state, fixed-step updates, collision checks, shot spawning, wave progression, and render data. It does not own React lifecycle, XState lifecycle, DOM focus, keyboard event listeners, or `requestAnimationFrame`.

The engine should be simple, data-oriented, and efficient. It should mutate its own stable state object inside the hot path instead of cloning frame state every tick. Tests can still be deterministic because all inputs, elapsed time, and randomness enter through explicit parameters.

Related feature spec:

- `docs/superpowers/specs/2026-06-19-footer-space-invaders-design.md`

## Research Principles

The engine design follows these principles from browser game-loop and canvas performance research:

- Use `requestAnimationFrame` from the React shell, but keep the simulation on a fixed timestep.
- Clamp large elapsed-time gaps before catch-up stepping.
- Avoid per-frame object allocation in the hot path.
- Draw integer logical coordinates.
- Use a tiny canvas and scale it with CSS pixelated rendering.
- Do not use ECS, workers, or spatial partitioning for v1.

Reference material:

- `https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame`
- `https://developer.mozilla.org/en-US/docs/Games/Anatomy`
- `https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas`
- `https://gafferongames.com/post/fix_your_timestep/`
- `https://gameprogrammingpatterns.com/update-method.html`
- `https://gameprogrammingpatterns.com/data-locality.html`
- `https://gameprogrammingpatterns.com/object-pool.html`

## Responsibilities

### Engine Owns

- Board constants.
- Mutable simulation state.
- Fixed-step update logic.
- Player movement and firing constraints.
- Invader rack movement.
- Alien shot spawning.
- Collision detection.
- Life loss outcomes.
- Wave reset outcomes.
- Game over outcomes.
- Deterministic RNG.
- Read-only render snapshot access.

### Engine Does Not Own

- React component state.
- XState lifecycle transitions.
- DOM focus.
- Keyboard event listeners.
- `requestAnimationFrame`.
- Canvas element creation.
- Footer layout.
- Sound.
- Asset loading.
- Mobile/touch controls.

## Integration Boundary

The React client component is the runtime shell:

```text
React footer arcade component
-> owns canvas ref
-> owns keyboard listeners
-> owns RAF loop
-> owns XState actor
-> calls engine.step(inputSnapshot, FIXED_DT_MS)
-> calls renderFooterArcade(ctx, engine.getRenderState())
```

XState owns lifecycle only:

```text
idle -> booting -> running -> paused -> life_lost -> game_over
```

The engine owns simulation only:

```text
input snapshot + fixed dt + deterministic RNG -> mutated engine state + outcomes
```

The engine must never send XState events directly. Instead, `step` returns coarse outcomes. The React shell translates those outcomes into machine events.

## Public API

Use a small runtime facade.

```ts
export interface FooterArcadeEngineOptions {
  rngSeed?: number;
}

export interface FooterArcadeEngineResetOptions {
  rngSeed?: number;
}

export interface FooterArcadeEngine {
  readonly state: FooterArcadeGameState;
  reset(options?: FooterArcadeEngineResetOptions): void;
  step(input: FooterArcadeInputSnapshot, dtMs: number): FooterArcadeStepOutcome[];
  getRenderState(): FooterArcadeRenderState;
}

export function createFooterArcadeEngine(
  options?: FooterArcadeEngineOptions
): FooterArcadeEngine;
```

The engine object may expose `state` for tests and debugging, but normal rendering should read through `getRenderState()`.

`getRenderState()` should not allocate a large new object every frame. Either return a stable read-only view object or return the internal state typed as read-only. The implementation should avoid pretending to be immutable in the hot path.

Initial render-state type:

```ts
export type FooterArcadeRenderState = Readonly<FooterArcadeGameState>;
```

## Board Constants

```ts
export const BOARD_WIDTH = 224;
export const BOARD_HEIGHT = 256;
export const RENDER_SCALE = 2;

export const FIXED_DT_MS = 1000 / 60;
export const MAX_FRAME_DELTA_MS = 100;
export const MAX_STEPS_PER_FRAME = 5;
```

Canvas attributes:

```tsx
<canvas width={224} height={256} />
```

Canvas CSS:

```css
width: 448px;
height: 512px;
image-rendering: pixelated;
```

The engine should use logical pixels only. CSS scaling is outside the engine.

## Entity Constants

```ts
export const INVADER_COLUMNS = 11;
export const INVADER_ROWS = 5;
export const INVADER_COUNT = INVADER_COLUMNS * INVADER_ROWS;

export const INVADER_CELL_WIDTH = 16;
export const INVADER_CELL_HEIGHT = 16;
export const INVADER_BLOB_WIDTH = 12;
export const INVADER_BLOB_HEIGHT = 8;

export const PLAYER_WIDTH = 16;
export const PLAYER_HEIGHT = 8;
export const PLAYER_Y = 232;
export const PLAYER_START_X = (BOARD_WIDTH - PLAYER_WIDTH) / 2;
export const PLAYER_MIN_X = 8;
export const PLAYER_MAX_X = BOARD_WIDTH - PLAYER_WIDTH - 8;

export const PLAYER_SHOT_WIDTH = 1;
export const PLAYER_SHOT_HEIGHT = 4;
export const ALIEN_SHOT_WIDTH = 2;
export const ALIEN_SHOT_HEIGHT = 6;
```

Rack constants:

```ts
export const RACK_START_X = 24;
export const RACK_START_Y = 72;
export const RACK_WAVE_Y_STEP = 8;
export const RACK_MAX_WAVE_Y_STEPS = 4;
export const RACK_HORIZONTAL_STEP = 2;
export const RACK_DOWN_STEP = 8;
export const RACK_LEFT_PADDING = 8;
export const RACK_RIGHT_PADDING = 8;
```

Timing constants:

```ts
export const PLAYER_SPEED_PX_PER_SECOND = 72;
export const PLAYER_SHOT_SPEED_PX_PER_SECOND = -140;
export const ALIEN_SHOT_SPEED_PX_PER_SECOND = 48;

export const RACK_INITIAL_STEP_INTERVAL_MS = 500;
export const RACK_MIN_STEP_INTERVAL_MS = 80;
export const RACK_WAVE_INTERVAL_BONUS_MS = 20;

export const ALIEN_SHOT_ATTEMPT_INTERVAL_MS = 900;
export const PLAYER_HIT_DELAY_MS = 600;
```

## Input Snapshot

The React shell converts DOM keyboard events into a stable input snapshot. The engine should never read keyboard state directly.

```ts
export interface FooterArcadeInputSnapshot {
  moveLeft: boolean;
  moveRight: boolean;
  firePressed: boolean;
}
```

Rules:

- `moveLeft` and `moveRight` may both be true. If both are true, movement cancels out.
- `firePressed` is edge-triggered by the shell. Holding `Space` should not repeatedly set `firePressed`.
- Input snapshots are read during fixed steps only.

## State Layout

Use stable data structures.

```ts
export interface FooterArcadeGameState {
  lives: number;
  wave: number;
  elapsedMs: number;

  playerX: number;

  invaderAlive: Uint8Array;
  liveInvaderCount: number;
  rackX: number;
  rackY: number;
  rackDirection: -1 | 1;
  rackStepAccumulatorMs: number;

  playerShot: FooterArcadeShotSlot;
  alienShot: FooterArcadeShotSlot;
  alienShotAccumulatorMs: number;

  rngState: number;
}

export interface FooterArcadeShotSlot {
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
}
```

The `invaderAlive` array has length `55`. Index mapping:

```ts
const index = row * INVADER_COLUMNS + col;
```

The engine should reuse the same `Uint8Array` after initialization. Resetting a wave fills it back to `1` values.

## Deterministic RNG

Alien shot column selection needs randomness. Use a tiny deterministic RNG inside the engine so tests can repeat exact behavior.

Use an unsigned 32-bit linear congruential generator or a similarly small deterministic function.

```ts
function nextRandom(state: number): { state: number; value: number };
```

Rules:

- The seed comes from `createFooterArcadeEngine({ rngSeed })`.
- If no seed is provided, the engine factory initializes `rngState` from `Date.now() >>> 0`.
- Tests should pass a seed.
- Randomness should only be consumed in alien shot selection.

## Step Outcomes

The engine reports coarse outcomes to the React shell.

```ts
export type FooterArcadeStepOutcome =
  | { type: "player_hit"; livesRemaining: number }
  | { type: "wave_cleared"; wave: number }
  | { type: "game_over"; reason: "lives" | "invaders_reached_player" };
```

The engine returns an empty array when nothing notable happened.

To avoid per-frame allocation, the engine may keep a small reusable outcomes array internally:

```ts
outcomes.length = 0;
```

The React shell must process outcomes synchronously before the next step.

## Fixed-Step Loop

The engine does not own RAF. The React shell owns the accumulator.

Recommended shell shape:

```ts
let accumulatorMs = 0;
let lastTimestamp = performance.now();

function frame(timestamp: number) {
  const rawDelta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  const delta = Math.min(rawDelta, MAX_FRAME_DELTA_MS);
  accumulatorMs += delta;

  let steps = 0;

  while (accumulatorMs >= FIXED_DT_MS && steps < MAX_STEPS_PER_FRAME) {
    const outcomes = engine.step(inputSnapshot, FIXED_DT_MS);
    handleOutcomes(outcomes);
    accumulatorMs -= FIXED_DT_MS;
    steps += 1;
  }

  if (steps === MAX_STEPS_PER_FRAME) {
    accumulatorMs = 0;
  }

  renderFooterArcade(ctx, engine.getRenderState());
  requestAnimationFrame(frame);
}
```

The shell should skip stepping while XState lifecycle is not `running`, but it may still render the current canvas state.

## Update Phase Order

Each fixed step should run in this order:

1. Add `dtMs` to `elapsedMs`.
2. Update player position from input.
3. Try to fire player shot if `firePressed` and no player shot is active.
4. Move active player shot.
5. Resolve player shot vs invaders.
6. Advance rack step accumulator.
7. Move rack horizontally or drop/reverse if the interval elapsed.
8. Check whether invaders reached the player danger zone.
9. Advance alien shot accumulator.
10. Spawn alien shot if allowed.
11. Move active alien shot.
12. Resolve alien shot vs player.
13. Check wave clear.
14. Return coarse outcomes.

This order makes player input feel responsive while preserving predictable rack movement.

## Player Movement

```ts
const direction =
  input.moveLeft === input.moveRight ? 0 : input.moveLeft ? -1 : 1;

state.playerX += direction * PLAYER_SPEED_PX_PER_SECOND * (dtMs / 1000);
state.playerX = clamp(state.playerX, PLAYER_MIN_X, PLAYER_MAX_X);
```

Use floating-point positions internally. Renderer rounds to integer logical pixels.

## Player Shot

Rules:

- Only one active player shot.
- Firing starts at the horizontal center of the player.
- Shot moves upward at `-140` logical px/s.
- Shot is deactivated when it exits the top.
- On collision with a live invader, deactivate the shot and kill one invader.

Shot start:

```ts
shot.x = Math.round(state.playerX + PLAYER_WIDTH / 2);
shot.y = PLAYER_Y - PLAYER_SHOT_HEIGHT;
```

Collision can scan all live invaders. With only 55 invaders, spatial partitioning is unnecessary.

If one fixed step intersects multiple invaders, kill the lowest hit in screen space because the shot travels upward from the player.

## Invader Rack

The rack is represented by `rackX`, `rackY`, `rackDirection`, and `invaderAlive`.

Invader visual rect:

```ts
const cellX = state.rackX + col * INVADER_CELL_WIDTH;
const cellY = state.rackY + row * INVADER_CELL_HEIGHT;

const x = cellX + (INVADER_CELL_WIDTH - INVADER_BLOB_WIDTH) / 2;
const y = cellY + (INVADER_CELL_HEIGHT - INVADER_BLOB_HEIGHT) / 2;
```

Rack bounds:

- Compute live min/max columns and rows by scanning `invaderAlive`.
- Cache bounds inside local step variables.
- Recompute when needed; 55 checks is cheap.

Step interval:

```ts
const liveRatio = (state.liveInvaderCount - 1) / (INVADER_COUNT - 1);
const baseInterval =
  RACK_MIN_STEP_INTERVAL_MS +
  liveRatio * (RACK_INITIAL_STEP_INTERVAL_MS - RACK_MIN_STEP_INTERVAL_MS);

const waveBonus = RACK_WAVE_INTERVAL_BONUS_MS * (state.wave - 1);
const interval = Math.max(RACK_MIN_STEP_INTERVAL_MS, baseInterval - waveBonus);
```

Edge behavior:

- Compute the next horizontal rack position.
- If live bounds would cross board padding, reverse direction and move down.
- Otherwise apply the horizontal step.

## Alien Shot

V1 has one active alien shot.

Spawn rules:

- Attempt every `900ms`.
- Skip if `alienShot.active` is true.
- `70%` chance: choose nearest live column to player center.
- `30%` chance: choose a random live column.
- Spawn from the lowest live invader in that column.

If the biased column has no live invader, choose the nearest column with a live invader. If no invaders are alive, skip.

Shot start:

```ts
shot.x = invaderCenterX;
shot.y = invaderBottomY;
shot.width = ALIEN_SHOT_WIDTH;
shot.height = ALIEN_SHOT_HEIGHT;
shot.velocityY = ALIEN_SHOT_SPEED_PX_PER_SECOND;
```

On player collision:

- Deactivate player shot.
- Deactivate alien shot.
- Decrement `lives`.
- Reset `playerX` to center.
- Return `player_hit` or `game_over`.

The XState lifecycle owns the `600ms` life-loss delay before the shell resumes stepping.

## Wave Reset

When `liveInvaderCount` reaches `0`:

- Increment `wave`.
- Refill `invaderAlive` with `1`.
- Set `liveInvaderCount` to `55`.
- Reset `rackX` to `RACK_START_X`.
- Set `rackY` to `RACK_START_Y + min(wave - 1, RACK_MAX_WAVE_Y_STEPS) * RACK_WAVE_Y_STEP`.
- Reset `rackDirection` to `1`.
- Clear shots.
- Keep lives.
- Return `wave_cleared`.

## Game Over

Game over occurs when:

- `lives` reaches `0`.
- Any live invader bottom reaches `PLAYER_Y - 8`.

The engine reports `game_over`. XState moves to `game_over` and stops stepping.

Replay is a lifecycle event. On replay, the shell calls `engine.reset()` before returning to `running`.

## Collision

Use axis-aligned rectangle overlap:

```ts
function intersects(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
```

Collision helpers should take primitive rects or write into a reusable scratch rect. Avoid allocating temporary rect objects for every invader check.

Recommended scratch shape:

```ts
const scratchRect = { x: 0, y: 0, width: 0, height: 0 };
```

## Render Contract

Renderer is separate from simulation.

```ts
export function renderFooterArcade(
  ctx: CanvasRenderingContext2D,
  state: FooterArcadeRenderState
): void;
```

Render rules:

- Clear the full `224 x 256` canvas.
- Fill black background.
- Draw live invaders as simple blobs.
- Draw player.
- Draw active player shot.
- Draw active alien shot.
- Draw lives glyphs bottom-left.
- Draw optional game-over marker only when lifecycle asks for it.
- Round positions to integer logical pixels.

Use `fillRect` for v1. Do not introduce image assets yet.

Canvas context:

```ts
canvas.getContext("2d", { alpha: false });
```

The renderer can own visual constants such as colors and glyph shapes. It must not mutate engine state.

## Allocation Rules

Hot path rules:

- Do not allocate new arrays inside `step`.
- Do not allocate new entity objects inside `step`.
- Do not clone `FooterArcadeGameState` each frame.
- Do not create temporary rect objects inside inner collision loops.
- Reuse shot slots.
- Reuse outcome array or keep outcome count small and synchronous.

Acceptable allocations:

- Engine creation.
- Full reset.
- Test helpers.
- Non-hot debug snapshots.

## Error Handling

The engine should fail loudly in development for invalid setup:

- `invaderAlive.length !== 55`.
- Negative or non-finite `dtMs`.
- Missing canvas context in renderer.

In production, the React shell can fail closed by showing the idle logo or a static fallback if canvas setup fails.

## Performance Budget

Target:

- No React render per animation frame.
- No XState event per animation frame.
- No heap growth during steady-state gameplay.
- Full canvas redraw under `1ms` on ordinary desktop hardware.
- Engine step under `1ms` on ordinary desktop hardware.

Manual profiling:

- Use browser performance panel while the footer game runs.
- Confirm no continuous React commits during gameplay.
- Confirm heap allocation does not grow steadily.
- Confirm frame time remains stable when invader count is high and low.

## Testing

Engine tests should not require React, canvas, or XState.

Focused test groups:

### Initialization

- Creates 55 live invaders.
- Starts player centered.
- Starts with configured lives and wave.
- Initializes shots inactive.
- Uses passed RNG seed.

### Input And Player

- Left/right movement clamps to board bounds.
- Simultaneous left and right cancels movement.
- `firePressed` activates a shot only when no player shot is active.
- Holding fire without a new edge does not spawn another shot.

### Rack

- Rack steps horizontally after interval.
- Rack reverses and drops at board edge.
- Rack speed increases as invaders die.
- Wave bonus reduces interval but respects minimum.

### Player Shot

- Shot moves upward.
- Shot deactivates offscreen.
- Shot kills exactly one invader.
- Lowest hit wins if multiple invaders overlap.

### Alien Shot

- Shot does not spawn before cadence interval.
- Shot spawns from lowest live invader in selected column.
- Biased selection picks nearest live column to player for seeded runs.
- Random selection is deterministic with seed.
- Shot moves downward and deactivates offscreen.

### Lives And Game Over

- Alien shot collision decrements lives.
- Collision clears shots and recenters player.
- Zero lives returns `game_over`.
- Invader reaching danger zone returns `game_over`.

### Wave Reset

- Clearing final invader returns `wave_cleared`.
- New wave refills invaders.
- New wave starts lower up to the clamp.
- Lives are preserved across waves.

## Future Extensions

The engine should leave room for:

- Destructible shields as a separate fixed grid or mask layer.
- Mystery saucer as a second fixed actor slot.
- Multiple alien shot slots.
- Score and high score.
- Sprite atlas rendering.
- Debug overlay in development.
- Offscreen pre-rendered sprites.

Do not add those in v1.
