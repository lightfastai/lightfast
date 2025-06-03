"use client";

import "~/components/landing/landing.css";

import { BackgroundLines } from "~/components/landing/bg-grid/background-lines";
import { LeaderCard } from "~/components/landing/leader-card";
import { ScrollIndicator } from "~/components/landing/scroll-indicator";
import { useSetupBinaryScrollBehavior } from "~/hooks/use-binary-scroll-state";
import { AnimationProvider } from "~/provider/animation-provider";

export default function Home() {
  useSetupBinaryScrollBehavior();

  return (
    <div className="bg-background landing-ssr relative h-screen overflow-hidden">
      <AnimationProvider />
      <BackgroundLines />
      <LeaderCard />
      <ScrollIndicator />
    </div>
  );
}
