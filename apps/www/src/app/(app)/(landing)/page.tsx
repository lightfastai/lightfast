"use client";

import "../../../components/landing/landing-layout.css";

import {
  calculateCenterCard,
  CenterCard,
  GridLines,
  IntegrationCategories,
  useAnimationPhases,
  useLandingCSSVariables,
  useViewportSize,
  useWheelProgress,
} from "../../../components/landing";

export default function Home() {
  useLandingCSSVariables();
  const viewportSize = useViewportSize();
  const wheelProgress = useWheelProgress();
  const animationPhases = useAnimationPhases(wheelProgress);

  // The gridLayout properties are now available as CSS variables.
  // calculateCenterCard will now use these CSS variables directly.

  const centerCard = calculateCenterCard(animationPhases.expansionPhase);

  return (
    <div className="bg-background relative h-screen overflow-hidden">
      {/* Lines extending from center card corners */}
      <GridLines
        centerCard={centerCard}
        viewportSize={viewportSize} // viewportSize might become CSS vars for GridLines too
        expansionPhase={animationPhases.expansionPhase}
      />

      {/* Integration category cards */}
      {/* gridLayout prop will be removed */}
      <IntegrationCategories
        centerCard={centerCard} // centerCard might also be simplified if its props become CSS vars
        expansionPhase={animationPhases.expansionPhase}
        categoryPhase={animationPhases.categoryPhase}
      />

      {/* The transforming center card */}
      <CenterCard
        centerCard={centerCard}
        textFadePhase={animationPhases.textFadePhase}
        logoMovePhase={animationPhases.logoMovePhase}
      />

      {/* Header that appears */}
      {/* <PageHeader categoryPhase={animationPhases.categoryPhase} /> */}
    </div>
  );
}
