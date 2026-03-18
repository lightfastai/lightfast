// biome-ignore lint/style/useFilenamingConvention: Remotion requires PascalCase entry point
import { Composition, Still } from "remotion";
import {
  GITHUB_BANNER_CONFIG,
  GitHubBanner,
} from "./compositions/github-banner";
import { LandingHero } from "./compositions/landing-hero/landing-hero";
import { LOGO_VARIANTS, Logo } from "./compositions/logo";
import {
  TWITTER_BANNER_CONFIG,
  TwitterBanner,
} from "./compositions/twitter-banner";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        component={LandingHero}
        durationInFrames={301}
        fps={30}
        height={1280}
        id="landing-hero"
        width={1920}
      />
      {LOGO_VARIANTS.map((variant) => (
        <Still
          component={Logo}
          defaultProps={variant.props}
          height={variant.height}
          id={variant.id}
          key={variant.id}
          width={variant.width}
        />
      ))}
      <Still
        component={TwitterBanner}
        height={TWITTER_BANNER_CONFIG.height}
        id={TWITTER_BANNER_CONFIG.id}
        width={TWITTER_BANNER_CONFIG.width}
      />
      <Still
        component={GitHubBanner}
        height={GITHUB_BANNER_CONFIG.height}
        id={GITHUB_BANNER_CONFIG.id}
        width={GITHUB_BANNER_CONFIG.width}
      />
    </>
  );
};
