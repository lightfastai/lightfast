import { describe, expect, it } from "vitest";
import { getFooterArcadeView } from "./footer-arcade-view";

describe("getFooterArcadeView", () => {
  it("shows the logo before the game starts", () => {
    expect(getFooterArcadeView("idle")).toBe("logo");
  });

  it("shows the game after the logo starts the arcade", () => {
    expect(getFooterArcadeView("booting")).toBe("game");
    expect(getFooterArcadeView("running")).toBe("game");
    expect(getFooterArcadeView("paused")).toBe("game");
    expect(getFooterArcadeView("life_lost")).toBe("game");
    expect(getFooterArcadeView("game_over")).toBe("game");
  });
});
