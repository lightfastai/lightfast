import { Composition } from "remotion";
import { LandingHero } from "./compositions/landing-hero/LandingHero";

export const RemotionRoot = () => {
  return (
    <Composition
      id="LandingHero"
      component={LandingHero}
      durationInFrames={301}
      fps={30}
      width={1920}
      height={1280}
    />
  );
};
