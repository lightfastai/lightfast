import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";

const CARD_WIDTH = 880;
const CARD_HEIGHT = 140;

export const ChangelogV010SdkMcp: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  return (
    <AbsoluteFill className="bg-card">
      <div
        className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center rounded-md border border-border px-8 font-mono text-xl"
        style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      >
        <span className="text-foreground">claude mcp add</span>
        <span className="text-muted-foreground">
          &nbsp;--transport stdio lightfast npx -y @lightfastai/mcp
        </span>
      </div>
    </AbsoluteFill>
  );
};
