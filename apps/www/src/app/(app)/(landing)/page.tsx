"use client";

import "../../../components/landing/landing-layout.css";

import {
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
  // calculateCenterCard call is removed as useLandingCSSVariables now handles setting all relevant CSS vars.
  // const centerCard = calculateCenterCard(
  //   animationPhases.expansionPhase,
  // );

  // The centerCard object above is now effectively not providing new info for CSS-driven components.
  // Child components like GridLines will need to be refactored to use CSS variables directly,
  // or we pass them specific CSS variable values if they absolutely need them as props (less ideal).
  // For CenterCard and IntegrationCategories, their main styling is now CSS driven.
  // We need to provide a centerCard object for GridLines, or refactor it.
  // TEMPORARY: For GridLines, we'll pass a minimal object. It needs to be refactored.
  // const centerCardForGridlines: CenterCardType = {
  //   width: typeof window !== 'undefined' ? getCSSVariableValue('--global-cc-current-width') : 0,
  //   height: typeof window !== 'undefined' ? getCSSVariableValue('--global-cc-current-height') : 0,
  //   left: typeof window !== 'undefined' ? getCSSVariableValue('--global-cc-current-left') : 0,
  //   top: typeof window !== 'undefined' ? getCSSVariableValue('--global-cc-current-top') : 0,
  //   size: typeof window !== 'undefined' ? getCSSVariableValue('--global-cc-current-width') : 0,
  //   centerX: typeof window !== 'undefined' ? getCSSVariableValue('--global-cc-current-center-x') : 0,
  //   centerY: typeof window !== 'undefined' ? getCSSVariableValue('--global-cc-current-center-y') : 0,
  //   gridCenterX: typeof window !== 'undefined' ? getCSSVariableValue('--landing-center-card-final-x-grid-val') :0,
  //   gridCenterY: typeof window !== 'undefined' ? getCSSVariableValue('--landing-center-card-final-y-grid-val') :0,
  // };

  return (
    <div className="bg-background relative h-screen overflow-hidden">
      {/* Lines extending from center card corners */}
      <GridLines
        centerCard={{}} // Pass empty object, GridLines now uses CSS variables for center card position
        viewportSize={viewportSize}
        expansionPhase={animationPhases.expansionPhase}
      />

      {/* Integration category cards */}
      <IntegrationCategories
        centerCard={{}} // Pass empty object, as it reads from CSS vars for special alignment.
        expansionPhase={animationPhases.expansionPhase}
        categoryPhase={animationPhases.categoryPhase}
      />

      {/* The transforming center card */}
      <CenterCard
        centerCard={{}} // Pass empty object, it reads its dimensions from CSS.
        textFadePhase={animationPhases.textFadePhase}
        logoMovePhase={animationPhases.logoMovePhase}
      />

      {/* Header that appears */}
      {/* <PageHeader categoryPhase={animationPhases.categoryPhase} /> */}
    </div>
  );
}
