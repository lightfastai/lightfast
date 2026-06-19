# Footer Arcade Engine And Space Invaders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable fixed-step game-engine package, a tested Space Invaders simulation package, and wire the v2 marketing footer logo slot to a playable desktop canvas game.

**Architecture:** `@repo/game-engine` provides tiny generic primitives: fixed-step accumulation, rectangle collision, clamping, and deterministic RNG. `@repo/space-invaders` owns all game-specific state, update logic, outcomes, constants, and a canvas renderer. `apps/www` owns XState lifecycle, keyboard/focus/RAF wiring, and footer layout integration.

**Tech Stack:** TypeScript, Vitest, Canvas 2D, XState v5, React 19, Next.js 16, pnpm workspace packages.

---

## Existing Context

Specs:

- `docs/superpowers/specs/2026-06-19-footer-space-invaders-design.md`
- `docs/superpowers/specs/2026-06-19-footer-arcade-engine-design.md`

Current footer path in this worktree:

- `apps/www/src/app/(v2)/(marketing)/_components/footer.tsx`

Important worktree note:

- There are unrelated app migration changes already present. Do not revert them.
- Commit with explicit pathspecs when committing this work.

## Package Naming Decision

Do not create `vendor/game-engine`. In this repo, `vendor/*` packages are wrappers/re-exports around third-party SDKs and services. This engine is first-party product code, so it belongs in `packages/*`.

Create:

- `packages/game-engine` as `@repo/game-engine`
- `packages/space-invaders` as `@repo/space-invaders`

## File Map

Create:

- `packages/game-engine/package.json`
- `packages/game-engine/tsconfig.json`
- `packages/game-engine/vitest.config.ts`
- `packages/game-engine/turbo.json`
- `packages/game-engine/src/index.ts`
- `packages/game-engine/src/fixed-step.ts`
- `packages/game-engine/src/math.ts`
- `packages/game-engine/src/rng.ts`
- `packages/game-engine/src/__tests__/fixed-step.test.ts`
- `packages/game-engine/src/__tests__/math.test.ts`
- `packages/game-engine/src/__tests__/rng.test.ts`
- `packages/space-invaders/package.json`
- `packages/space-invaders/tsconfig.json`
- `packages/space-invaders/vitest.config.ts`
- `packages/space-invaders/turbo.json`
- `packages/space-invaders/src/index.ts`
- `packages/space-invaders/src/constants.ts`
- `packages/space-invaders/src/types.ts`
- `packages/space-invaders/src/engine.ts`
- `packages/space-invaders/src/renderer.ts`
- `packages/space-invaders/src/__tests__/engine.test.ts`
- `packages/space-invaders/src/__tests__/renderer.test.ts`
- `apps/www/src/app/(v2)/(marketing)/_components/footer-arcade.tsx`
- `apps/www/src/app/(v2)/(marketing)/_components/footer-arcade-machine.ts`

Modify:

- `apps/www/package.json`
- `apps/www/src/app/(v2)/(marketing)/_components/footer.tsx`

## Task 1: Create `@repo/game-engine` Package Skeleton

**Files:**

- Create: `packages/game-engine/package.json`
- Create: `packages/game-engine/tsconfig.json`
- Create: `packages/game-engine/vitest.config.ts`
- Create: `packages/game-engine/turbo.json`
- Create: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Create package metadata**

Create `packages/game-engine/package.json`:

```json
{
  "name": "@repo/game-engine",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Add TypeScript config**

Create `packages/game-engine/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Add Vitest config**

Create `packages/game-engine/vitest.config.ts`:

```ts
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
    },
  })
);
```

- [ ] **Step 4: Add Turbo metadata**

Create `packages/game-engine/turbo.json`:

```json
{
  "extends": ["//"],
  "tags": ["packages"],
  "tasks": {}
}
```

- [ ] **Step 5: Add empty package entry**

Create `packages/game-engine/src/index.ts`:

```ts
export {};
```

- [ ] **Step 6: Verify package scaffold**

Run:

```bash
pnpm --filter @repo/game-engine typecheck
```

Expected: PASS.

## Task 2: TDD Generic Math Helpers

**Files:**

- Create: `packages/game-engine/src/math.ts`
- Create: `packages/game-engine/src/__tests__/math.test.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Write failing math tests**

Create `packages/game-engine/src/__tests__/math.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm --filter @repo/game-engine test -- src/__tests__/math.test.ts
```

Expected: FAIL because `../math` does not exist.

- [ ] **Step 3: Implement math helpers**

Create `packages/game-engine/src/math.ts`:

```ts
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function intersects(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
```

Modify `packages/game-engine/src/index.ts`:

```ts
export { clamp, intersects, type Rect } from "./math";
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
pnpm --filter @repo/game-engine test -- src/__tests__/math.test.ts
```

Expected: PASS.

## Task 3: TDD Deterministic RNG

**Files:**

- Create: `packages/game-engine/src/rng.ts`
- Create: `packages/game-engine/src/__tests__/rng.test.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Write failing RNG tests**

Create `packages/game-engine/src/__tests__/rng.test.ts`:

```ts
import { createLcgRng, nextLcgValue } from "../rng";

describe("nextLcgValue", () => {
  it("produces deterministic values from the same seed", () => {
    const first = nextLcgValue(123);
    const second = nextLcgValue(123);

    expect(first).toEqual(second);
  });

  it("returns a normalized value in [0, 1)", () => {
    const result = nextLcgValue(123);

    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThan(1);
  });
});

describe("createLcgRng", () => {
  it("advances state with each next call", () => {
    const rng = createLcgRng(123);

    const first = rng.next();
    const second = rng.next();

    expect(first).not.toBe(second);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm --filter @repo/game-engine test -- src/__tests__/rng.test.ts
```

Expected: FAIL because `../rng` does not exist.

- [ ] **Step 3: Implement RNG**

Create `packages/game-engine/src/rng.ts`:

```ts
export interface LcgResult {
  state: number;
  value: number;
}

export interface LcgRng {
  getState(): number;
  next(): number;
}

const MULTIPLIER = 1664525;
const INCREMENT = 1013904223;
const UINT32_MAX_PLUS_ONE = 0x100000000;

export function nextLcgValue(state: number): LcgResult {
  const nextState = (Math.imul(state >>> 0, MULTIPLIER) + INCREMENT) >>> 0;

  return {
    state: nextState,
    value: nextState / UINT32_MAX_PLUS_ONE,
  };
}

export function createLcgRng(seed: number): LcgRng {
  let state = seed >>> 0;

  return {
    getState() {
      return state;
    },
    next() {
      const result = nextLcgValue(state);
      state = result.state;
      return result.value;
    },
  };
}
```

Modify `packages/game-engine/src/index.ts`:

```ts
export { clamp, intersects, type Rect } from "./math";
export {
  createLcgRng,
  nextLcgValue,
  type LcgResult,
  type LcgRng,
} from "./rng";
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
pnpm --filter @repo/game-engine test -- src/__tests__/rng.test.ts
```

Expected: PASS.

## Task 4: TDD Fixed-Step Accumulator

**Files:**

- Create: `packages/game-engine/src/fixed-step.ts`
- Create: `packages/game-engine/src/__tests__/fixed-step.test.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Write failing fixed-step tests**

Create `packages/game-engine/src/__tests__/fixed-step.test.ts`:

```ts
import { createFixedStepAccumulator } from "../fixed-step";

describe("createFixedStepAccumulator", () => {
  it("does not step before enough time accumulates", () => {
    const accumulator = createFixedStepAccumulator({
      fixedStepMs: 100,
      maxFrameDeltaMs: 250,
      maxStepsPerFrame: 5,
    });

    const result = accumulator.advance(99);

    expect(result.steps).toBe(0);
    expect(result.droppedTime).toBe(false);
  });

  it("returns the number of fixed steps to process", () => {
    const accumulator = createFixedStepAccumulator({
      fixedStepMs: 100,
      maxFrameDeltaMs: 250,
      maxStepsPerFrame: 5,
    });

    const result = accumulator.advance(250);

    expect(result.steps).toBe(2);
    expect(result.droppedTime).toBe(false);
  });

  it("caps catch-up steps and drops excess accumulated time", () => {
    const accumulator = createFixedStepAccumulator({
      fixedStepMs: 10,
      maxFrameDeltaMs: 100,
      maxStepsPerFrame: 5,
    });

    const result = accumulator.advance(100);

    expect(result.steps).toBe(5);
    expect(result.droppedTime).toBe(true);
    expect(accumulator.getRemainingMs()).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm --filter @repo/game-engine test -- src/__tests__/fixed-step.test.ts
```

Expected: FAIL because `../fixed-step` does not exist.

- [ ] **Step 3: Implement fixed-step accumulator**

Create `packages/game-engine/src/fixed-step.ts`:

```ts
export interface FixedStepAccumulatorOptions {
  fixedStepMs: number;
  maxFrameDeltaMs: number;
  maxStepsPerFrame: number;
}

export interface FixedStepAdvanceResult {
  steps: number;
  droppedTime: boolean;
}

export interface FixedStepAccumulator {
  advance(deltaMs: number): FixedStepAdvanceResult;
  reset(): void;
  getRemainingMs(): number;
}

export function createFixedStepAccumulator(
  options: FixedStepAccumulatorOptions
): FixedStepAccumulator {
  let remainingMs = 0;

  return {
    advance(deltaMs: number) {
      if (!Number.isFinite(deltaMs) || deltaMs < 0) {
        throw new Error("Fixed-step delta must be a finite non-negative number");
      }

      remainingMs += Math.min(deltaMs, options.maxFrameDeltaMs);

      let steps = 0;

      while (
        remainingMs >= options.fixedStepMs &&
        steps < options.maxStepsPerFrame
      ) {
        remainingMs -= options.fixedStepMs;
        steps += 1;
      }

      const droppedTime = steps === options.maxStepsPerFrame;

      if (droppedTime) {
        remainingMs = 0;
      }

      return { steps, droppedTime };
    },
    reset() {
      remainingMs = 0;
    },
    getRemainingMs() {
      return remainingMs;
    },
  };
}
```

Modify `packages/game-engine/src/index.ts`:

```ts
export {
  createFixedStepAccumulator,
  type FixedStepAccumulator,
  type FixedStepAccumulatorOptions,
  type FixedStepAdvanceResult,
} from "./fixed-step";
export { clamp, intersects, type Rect } from "./math";
export {
  createLcgRng,
  nextLcgValue,
  type LcgResult,
  type LcgRng,
} from "./rng";
```

- [ ] **Step 4: Run package quality checks**

Run:

```bash
pnpm --filter @repo/game-engine test
pnpm --filter @repo/game-engine typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit game-engine package**

Run:

```bash
git add packages/game-engine
git commit -m "feat: add game engine primitives" -- packages/game-engine
```

Expected: commit includes only `packages/game-engine`.

## Task 5: Create `@repo/space-invaders` Package Skeleton

**Files:**

- Create: `packages/space-invaders/package.json`
- Create: `packages/space-invaders/tsconfig.json`
- Create: `packages/space-invaders/vitest.config.ts`
- Create: `packages/space-invaders/turbo.json`
- Create: `packages/space-invaders/src/index.ts`

- [ ] **Step 1: Create package metadata**

Create `packages/space-invaders/package.json`:

```json
{
  "name": "@repo/space-invaders",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/game-engine": "workspace:*"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Add TypeScript config with DOM canvas types**

Create `packages/space-invaders/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Add Vitest config**

Create `packages/space-invaders/vitest.config.ts`:

```ts
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
    },
  })
);
```

- [ ] **Step 4: Add Turbo metadata**

Create `packages/space-invaders/turbo.json`:

```json
{
  "extends": ["//"],
  "tags": ["packages"],
  "tasks": {}
}
```

- [ ] **Step 5: Add empty package entry**

Create `packages/space-invaders/src/index.ts`:

```ts
export {};
```

- [ ] **Step 6: Run package install metadata refresh**

Run:

```bash
pnpm install
```

Expected: lockfile and workspace links update successfully.

## Task 6: TDD Space Invaders Constants And Types

**Files:**

- Create: `packages/space-invaders/src/constants.ts`
- Create: `packages/space-invaders/src/types.ts`
- Modify: `packages/space-invaders/src/index.ts`
- Create: `packages/space-invaders/src/__tests__/engine.test.ts`

- [ ] **Step 1: Write failing initialization test**

Create `packages/space-invaders/src/__tests__/engine.test.ts`:

```ts
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  INVADER_COUNT,
  PLAYER_START_X,
  createSpaceInvadersEngine,
} from "../index";

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
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
pnpm --filter @repo/space-invaders test -- src/__tests__/engine.test.ts
```

Expected: FAIL because constants and engine do not exist.

- [ ] **Step 3: Add constants and types**

Create `packages/space-invaders/src/constants.ts`:

```ts
export const BOARD_WIDTH = 224;
export const BOARD_HEIGHT = 256;
export const RENDER_SCALE = 2;

export const FIXED_DT_MS = 1000 / 60;
export const MAX_FRAME_DELTA_MS = 100;
export const MAX_STEPS_PER_FRAME = 5;

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

export const RACK_START_X = 24;
export const RACK_START_Y = 72;
export const RACK_WAVE_Y_STEP = 8;
export const RACK_MAX_WAVE_Y_STEPS = 4;
export const RACK_HORIZONTAL_STEP = 2;
export const RACK_DOWN_STEP = 8;
export const RACK_LEFT_PADDING = 8;
export const RACK_RIGHT_PADDING = 8;

export const PLAYER_SPEED_PX_PER_SECOND = 72;
export const PLAYER_SHOT_SPEED_PX_PER_SECOND = -140;
export const ALIEN_SHOT_SPEED_PX_PER_SECOND = 48;

export const RACK_INITIAL_STEP_INTERVAL_MS = 500;
export const RACK_MIN_STEP_INTERVAL_MS = 80;
export const RACK_WAVE_INTERVAL_BONUS_MS = 20;

export const ALIEN_SHOT_ATTEMPT_INTERVAL_MS = 900;
export const PLAYER_HIT_DELAY_MS = 600;
```

Create `packages/space-invaders/src/types.ts`:

```ts
export interface SpaceInvadersInputSnapshot {
  moveLeft: boolean;
  moveRight: boolean;
  firePressed: boolean;
}

export interface SpaceInvadersShotSlot {
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
}

export interface SpaceInvadersState {
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
  playerShot: SpaceInvadersShotSlot;
  alienShot: SpaceInvadersShotSlot;
  alienShotAccumulatorMs: number;
  rngState: number;
}

export type SpaceInvadersStepOutcome =
  | { type: "player_hit"; livesRemaining: number }
  | { type: "wave_cleared"; wave: number }
  | { type: "game_over"; reason: "lives" | "invaders_reached_player" };

export interface SpaceInvadersEngineOptions {
  rngSeed?: number;
  lives?: number;
}

export interface SpaceInvadersEngineResetOptions {
  rngSeed?: number;
  lives?: number;
}

export interface SpaceInvadersEngine {
  readonly state: SpaceInvadersState;
  reset(options?: SpaceInvadersEngineResetOptions): void;
  step(
    input: SpaceInvadersInputSnapshot,
    dtMs: number
  ): SpaceInvadersStepOutcome[];
  getRenderState(): Readonly<SpaceInvadersState>;
}
```

- [ ] **Step 4: Add minimal engine to pass initialization**

Create `packages/space-invaders/src/engine.ts`:

```ts
import {
  INVADER_COUNT,
  PLAYER_START_X,
  RACK_START_X,
  RACK_START_Y,
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
      _input: SpaceInvadersInputSnapshot,
      _dtMs: number
    ): SpaceInvadersStepOutcome[] {
      return [];
    },
    getRenderState() {
      return state;
    },
  };
}
```

Modify `packages/space-invaders/src/index.ts`:

```ts
export * from "./constants";
export { createSpaceInvadersEngine } from "./engine";
export type {
  SpaceInvadersEngine,
  SpaceInvadersEngineOptions,
  SpaceInvadersEngineResetOptions,
  SpaceInvadersInputSnapshot,
  SpaceInvadersShotSlot,
  SpaceInvadersState,
  SpaceInvadersStepOutcome,
} from "./types";
```

- [ ] **Step 5: Run test and verify GREEN**

Run:

```bash
pnpm --filter @repo/space-invaders test -- src/__tests__/engine.test.ts
```

Expected: PASS.

## Task 7: TDD Player Movement And Firing

**Files:**

- Modify: `packages/space-invaders/src/__tests__/engine.test.ts`
- Modify: `packages/space-invaders/src/engine.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/space-invaders/src/__tests__/engine.test.ts`:

```ts
import {
  FIXED_DT_MS,
  PLAYER_MAX_X,
  PLAYER_MIN_X,
  PLAYER_SHOT_HEIGHT,
  PLAYER_SHOT_WIDTH,
  PLAYER_WIDTH,
  PLAYER_Y,
} from "../index";

const neutralInput = {
  moveLeft: false,
  moveRight: false,
  firePressed: false,
};

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
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm --filter @repo/space-invaders test -- src/__tests__/engine.test.ts
```

Expected: FAIL because movement and shot update are not implemented.

- [ ] **Step 3: Implement movement and firing**

Modify `packages/space-invaders/src/engine.ts` by importing constants and helpers:

```ts
import { clamp } from "@repo/game-engine";
import {
  ALIEN_SHOT_HEIGHT,
  ALIEN_SHOT_WIDTH,
  INVADER_COUNT,
  PLAYER_MAX_X,
  PLAYER_MIN_X,
  PLAYER_SHOT_HEIGHT,
  PLAYER_SHOT_SPEED_PX_PER_SECOND,
  PLAYER_SHOT_WIDTH,
  PLAYER_SPEED_PX_PER_SECOND,
  PLAYER_START_X,
  PLAYER_WIDTH,
  PLAYER_Y,
  RACK_START_X,
  RACK_START_Y,
} from "./constants";
```

Replace `step` with:

```ts
step(input: SpaceInvadersInputSnapshot, dtMs: number): SpaceInvadersStepOutcome[] {
  if (!Number.isFinite(dtMs) || dtMs < 0) {
    throw new Error("Space Invaders step delta must be finite and non-negative");
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

  if (input.firePressed && !state.playerShot.active) {
    state.playerShot.active = true;
    state.playerShot.x = Math.round(state.playerX + PLAYER_WIDTH / 2);
    state.playerShot.y = PLAYER_Y - PLAYER_SHOT_HEIGHT;
    state.playerShot.width = PLAYER_SHOT_WIDTH;
    state.playerShot.height = PLAYER_SHOT_HEIGHT;
    state.playerShot.velocityY = PLAYER_SHOT_SPEED_PX_PER_SECOND;
  }

  if (state.playerShot.active) {
    state.playerShot.y += state.playerShot.velocityY * dtSeconds;

    if (state.playerShot.y + state.playerShot.height < 0) {
      state.playerShot.active = false;
    }
  }

  return [];
}
```

Ensure `createInactiveShot()` initializes `width` and `height` for alien shot only when activated. No other behavior is required for this task.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
pnpm --filter @repo/space-invaders test -- src/__tests__/engine.test.ts
```

Expected: PASS.

## Task 8: TDD Invader Collision And Rack Movement

**Files:**

- Modify: `packages/space-invaders/src/__tests__/engine.test.ts`
- Modify: `packages/space-invaders/src/engine.ts`

- [ ] **Step 1: Add failing invader tests**

Append to `packages/space-invaders/src/__tests__/engine.test.ts`:

```ts
import {
  INVADER_BLOB_HEIGHT,
  INVADER_BLOB_WIDTH,
  INVADER_CELL_HEIGHT,
  INVADER_CELL_WIDTH,
  RACK_DOWN_STEP,
  RACK_HORIZONTAL_STEP,
  RACK_INITIAL_STEP_INTERVAL_MS,
} from "../index";

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
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm --filter @repo/space-invaders test -- src/__tests__/engine.test.ts
```

Expected: FAIL because rack movement and invader collision are not implemented.

- [ ] **Step 3: Implement rack movement and invader collision**

Add helpers to `packages/space-invaders/src/engine.ts`:

```ts
function getInvaderIndex(row: number, col: number) {
  return row * INVADER_COLUMNS + col;
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
```

Use `intersects` from `@repo/game-engine`, and implement:

```ts
function resolvePlayerShotVsInvaders(state: SpaceInvadersState) {
  if (!state.playerShot.active) {
    return;
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
  }
}
```

Add rack movement:

```ts
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
```

Call `resolvePlayerShotVsInvaders(state)` after moving the player shot and before `advanceRack(state, dtMs)`.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
pnpm --filter @repo/space-invaders test -- src/__tests__/engine.test.ts
```

Expected: PASS.

## Task 9: TDD Alien Shots, Lives, Waves, Game Over

**Files:**

- Modify: `packages/space-invaders/src/__tests__/engine.test.ts`
- Modify: `packages/space-invaders/src/engine.ts`

- [ ] **Step 1: Add failing outcome tests**

Append tests for:

```ts
describe("alien shots and outcomes", () => {
  it("spawns an alien shot after the cadence interval", () => {
    const engine = createSpaceInvadersEngine({ rngSeed: 123 });

    engine.step(neutralInput, 900);

    expect(engine.state.alienShot.active).toBe(true);
    expect(engine.state.alienShot.velocityY).toBe(48);
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
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm --filter @repo/space-invaders test -- src/__tests__/engine.test.ts
```

Expected: FAIL because alien shots, lives, and waves are incomplete.

- [ ] **Step 3: Implement outcomes**

Implement:

- reusable `outcomes: SpaceInvadersStepOutcome[] = []`
- alien shot spawn with deterministic `nextLcgValue`
- alien shot movement
- player collision
- game over on lives
- game over on invader danger zone
- wave reset

Use the engine spec as exact contract:

```ts
function clearShots(state: SpaceInvadersState) {
  state.playerShot.active = false;
  state.alienShot.active = false;
}
```

Use `intersects` with the player rect:

```ts
const playerRect = {
  x: state.playerX,
  y: PLAYER_Y,
  width: PLAYER_WIDTH,
  height: PLAYER_HEIGHT,
};
```

Wave reset should:

```ts
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
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @repo/space-invaders test
pnpm --filter @repo/space-invaders typecheck
```

Expected: PASS.

## Task 10: TDD Renderer Contract

**Files:**

- Create: `packages/space-invaders/src/renderer.ts`
- Create: `packages/space-invaders/src/__tests__/renderer.test.ts`
- Modify: `packages/space-invaders/src/index.ts`

- [ ] **Step 1: Write failing renderer test with fake context**

Create `packages/space-invaders/src/__tests__/renderer.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
pnpm --filter @repo/space-invaders test -- src/__tests__/renderer.test.ts
```

Expected: FAIL because renderer does not exist.

- [ ] **Step 3: Implement renderer**

Create `packages/space-invaders/src/renderer.ts`:

```ts
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
```

Modify `packages/space-invaders/src/index.ts`:

```ts
export * from "./constants";
export { createSpaceInvadersEngine } from "./engine";
export { renderSpaceInvaders } from "./renderer";
export type {
  SpaceInvadersEngine,
  SpaceInvadersEngineOptions,
  SpaceInvadersEngineResetOptions,
  SpaceInvadersInputSnapshot,
  SpaceInvadersShotSlot,
  SpaceInvadersState,
  SpaceInvadersStepOutcome,
} from "./types";
```

- [ ] **Step 4: Run package checks**

Run:

```bash
pnpm --filter @repo/space-invaders test
pnpm --filter @repo/space-invaders typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit Space Invaders package**

Run:

```bash
git add packages/space-invaders packages/game-engine packages/*/package.json pnpm-lock.yaml
git commit -m "feat: add space invaders engine" -- packages/space-invaders packages/game-engine pnpm-lock.yaml
```

Expected: commit includes `packages/space-invaders`, any lockfile updates, and no unrelated app migration changes.

## Task 11: XState Lifecycle Machine In `apps/www`

**Files:**

- Create: `apps/www/src/app/(v2)/(marketing)/_components/footer-arcade-machine.ts`
- Modify: `apps/www/package.json`

- [ ] **Step 1: Add dependencies**

Modify `apps/www/package.json` dependencies:

```json
"@repo/space-invaders": "workspace:*",
"xstate": "catalog:"
```

Keep alphabetical grouping close to existing local packages if practical.

- [ ] **Step 2: Create machine**

Create `apps/www/src/app/(v2)/(marketing)/_components/footer-arcade-machine.ts`:

```ts
import { assign, setup } from "xstate";

interface FooterArcadeContext {
  hasFocus: boolean;
  documentVisible: boolean;
}

type FooterArcadeEvent =
  | { type: "START" }
  | { type: "READY" }
  | { type: "BLUR" }
  | { type: "FOCUS" }
  | { type: "DOCUMENT_HIDDEN" }
  | { type: "DOCUMENT_VISIBLE" }
  | { type: "PLAYER_HIT"; livesRemaining: number }
  | { type: "LIFE_LOST_DELAY_DONE" }
  | { type: "GAME_OVER" }
  | { type: "REPLAY" };

export const footerArcadeMachine = setup({
  types: {
    context: {} as FooterArcadeContext,
    events: {} as FooterArcadeEvent,
  },
  guards: {
    canRun: ({ context }) => context.hasFocus && context.documentVisible,
    canRunAfterFocus: ({ context }) => context.documentVisible,
    canRunAfterVisible: ({ context }) => context.hasFocus,
    hasLivesRemaining: ({ event }) =>
      event.type === "PLAYER_HIT" && event.livesRemaining > 0,
  },
  actions: {
    setFocused: assign({ hasFocus: true }),
    setBlurred: assign({ hasFocus: false }),
    setVisible: assign({ documentVisible: true }),
    setHidden: assign({ documentVisible: false }),
  },
}).createMachine({
  id: "footerArcade",
  initial: "idle",
  context: {
    hasFocus: false,
    documentVisible: true,
  },
  states: {
    idle: {
      on: {
        START: {
          target: "booting",
          actions: "setFocused",
        },
      },
    },
    booting: {
      on: {
        READY: "running",
      },
    },
    running: {
      on: {
        BLUR: {
          target: "paused",
          actions: "setBlurred",
        },
        DOCUMENT_HIDDEN: {
          target: "paused",
          actions: "setHidden",
        },
        PLAYER_HIT: [
          {
            target: "life_lost",
            guard: "hasLivesRemaining",
          },
          {
            target: "game_over",
          },
        ],
        GAME_OVER: "game_over",
      },
    },
    paused: {
      on: {
        FOCUS: [
          {
            target: "running",
            guard: "canRunAfterFocus",
            actions: "setFocused",
          },
          {
            actions: "setFocused",
          },
        ],
        DOCUMENT_VISIBLE: [
          {
            target: "running",
            guard: "canRunAfterVisible",
            actions: "setVisible",
          },
          {
            actions: "setVisible",
          },
        ],
        DOCUMENT_HIDDEN: {
          actions: "setHidden",
        },
        BLUR: {
          actions: "setBlurred",
        },
      },
    },
    life_lost: {
      on: {
        LIFE_LOST_DELAY_DONE: "running",
        GAME_OVER: "game_over",
      },
    },
    game_over: {
      on: {
        REPLAY: {
          target: "booting",
          actions: "setFocused",
        },
      },
    },
  },
});
```

- [ ] **Step 3: Typecheck www**

Run:

```bash
pnpm --filter @lightfast/www typecheck
```

Expected: may fail from unrelated in-progress migration; if it fails, capture whether failures are unrelated to `footer-arcade-machine.ts`.

## Task 12: Footer Arcade Client Component

**Files:**

- Create: `apps/www/src/app/(v2)/(marketing)/_components/footer-arcade.tsx`
- Modify: `apps/www/src/app/(v2)/(marketing)/_components/footer.tsx`

- [ ] **Step 1: Create client component**

Create `apps/www/src/app/(v2)/(marketing)/_components/footer-arcade.tsx`:

```tsx
"use client";

import { Logo } from "@repo/ui-v2/components/brand/logo";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  FIXED_DT_MS,
  MAX_FRAME_DELTA_MS,
  MAX_STEPS_PER_FRAME,
  PLAYER_HIT_DELAY_MS,
  RENDER_SCALE,
  createSpaceInvadersEngine,
  renderSpaceInvaders,
  type SpaceInvadersInputSnapshot,
} from "@repo/space-invaders";
import { createFixedStepAccumulator } from "@repo/game-engine";
import { createActor } from "xstate";
import { useEffect, useMemo, useRef, useState } from "react";
import { footerArcadeMachine } from "./footer-arcade-machine";

const IDLE_INPUT: SpaceInvadersInputSnapshot = {
  moveLeft: false,
  moveRight: false,
  firePressed: false,
};

export function FooterArcade() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pressedKeysRef = useRef(new Set<string>());
  const firePressedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const engineRef = useRef(createSpaceInvadersEngine());
  const accumulatorRef = useRef(
    createFixedStepAccumulator({
      fixedStepMs: FIXED_DT_MS,
      maxFrameDeltaMs: MAX_FRAME_DELTA_MS,
      maxStepsPerFrame: MAX_STEPS_PER_FRAME,
    })
  );
  const actor = useMemo(() => createActor(footerArcadeMachine).start(), []);
  const [stateValue, setStateValue] = useState(actor.getSnapshot().value);

  useEffect(() => {
    const subscription = actor.subscribe((snapshot) => {
      setStateValue(snapshot.value);
    });

    return () => {
      subscription.unsubscribe();
      actor.stop();
    };
  }, [actor]);

  const isIdle = stateValue === "idle";
  const isGameOver = stateValue === "game_over";

  useEffect(() => {
    if (stateValue !== "booting") {
      return;
    }

    wrapperRef.current?.focus();
    actor.send({ type: "READY" });
  }, [actor, stateValue]);

  useEffect(() => {
    if (stateValue !== "life_lost") {
      return;
    }

    const timeout = window.setTimeout(() => {
      accumulatorRef.current.reset();
      actor.send({ type: "LIFE_LOST_DELAY_DONE" });
    }, PLAYER_HIT_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [actor, stateValue]);

  useEffect(() => {
    if (isIdle) {
      return;
    }

    const onVisibilityChange = () => {
      actor.send({
        type:
          document.visibilityState === "visible"
            ? "DOCUMENT_VISIBLE"
            : "DOCUMENT_HIDDEN",
      });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [actor, isIdle]);

  useEffect(() => {
    if (isIdle) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });

    if (!canvas || !ctx) {
      return;
    }

    const frame = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const delta = Math.min(
        timestamp - lastTimestampRef.current,
        MAX_FRAME_DELTA_MS
      );
      lastTimestampRef.current = timestamp;

      if (actor.getSnapshot().value === "running") {
        const result = accumulatorRef.current.advance(delta);

        for (let step = 0; step < result.steps; step += 1) {
          const outcomes = engineRef.current.step(
            readInputSnapshot(pressedKeysRef.current, firePressedRef),
            FIXED_DT_MS
          );

          for (const outcome of outcomes) {
            if (outcome.type === "player_hit") {
              actor.send({
                type: "PLAYER_HIT",
                livesRemaining: outcome.livesRemaining,
              });
            }

            if (outcome.type === "game_over") {
              actor.send({ type: "GAME_OVER" });
            }
          }
        }
      }

      renderSpaceInvaders(ctx, engineRef.current.getRenderState(), {
        gameOver: actor.getSnapshot().value === "game_over",
      });

      frameRef.current = requestAnimationFrame(frame);
    };

    frameRef.current = requestAnimationFrame(frame);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      lastTimestampRef.current = null;
      accumulatorRef.current.reset();
    };
  }, [actor, isIdle]);

  if (isIdle) {
    return (
      <button
        aria-label="Start footer arcade"
        className="cursor-pointer bg-transparent p-0 text-foreground transition-opacity hover:opacity-70 focus-visible:opacity-70 focus-visible:outline-none"
        onClick={() => {
          engineRef.current.reset();
          actor.send({ type: "START" });
        }}
        type="button"
      >
        <Logo size="md" />
      </button>
    );
  }

  return (
    <div
      aria-label="Footer arcade game"
      className="outline-none"
      onBlur={() => {
        pressedKeysRef.current.clear();
        firePressedRef.current = false;
        actor.send({ type: "BLUR" });
      }}
      onClick={() => {
        if (isGameOver) {
          engineRef.current.reset();
          actor.send({ type: "REPLAY" });
        }
      }}
      onFocus={() => actor.send({ type: "FOCUS" })}
      onKeyDown={(event) => {
        if (
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          event.key === " "
        ) {
          event.preventDefault();
        }

        if (event.key === "Enter" && isGameOver) {
          engineRef.current.reset();
          actor.send({ type: "REPLAY" });
          return;
        }

        if (event.key === " " && !event.repeat) {
          firePressedRef.current = true;
        }

        pressedKeysRef.current.add(event.key);
      }}
      onKeyUp={(event) => {
        pressedKeysRef.current.delete(event.key);
      }}
      ref={wrapperRef}
      role="application"
      tabIndex={0}
    >
      <canvas
        className="block bg-black [image-rendering:pixelated]"
        height={BOARD_HEIGHT}
        ref={canvasRef}
        style={{
          width: BOARD_WIDTH * RENDER_SCALE,
          height: BOARD_HEIGHT * RENDER_SCALE,
        }}
        width={BOARD_WIDTH}
      />
    </div>
  );
}

function readInputSnapshot(
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
```

- [ ] **Step 2: Replace footer center logo**

Modify `apps/www/src/app/(v2)/(marketing)/_components/footer.tsx`:

```tsx
import { FooterArcade } from "./footer-arcade";
```

Replace:

```tsx
<Link aria-label="Lightfast home" href="/">
  <Logo
    className="text-foreground transition-opacity hover:opacity-70 focus-visible:opacity-70 focus-visible:outline-none"
    size="md"
  />
</Link>
```

With:

```tsx
<FooterArcade />
```

Remove the now-unused `Logo` import from `footer.tsx` if it is no longer used.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm --filter @lightfast/www typecheck
```

Expected: PASS or only unrelated migration failures. Fix any footer arcade type errors.

## Task 13: Browser Verification And Performance Pass

**Files:**

- Modify: `packages/space-invaders/src/constants.ts` only if numeric tuning is required.
- Modify: `packages/space-invaders/src/engine.ts` only if verification exposes a simulation bug covered by a new failing test.
- Modify: `apps/www/src/app/(v2)/(marketing)/_components/footer-arcade.tsx` only if browser verification exposes lifecycle, focus, or canvas wiring bugs.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @repo/game-engine test
pnpm --filter @repo/space-invaders test
pnpm --filter @repo/game-engine typecheck
pnpm --filter @repo/space-invaders typecheck
```

Expected: PASS.

- [ ] **Step 2: Start dev server**

Run:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Expected: dev server starts and Portless routes are available.

- [ ] **Step 3: Verify in browser**

Open:

```text
https://lightfast.localhost
```

Manual checks:

- Footer shows the Lightfast logo button.
- Click logo replaces it with a `448 x 512` pixelated canvas.
- Canvas receives focus.
- `ArrowLeft`, `ArrowRight`, `A`, `D`, and `Space` work.
- Invaders move, drop, and speed up as they are destroyed.
- Alien shots spawn and can hit the player.
- Lives render bottom-left.
- Game over freezes and click/Enter replays.
- Footer links and newsletter still work.

- [ ] **Step 4: Performance check**

Use browser Performance panel while the game is running.

Expected:

- No React render per animation frame.
- No XState event per animation frame.
- No visible heap growth during steady gameplay.
- Frame rendering remains smooth at full invader count.

- [ ] **Step 5: Tune constants only if needed**

If gameplay feels too slow or too fast, tune only:

```ts
PLAYER_SPEED_PX_PER_SECOND
PLAYER_SHOT_SPEED_PX_PER_SECOND
ALIEN_SHOT_SPEED_PX_PER_SECOND
RACK_INITIAL_STEP_INTERVAL_MS
ALIEN_SHOT_ATTEMPT_INTERVAL_MS
```

Do not add shields, score, saucer, sound, or mobile controls in this implementation pass.

## Task 14: Final Quality Gate

**Files:**

- All files changed by this plan.

- [ ] **Step 1: Run final focused checks**

Run:

```bash
pnpm --filter @repo/game-engine test
pnpm --filter @repo/space-invaders test
pnpm --filter @repo/game-engine typecheck
pnpm --filter @repo/space-invaders typecheck
pnpm --filter @lightfast/www typecheck
```

Expected: package checks PASS. If www typecheck fails from unrelated migration work, record exact unrelated failures and verify no footer arcade errors remain.

- [ ] **Step 2: Inspect changed files**

Run:

```bash
git diff -- packages/game-engine packages/space-invaders apps/www/package.json 'apps/www/src/app/(v2)/(marketing)/_components/footer.tsx' 'apps/www/src/app/(v2)/(marketing)/_components/footer-arcade.tsx' 'apps/www/src/app/(v2)/(marketing)/_components/footer-arcade-machine.ts'
```

Expected: diff only includes planned implementation changes.

- [ ] **Step 3: Commit implementation with explicit pathspecs**

Run:

```bash
git add packages/game-engine packages/space-invaders apps/www/package.json 'apps/www/src/app/(v2)/(marketing)/_components/footer.tsx' 'apps/www/src/app/(v2)/(marketing)/_components/footer-arcade.tsx' 'apps/www/src/app/(v2)/(marketing)/_components/footer-arcade-machine.ts' pnpm-lock.yaml
git commit -m "feat: add footer space invaders arcade" -- packages/game-engine packages/space-invaders apps/www/package.json 'apps/www/src/app/(v2)/(marketing)/_components/footer.tsx' 'apps/www/src/app/(v2)/(marketing)/_components/footer-arcade.tsx' 'apps/www/src/app/(v2)/(marketing)/_components/footer-arcade-machine.ts' pnpm-lock.yaml
```

Expected: commit excludes unrelated app migration changes.
