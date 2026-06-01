import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useState } from "react";
import { ensureFontsLoaded } from "../../landing-hero/shared/fonts";
import { IsoFigure, type IsoScene } from "./iso-figure";

const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

/**
 * Page-wide empty state: left-aligned isometric figure + copy block.
 * Everything sits on bg-background; chrome borders use border/50; the only
 * high-contrast element is the figure's foreground outline.
 */
export const EmptyStateLayout: React.FC<{
  actions: React.ReactNode;
  body: string;
  fig: string;
  scene: IsoScene;
  title: string;
}> = ({ actions, body, fig, scene, title }) => {
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);

  return (
    <AbsoluteFill
      className="bg-background"
      style={{ fontFamily: "Geist, ui-sans-serif, sans-serif" }}
    >
      <div
        className="flex h-full w-full items-center"
        style={{ paddingLeft: 150, gap: 48 }}
      >
        <div style={{ flex: "none", width: 264 }}>
          <IsoFigure scene={scene} width={264} />
        </div>
        <div style={{ maxWidth: 380 }}>
          <div
            className="text-muted-foreground"
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            {fig}
          </div>
          <div
            className="text-foreground"
            style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}
          >
            {title}
          </div>
          <div
            className="text-muted-foreground"
            style={{ fontSize: 14, lineHeight: 1.55 }}
          >
            {body}
          </div>
          <div className="flex" style={{ gap: 10, marginTop: 26 }}>
            {actions}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Btn: React.FC<{
  children: React.ReactNode;
  kbd?: string;
  primary?: boolean;
}> = ({ children, kbd, primary }) => (
  <div
    className={`flex items-center border border-border/50 bg-background ${
      primary ? "text-foreground" : "text-muted-foreground"
    }`}
    style={{
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 500,
      gap: 8,
      height: 32,
      padding: "0 12px",
    }}
  >
    <span>{children}</span>
    {kbd ? (
      <span
        className="flex items-center justify-center border border-border/50 bg-background text-muted-foreground"
        style={{
          borderRadius: 5,
          fontFamily: MONO,
          fontSize: 11,
          height: 18,
          minWidth: 18,
        }}
      >
        {kbd}
      </span>
    ) : null}
  </div>
);
