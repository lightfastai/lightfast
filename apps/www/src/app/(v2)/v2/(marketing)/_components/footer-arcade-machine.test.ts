import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import { footerArcadeMachine } from "./footer-arcade-machine";

describe("footerArcadeMachine", () => {
  it("runs after start and ready, then pauses and resumes with focus", () => {
    const actor = createActor(footerArcadeMachine).start();

    expect(actor.getSnapshot().value).toBe("idle");

    actor.send({ type: "START" });
    expect(actor.getSnapshot().value).toBe("booting");

    actor.send({ type: "READY" });
    expect(actor.getSnapshot().value).toBe("running");

    actor.send({ type: "BLUR" });
    expect(actor.getSnapshot().value).toBe("paused");

    actor.send({ type: "FOCUS" });
    expect(actor.getSnapshot().value).toBe("running");

    actor.stop();
  });

  it("enters life_lost only when the player still has lives", () => {
    const actor = createActor(footerArcadeMachine).start();

    actor.send({ type: "START" });
    actor.send({ type: "READY" });
    actor.send({ type: "PLAYER_HIT", livesRemaining: 1 });

    expect(actor.getSnapshot().value).toBe("life_lost");

    actor.send({ type: "LIFE_LOST_DELAY_DONE" });
    expect(actor.getSnapshot().value).toBe("running");

    actor.send({ type: "PLAYER_HIT", livesRemaining: 0 });
    expect(actor.getSnapshot().value).toBe("game_over");

    actor.stop();
  });
});
