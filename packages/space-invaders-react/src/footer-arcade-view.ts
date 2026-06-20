export type FooterArcadeView = "logo" | "game";

export function getFooterArcadeView(stateValue: unknown): FooterArcadeView {
  return stateValue === "idle" ? "logo" : "game";
}
