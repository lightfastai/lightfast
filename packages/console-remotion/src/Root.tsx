import { Composition, Still } from "remotion";
import { LandingHero } from "./compositions/landing-hero/landing-hero";
import { Logo, LOGO_VARIANTS } from "./compositions/logo";
import { TwitterBanner, TWITTER_BANNER_CONFIG } from "./compositions/twitter-banner";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="landing-hero"
        component={LandingHero}
        durationInFrames={301}
        fps={30}
        width={1920}
        height={1280}
      />
      {LOGO_VARIANTS.map((variant) => (
        <Still
          key={variant.id}
          id={variant.id}
          component={Logo}
          width={variant.width}
          height={variant.height}
          defaultProps={variant.props}
        />
      ))}
      <Still
        id={TWITTER_BANNER_CONFIG.id}
        component={TwitterBanner}
        width={TWITTER_BANNER_CONFIG.width}
        height={TWITTER_BANNER_CONFIG.height}
      />
    </>
  );
};
