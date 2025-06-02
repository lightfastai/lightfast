import "~/components/landing/landing-layout.css";

import { CenterCard } from "~/components/landing/center-card";
import { ClientInteractivity } from "~/components/landing/client-interactivity";
import { GridLines } from "~/components/landing/grid-lines";
import { IntegrationCategories } from "~/components/landing/integration-categories";
import { LandingPhaseProvider } from "~/components/landing/landing-phase-provider";

export default function Home() {
  return (
    <LandingPhaseProvider>
      <div className="bg-background landing-ssr relative h-screen overflow-hidden">
        <ClientInteractivity />
        {/* <PageHeader /> */}
        <GridLines />
        <IntegrationCategories />
        <CenterCard />
      </div>
    </LandingPhaseProvider>
  );
}
