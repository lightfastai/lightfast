// biome-ignore lint/style/useFilenamingConvention: Remotion requires PascalCase entry point

import { Composition, Still } from "@vendor/remotion";
import type React from "react";
import { GitHubBanner } from "./compositions/github-banner";
import { LandingHero } from "./compositions/landing-hero/landing-hero";
import { Logo } from "./compositions/logo";
import { TwitterBanner } from "./compositions/twitter-banner";
import { MANIFEST } from "./manifest";

// Component registry — maps manifest component names to actual React components
const COMPONENTS: Record<string, React.FC<Record<string, unknown>>> = {
  LandingHero,
  Logo,
  TwitterBanner,
  GitHubBanner,
};

export const RemotionRoot = () => {
  return (
    <>
      {Object.entries(MANIFEST.compositions).map(([id, entry]) => {
        const Component = COMPONENTS[entry.component];
        if (!Component) {
          throw new Error(`No component registered for composition "${id}"`);
        }

        if (entry.type === "video") {
          return (
            <Composition
              component={Component}
              durationInFrames={entry.durationInFrames}
              fps={entry.fps}
              height={entry.height}
              id={id}
              key={id}
              width={entry.width}
            />
          );
        }

        return (
          <Still
            component={Component}
            defaultProps={entry.props}
            height={entry.height}
            id={id}
            key={id}
            width={entry.width}
          />
        );
      })}
    </>
  );
};
