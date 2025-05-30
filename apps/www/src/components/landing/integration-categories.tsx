import { cn } from "@repo/ui/lib/utils"; // Import cn utility

import { integrationCategories } from "./constants";
// import { useEffect, useState } from "react"; // No longer needed here
import { getCSSVariableValue } from "./utils";

export const IntegrationCategories = () => {
  // Read grid layout values from CSS custom properties
  // These could also be read once on mount and stored in state if they don't change frequently,
  // or if direct usage in style objects becomes too verbose.
  const gridOffsetX = getCSSVariableValue("--landing-grid-offset-x");
  const gridOffsetY = getCSSVariableValue("--landing-grid-offset-y");
  const gridWidth = getCSSVariableValue("--landing-grid-width");
  const gridHeight = getCSSVariableValue("--landing-grid-height");
  const cellWidth = getCSSVariableValue("--landing-grid-cell-width");
  const cellHeight = getCSSVariableValue("--landing-grid-cell-height");

  // Fallback if CSS variables are not available (e.g. during SSR or if not set)
  // This part is tricky because these values are essential for layout.
  // Ideally, the component should not render or show a loader if these are not available.
  if (cellWidth === 0 || cellHeight === 0) {
    // console.warn("Landing page CSS variables not found, IntegrationCategories might not render correctly.");
    // Depending on how critical this is, you might return null or a placeholder
    return null;
  }

  return (
    <div
      className={cn(
        "absolute transition-all duration-500",
        "integration-categories-container-animated", // Add class for CSS-driven opacity
      )}
      style={{
        left: `${gridOffsetX}px`,
        top: `${gridOffsetY}px`,
        width: `${gridWidth}px`,
        height: `${gridHeight}px`,
        // opacity: expansionPhase > 0.3 ? categoryPhase : 0, // Removed
      }}
    >
      {integrationCategories.map((cat, index) => {
        let cardSpecificStyles: React.CSSProperties = {};
        let cardClasses = "integration-category-card-base"; // Base class

        // Default grid-based position & dimensions (used if no special alignment class applies)
        const defaultCardWidth = cellWidth * cat.grid.colSpan;
        const defaultCardHeight = cellHeight * cat.grid.rowSpan;
        const defaultCardLeft = cellWidth * cat.grid.colStart;
        const defaultCardTop = cellHeight * cat.grid.rowStart;

        cardSpecificStyles = {
          width: `${defaultCardWidth}px`,
          height: `${defaultCardHeight}px`,
          left: `${defaultCardLeft}px`,
          top: `${defaultCardTop}px`,
        };

        // Apply modifier classes for cards that need special alignment
        // These classes will override width/left as needed using their own CSS calc()
        if (cat.name === "2D Graphics") {
          cardClasses = cn(cardClasses, "align-2d-graphics");
          // JS calculated width/left are overridden by CSS, so no need to set them in cardSpecificStyles
          delete cardSpecificStyles.width;
          delete cardSpecificStyles.left;
        } else if (cat.name === "Game Engines") {
          cardClasses = cn(cardClasses, "align-game-engines");
          delete cardSpecificStyles.width;
          delete cardSpecificStyles.left;
        } else if (cat.name === "Video & VFX") {
          cardClasses = cn(cardClasses, "align-video-vfx");
          delete cardSpecificStyles.width;
          delete cardSpecificStyles.left;
        } else if (cat.name === "3D Texturing & CAD") {
          cardClasses = cn(cardClasses, "align-3d-texturing-cad");
          delete cardSpecificStyles.width;
          delete cardSpecificStyles.left;
        }

        // Opacity and transform are now handled by .integration-category-card-base CSS rules
        // cardSpecificStyles.opacity = categoryPhase; // Removed
        // cardSpecificStyles.transform = `scale(${0.8 + categoryPhase * 0.2})`; // Removed
        cardSpecificStyles.transitionDelay = `${index * 50}ms`; // Keep transitionDelay if it's unique per card

        return (
          <div
            key={cat.name}
            className={cn(
              "border-border bg-card/80 hover:bg-card/90 absolute flex items-start justify-start overflow-hidden border p-6 backdrop-blur-sm transition-all duration-700",
              cardClasses,
            )}
            style={cardSpecificStyles}
          >
            <div className="flex flex-col">
              <span className="text-foreground/90 mb-4 text-2xl font-semibold">
                {cat.name}
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-sm">
                  {cat.apps} apps
                </span>
                <div className="flex gap-1">
                  {cat.liveApps > 0 && (
                    <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs">
                      {cat.liveApps} Live
                    </span>
                  )}
                  {cat.plannedApps > 0 && (
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                      {cat.plannedApps} Soon
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
