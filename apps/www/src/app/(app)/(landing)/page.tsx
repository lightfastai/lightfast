import "~/components/landing/landing-layout.css";

import { CenterCard } from "~/components/landing/center-card";
import { ClientInteractivity } from "~/components/landing/client-interactivity";
import { GridLines } from "~/components/landing/grid-lines";
import { IntegrationCategories } from "~/components/landing/integration-categories";

export default function Home() {
  return (
    <div className="bg-background landing-ssr relative h-screen overflow-hidden">
      <ClientInteractivity />
      {/* <PageHeader /> */}
      <GridLines />
      <IntegrationCategories />
      <CenterCard />
    </div>
  );
}
