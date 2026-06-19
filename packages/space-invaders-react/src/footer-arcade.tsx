"use client";

import { createFixedStepAccumulator } from "@repo/game-engine";
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
} from "@repo/space-invaders";
import { useEffect, useMemo, useRef, useState } from "react";
import { createActor } from "xstate";
import { readFooterArcadeInputSnapshot } from "./footer-arcade-input";
import { footerArcadeMachine } from "./footer-arcade-machine";

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });

    if (!ctx) {
      return;
    }

    renderSpaceInvaders(ctx, engineRef.current.getRenderState(), {
      gameOver: actor.getSnapshot().value === "game_over",
    });
  }, [actor, stateValue]);

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
    if (stateValue === "idle") {
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
  }, [actor, stateValue]);

  useEffect(() => {
    if (stateValue !== "running") {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });

    if (!ctx) {
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

      const result = accumulatorRef.current.advance(delta);

      for (let step = 0; step < result.steps; step += 1) {
        const outcomes = engineRef.current.step(
          readFooterArcadeInputSnapshot(
            pressedKeysRef.current,
            firePressedRef
          ),
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

        if (actor.getSnapshot().value !== "running") {
          break;
        }
      }

      renderSpaceInvaders(ctx, engineRef.current.getRenderState(), {
        gameOver: actor.getSnapshot().value === "game_over",
      });

      if (actor.getSnapshot().value === "running") {
        frameRef.current = requestAnimationFrame(frame);
      }
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
  }, [actor, stateValue]);

  const startOrReplay = () => {
    const current = actor.getSnapshot().value;

    if (current !== "idle" && current !== "game_over") {
      return;
    }

    pressedKeysRef.current.clear();
    firePressedRef.current = false;
    accumulatorRef.current.reset();
    lastTimestampRef.current = null;
    engineRef.current.reset();
    actor.send({ type: current === "game_over" ? "REPLAY" : "START" });
  };

  return (
    <div
      aria-label="Footer arcade game"
      className="cursor-crosshair outline-none"
      onBlur={() => {
        pressedKeysRef.current.clear();
        firePressedRef.current = false;
        actor.send({ type: "BLUR" });
      }}
      onClick={startOrReplay}
      onFocus={() => {
        const current = actor.getSnapshot().value;

        if (current === "idle") {
          startOrReplay();
          return;
        }

        actor.send({ type: "FOCUS" });
      }}
      onKeyDown={(event) => {
        if (
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          event.key === " "
        ) {
          event.preventDefault();
        }

        if (event.key === "Enter") {
          startOrReplay();
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
      onPointerDown={() => {
        wrapperRef.current?.focus();
      }}
      ref={wrapperRef}
      role="application"
      style={{
        width: BOARD_WIDTH * RENDER_SCALE,
        maxWidth: "calc(100vw - 3rem)",
      }}
      tabIndex={0}
    >
      <canvas
        className="block h-auto w-full bg-black [image-rendering:pixelated]"
        height={BOARD_HEIGHT}
        ref={canvasRef}
        width={BOARD_WIDTH}
      />
    </div>
  );
}
