"use client";

import "../../../components/landing/landing-layout.css";

import {
  CenterCard,
  GridLines,
  IntegrationCategories,
  useLandingCSSVariables,
} from "../../../components/landing";

export default function Home() {
  useLandingCSSVariables(); // This hook now handles all phase calculations and CSS variable setting internally
  return (
    <div className="bg-background relative h-screen overflow-hidden">
      <GridLines />
      <IntegrationCategories />
      <CenterCard />
    </div>
  );
}
