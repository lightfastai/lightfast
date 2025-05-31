import "~/components/landing/landing-layout.css";

import {
  CenterCard,
  GridLines,
  IntegrationCategories,
} from "~/components/landing";
import { ClientInteractivity } from "~/components/landing/client-interactivity";

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
