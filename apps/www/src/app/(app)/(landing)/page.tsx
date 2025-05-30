"use client";

import "../../../components/landing/landing-layout.css";

import {
  CenterCard,
  GridLines,
  IntegrationCategories,
  useLandingCSSVariables,
} from "../../../components/landing";

// PageHeader can be added back if used

export default function Home() {
  useLandingCSSVariables();

  return (
    <div className="bg-background relative h-screen overflow-hidden">
      <GridLines centerCard={{}} />
      <IntegrationCategories centerCard={{}} />
      <CenterCard centerCard={{}} />
      {/* <PageHeader /> */}
    </div>
  );
}
