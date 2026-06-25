// biome-ignore lint/style/useFilenamingConvention: Remotion requires PascalCase entry point

import { Composition, Still } from "@vendor/remotion";
import type React from "react";
import { BlogFeaturedBase } from "./compositions/blog-featured-base";
import { BlogFeaturedConcentric } from "./compositions/blog-featured-concentric";
import { BlogFeaturedCross } from "./compositions/blog-featured-cross";
import { BlogFeaturedDuo } from "./compositions/blog-featured-duo";
import { BlogFeaturedGhost } from "./compositions/blog-featured-ghost";
import { BlogFeaturedLissajous } from "./compositions/blog-featured-lissajous";
import { BlogFeaturedRule } from "./compositions/blog-featured-rule";
import { BlogFeaturedTrail } from "./compositions/blog-featured-trail";
import { BlogWhyWeBuiltFeatured } from "./compositions/blog-why-we-built-featured";
import {
  BrandPartnershipClearspaceDark,
  LogoSquareClearspaceDark,
} from "./compositions/brand-clearspace-dark";
import { BrandGeometry } from "./compositions/brand-geometry";
import { ChangelogV010Events } from "./compositions/changelog-v010-events";
import { ChangelogV010Featured } from "./compositions/changelog-v010-featured";
import { ChangelogV010SdkMcp } from "./compositions/changelog-v010-sdk-mcp";
import { ChangelogV010Sources } from "./compositions/changelog-v010-sources";
import { PeopleEmpty, SignalsEmpty } from "./compositions/empty-states";
import { GitHubBanner } from "./compositions/github-banner";
import { LandingHero } from "./compositions/landing-hero/landing-hero";
import { LinkedInBanner } from "./compositions/linkedin-banner";
import { LockupSpacingDotPitchIsolation } from "./compositions/lockup-spacing-dot-pitch-isolation";
import { Logo } from "./compositions/logo";
import { MarketingPanelRender } from "./compositions/marketing-panel";
import { TwitterBanner } from "./compositions/twitter-banner";
import { MANIFEST } from "./manifest";

type CompositionComponent = React.FC<Record<string, unknown>>;

const withDarkTheme = (
  Component: CompositionComponent
): CompositionComponent => {
  const DarkThemedComposition: CompositionComponent = (props) => (
    <div className="dark" style={{ height: "100%", width: "100%" }}>
      <Component {...props} />
    </div>
  );

  DarkThemedComposition.displayName = `DarkThemed(${
    Component.displayName ?? Component.name ?? "Composition"
  })`;

  return DarkThemedComposition;
};

// Component registry — maps manifest component names to actual React components
const COMPONENTS: Record<string, CompositionComponent> = {
  BlogFeaturedBase,
  BlogFeaturedConcentric,
  BlogFeaturedCross,
  BlogFeaturedDuo,
  BlogFeaturedGhost,
  BlogFeaturedLissajous,
  BlogFeaturedRule,
  BlogFeaturedTrail,
  BlogWhyWeBuiltFeatured,
  BrandPartnershipClearspaceDark,
  BrandGeometry,
  ChangelogV010Events,
  ChangelogV010Featured,
  ChangelogV010SdkMcp,
  ChangelogV010Sources,
  LandingHero,
  LogoSquareClearspaceDark,
  LockupSpacingDotPitchIsolation,
  Logo,
  TwitterBanner,
  GitHubBanner,
  LinkedInBanner,
  SignalsEmpty,
  PeopleEmpty,
  MarketingPanelRender,
};

const DARK_COMPONENTS = Object.fromEntries(
  Object.entries(COMPONENTS).map(([name, Component]) => [
    name,
    withDarkTheme(Component),
  ])
) as Record<string, CompositionComponent>;

export const RemotionRoot = () => (
  <>
    {Object.entries(MANIFEST.compositions).map(([id, entry]) => {
      const Component = DARK_COMPONENTS[entry.component];
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
