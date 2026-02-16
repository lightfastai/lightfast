import { Composition } from "remotion";
import { LandingHero } from "./compositions/landing-hero/LandingHero";

export const RemotionRoot = () => {
  return (
    <Composition
      id="LandingHero"
      component={LandingHero}
      durationInFrames={150}
      fps={30}
      width={1200}
      height={800}
    />
  );
};
