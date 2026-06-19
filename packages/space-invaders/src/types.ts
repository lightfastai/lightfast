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
