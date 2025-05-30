"use client";

import {
  calculateCenterCard,
  calculateGridLayout,
  CenterCard,
  GridLines,
  IntegrationCategories,
  useAnimationPhases,
  useViewportSize,
  useWheelProgress,
} from "../../../components/landing";

export default function Home() {
  const viewportSize = useViewportSize();
  const wheelProgress = useWheelProgress();
  const animationPhases = useAnimationPhases(wheelProgress);

  // Calculate grid layout
  const gridLayout = calculateGridLayout(
    viewportSize.width,
    viewportSize.height,
  );
  const centerCard = calculateCenterCard(
    gridLayout,
    animationPhases.expansionPhase,
    viewportSize.width,
    viewportSize.height,
  );

  return (
    <div className="bg-background relative h-screen overflow-hidden">
      {/* Lines extending from center card corners */}
      <GridLines
        centerCard={centerCard}
        viewportSize={viewportSize}
        expansionPhase={animationPhases.expansionPhase}
      />

      {/* Integration category cards */}
      <IntegrationCategories
        gridLayout={gridLayout}
        centerCard={centerCard}
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
