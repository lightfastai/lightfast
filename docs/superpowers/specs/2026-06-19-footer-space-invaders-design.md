# Footer Space Invaders Design

Date: 2026-06-19
Status: Ready for user review
Area: `apps/www` v2 marketing footer

## Summary

Replace the large centered logo slot in the v2 marketing footer with a native-ratio Space Invaders-style mini game after the user clicks the Lightfast logo. The first implementation should prioritize correct core game logic over final art polish.

The approved v1 is a desktop-only, isolated canvas game. It uses simple white blobs, native arcade geometry, keyboard controls, alien shots, lives, and wave reset. It does not include shields, saucer, score HUD, visible control labels, sound, mobile controls, or final sprite art.

## Current Shape

The footer lives in:

- `apps/www/src/app/(v2)/v2/(marketing)/_components/footer.tsx`

The current center slot is:

```tsx
<Link aria-label="Lightfast home" href="/v2">
  <Logo
    className="text-foreground transition-opacity hover:opacity-70 focus-visible:opacity-70 focus-visible:outline-none"
    size="md"
  />
</Link>
```

The footer itself is a server component. The game should be introduced through a small client component mounted in this center slot, leaving the rest of the footer server-rendered.

## Research Anchors

The game should feel closer to the Arcade Archives / original TAITO presentation than a generic wide shooter.

References used for the design:

- Arcade Archives SPACE INVADERS page: `https://www.arcadearchives.com/en/title/aca-392/`
- Computer Archeology Space Invaders hardware notes: `https://www.computerarcheology.com/Arcade/SpaceInvaders/Hardware.html`
- Computer Archeology Space Invaders code notes: `https://www.computerarcheology.com/Arcade/SpaceInvaders/Code.html`
- Midway Space Invaders parts catalog, October 1978: `https://arcarc.xmission.com/PDF_Arcade_Bally_Midway/Space_Invaders_Parts_Catalog_%28Oct_1978%29.pdf`

Important research outcomes:

- The player-facing arcade viewport is effectively `224 x 256` logical pixels.
- The Arcade Archives title image is `672 x 768`, which preserves the same `7:8` aspect ratio at `3x`.
- The invader rack is `5 x 11`.
- Each invader occupies a regular `16 x 16` logical cell in the original rack math.
- The original has shields, saucer, score, lives, and several alien shot behaviors, but v1 intentionally implements only the core playable loop.

## Goals

- Use a native `224 x 256` logical game board.
- Render at `448 x 512` on desktop using crisp pixel scaling.
- Start the game by clicking the Lightfast logo in the footer center slot.
- Fully replace the logo slot with the game after start.
- Keep gameplay isolated to the footer center slot, not full width.
- Implement the core arcade loop with simple blobs.
- Keep game logic pure and testable outside React.
- Avoid changing footer navigation, newsletter, and legal-link behavior outside the center logo slot.

## Non-Goals

- Do not add shields in v1.
- Do not add saucer behavior in v1.
- Do not add score, top HUD, or visible control labels in v1.
- Do not add sound in v1.
- Do not add mobile or touch controls in v1.
- Do not use exact Space Invaders sprites or copyrighted game art in v1.
- Do not make the footer logo a home link in this slot after the game component is introduced.
- Do not redesign the full footer around the game yet.

## User Experience

### Idle State

The center footer slot initially displays the existing Lightfast logo as a button. It is not a navigation link.

Required behavior:

- Button label: "Start footer arcade" or equivalent accessible name.
- Visual appearance should match the current logo placement closely.
- Hover and focus treatments can reuse the current opacity behavior.
- Click starts the game and replaces the logo with the canvas.

### Running State

After click:

- Render a canvas with logical size `224 x 256`.
- Style the canvas at `448 x 512` on desktop.
- Use `image-rendering: pixelated`.
- Move keyboard focus into the game container or canvas.
- The game starts immediately after focus is established.

### Life Loss

When the player is hit:

- Decrement lives.
- Clear active player and alien shots.
- Reset the player to the horizontal center.
- Keep remaining invaders and fleet position.
- Resume after a `600ms` fixed delay.

### Wave Clear

When all invaders are destroyed:

- Increment wave count internally.
- Rebuild the `5 x 11` rack.
- Start the new rack `8` logical pixels lower per wave, clamped after `4` downward offsets.
- Apply a small rack speed bonus per wave, clamped by the minimum step interval.
- Keep remaining lives.

### Game Over

Game ends when:

- Lives reach zero.
- Any live invader reaches the player danger zone.

V1 game-over handling:

- Stop the simulation.
- Leave the final canvas state visible.
- Allow click or `Enter` on the focused game area to reset and replay.
- Do not add a polished game-over overlay yet. A tiny in-canvas blob/text marker is acceptable if needed for clarity.

## Geometry

### Board

```ts
const BOARD_WIDTH = 224;
const BOARD_HEIGHT = 256;
const RENDER_SCALE = 2;
```

Canvas attributes:

```tsx
<canvas width={224} height={256} />
```

CSS size:

```css
width: 448px;
height: 512px;
image-rendering: pixelated;
```

The footer layout may constrain the slot with a wrapper, but it should not stretch the canvas non-uniformly.

### Initial Entity Sizes

Use blob hitboxes first. These can later be replaced by sprite masks without changing the game loop.

```ts
type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
```

Initial constants:

- Invader rack: `11` columns, `5` rows.
- Invader cell: `16 x 16`.
- Invader blob: `12 x 8`, centered inside its cell.
- Player blob: `16 x 8`.
- Player y: `232`.
- Player x start: centered.
- Player shot: `1 x 4`.
- Alien shot: `2 x 6`.
- Bottom lives glyphs: tiny player blobs at bottom-left, separate from collision state.

### Initial Positions

Rack:

- Start x: `24`.
- Start y: `72`.
- Column spacing: `16`.
- Row spacing: `16`.
- Rack width: `11 * 16 = 176`.
- Rack height: `5 * 16 = 80`.

This leaves top breathing room without requiring a score HUD and gives enough bottom runway for shots and player danger.

Player:

- Start x: `(BOARD_WIDTH - PLAYER_WIDTH) / 2`.
- Clamp x to `[8, BOARD_WIDTH - PLAYER_WIDTH - 8]`.
- y remains fixed at `232`.

Danger zone:

- If the bottom of any live invader reaches `PLAYER_Y - 8`, the game ends.

## Game State

Keep the core state independent of React.

```ts
type GamePhase =
  | "idle"
  | "running"
  | "life_lost"
  | "game_over";

type Direction = -1 | 1;

type Invader = {
  id: string;
  row: number;
  col: number;
  alive: boolean;
};

type Shot = {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
};

type GameState = {
  phase: GamePhase;
  lives: number;
  wave: number;
  elapsedMs: number;
  playerX: number;
  playerShot: Shot | null;
  alienShots: Shot[];
  invaders: Invader[];
  rackX: number;
  rackY: number;
  rackDirection: Direction;
  rackStepAccumulatorMs: number;
  alienShotAccumulatorMs: number;
  lifeLostRemainingMs: number;
};
```

The concrete implementation can refine names, but the boundaries should stay:

- Pure state factory: create initial game state.
- Pure update function: takes state, input snapshot, elapsed time, returns next state.
- Pure collision helpers.
- Canvas renderer: reads state and draws blobs.
- React component: owns focus, input listeners, animation frame, and canvas lifecycle.

## Input Model

Desktop v1 only:

- `ArrowLeft` and `A`: move left.
- `ArrowRight` and `D`: move right.
- `Space`: fire.
- Click on idle logo starts the game.
- Click or `Enter` after game over restarts.

Input rules:

- The game captures keys only while the game area has focus.
- Prevent default page scroll for `Space`, `ArrowLeft`, and `ArrowRight` only while focused.
- The player may hold movement keys.
- Firing is edge-triggered or repeat-limited so holding `Space` does not spawn repeated shots beyond the one-shot constraint.

Pause rules:

- Pause simulation on blur.
- Pause simulation when `document.visibilityState !== "visible"`.
- Resume when focused and visible.

## Movement And Timing

Use a fixed-step simulation inside `requestAnimationFrame`.

Recommended first-pass step:

```ts
const STEP_MS = 1000 / 60;
```

The game can accumulate elapsed frame time and process one or more fixed updates per frame, with a cap to avoid large catch-up jumps after tab suspension.

### Player Movement

Initial tuning:

- Player speed: `72` logical px/s.
- Clamp to board bounds.

### Player Shot

Rules:

- Only one active player shot.
- Fire from the horizontal center of the player blob.
- Shot velocity: `-140` logical px/s.
- Remove if it exits the top.
- On invader collision, remove the shot and mark that invader dead.
- If multiple invaders overlap due to a large frame step, kill only the closest hit in the shot's travel direction.

### Rack Movement

The invader rack moves as one formation.

Initial tuning:

- Horizontal step size: `2` logical px.
- Down step size: `8` logical px.
- Initial step interval: `500ms`.
- Minimum step interval: `80ms`.

Speed formula:

- Count live invaders.
- Interpolate step interval from `500ms` at 55 live invaders to `80ms` at 1 live invader.
- Subtract `20ms * (wave - 1)` as the wave bonus, clamped to the minimum.

Edge behavior:

- Before each horizontal step, compute the live rack bounds.
- If the next step would cross left or right board padding, reverse direction and move down by `8`.
- Otherwise, move horizontally by `rackDirection * 2`.

Board padding:

- Left padding: `8`.
- Right padding: `8`.

### Alien Shots

V1 uses one simple alien shot type.

Rules:

- Maximum active alien shots: `1` for all of v1.
- Spawn from the lowest live invader in a selected column.
- Select a column near the player's current x most of the time.
- Occasionally select a random live column to keep movement from becoming solved.
- Shot velocity: `48` logical px/s.
- Remove when it exits the bottom.
- On player collision, remove all shots and enter `life_lost` or `game_over`.

Initial spawn cadence:

- Attempt every `900ms`.
- Only spawn if below the active-shot cap.
- If the biased column has no live invader, choose the nearest live column.

Bias:

- `70%` nearest column to player center.
- `30%` random live column.

Use a deterministic random source if tests need repeatability.

## Collision

Use axis-aligned rectangle overlap for v1.

Collision targets:

- Player shot vs live invaders.
- Alien shots vs player.
- Invader bounds vs player danger zone.

No shield collision in v1.

Collision helpers should be pure functions. Do not mix collision logic with canvas drawing.

## Rendering

Render simple blobs in white or muted white on black.

Renderer responsibilities:

- Clear canvas.
- Draw live invaders as row-distinct blob shapes or rectangles.
- Draw player.
- Draw active shots.
- Draw remaining lives as tiny base glyphs at bottom-left.
- Optionally draw a tiny game-over or replay marker after game over.

Avoid exact Space Invaders sprite copying in v1. Blobs should communicate behavior, not final identity.

Rendering should happen from state only. The renderer should not mutate gameplay.

## Accessibility

The idle logo button must be keyboard reachable.

Required labels:

- Idle button accessible name: "Start footer arcade".
- Canvas or wrapper label after start: "Footer arcade game".

Keyboard behavior:

- Starting from the button should move focus to the game.
- `Escape` may blur the game container if easy, but is not required for v1.
- The footer links above and below must remain reachable through normal tab order.

Reduced motion:

- If `prefers-reduced-motion: reduce`, keep the idle logo and do not auto-start.
- Because the game starts only after click, v1 may still allow the user to play after explicit activation.

## File Boundaries

Suggested first implementation shape:

```text
apps/www/src/app/(v2)/v2/(marketing)/_components/footer.tsx
apps/www/src/app/(v2)/v2/(marketing)/_components/footer-arcade.tsx
apps/www/src/app/(v2)/v2/(marketing)/_components/footer-arcade-engine.ts
apps/www/src/app/(v2)/v2/(marketing)/_components/footer-arcade-renderer.ts
```

Responsibilities:

- `footer.tsx`: replaces the center link/logo with the arcade client component.
- `footer-arcade.tsx`: client component, focus management, canvas ref, input, RAF loop.
- `footer-arcade-engine.ts`: pure state, update, collision, constants.
- `footer-arcade-renderer.ts`: canvas drawing from state.

The implementation can choose fewer files if the code remains small, but engine logic should stay independent enough to test without React.

## Testing

Focused tests should cover pure engine behavior:

- Initial state creates 55 live invaders.
- Player movement clamps to board bounds.
- Player cannot create a second shot while one is active.
- Player shot kills one invader and clears the shot.
- Rack reverses and drops at edges.
- Rack speed increases as invaders die.
- Alien shot spawns from the lowest live invader in the selected column.
- Alien shot collision decrements lives and clears shots.
- Game over when lives reach zero.
- Game over when invaders reach the danger zone.
- Wave reset rebuilds the rack and preserves lives.

Manual/browser verification:

- Footer still lays out correctly on desktop.
- Idle logo button starts the game.
- Canvas renders at `448 x 512` without blurring.
- Keyboard controls work only after focus.
- Footer links and newsletter still work.

## Open Follow-Up After V1

Potential follow-ups, intentionally deferred:

- Add destructible shields.
- Add mystery saucer.
- Add score and high score.
- Add final Lightfast-native sprite art.
- Add color mode inspired by the Arcade Archives color version.
- Add sound with an explicit mute/default-off model.
- Add touch controls or mobile fallback.
- Add a tiny replay overlay.
- Restore a separate home link near the logo slot if losing the center logo link feels wrong.
