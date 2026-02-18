import { Composition, Still } from "remotion";
import { LandingHero } from "./compositions/landing-hero/landing-hero";
import { Logo, LOGO_VARIANTS } from "./compositions/logo";

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
    </>
  );
};
