import type { CenterCard } from "./types";
import { integrationCategories } from "./constants";
import { getCSSVariableValue } from "./utils";

export interface IntegrationCategoriesProps {
  centerCard: CenterCard;
  expansionPhase: number;
  categoryPhase: number;
}

export const IntegrationCategories = ({
  centerCard,
  expansionPhase,
  categoryPhase,
}: IntegrationCategoriesProps) => {
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
    // return null;
  }

  return (
    <div
      className="absolute transition-all duration-500"
      style={{
        left: `${gridOffsetX}px`,
        top: `${gridOffsetY}px`,
        width: `${gridWidth}px`,
        height: `${gridHeight}px`,
        opacity: expansionPhase > 0.3 ? categoryPhase : 0,
      }}
    >
      {integrationCategories.map((cat, index) => {
        // Calculate default grid-based position
        let cardWidth = cellWidth * cat.grid.colSpan;
        const cardHeight = cellHeight * cat.grid.rowSpan;
        let cardLeft = cellWidth * cat.grid.colStart;
        const cardTop = cellHeight * cat.grid.rowStart;

        // Adjust positions for cards that should align with center anchor borders
        const centerLeftInGridContext = centerCard.left - gridOffsetX;
        const centerRightInGridContext =
          centerLeftInGridContext + centerCard.width;

        // Cards that need border alignment adjustments
        if (cat.name === "2D Graphics") {
          cardWidth = centerRightInGridContext - cardLeft;
        } else if (cat.name === "Game Engines") {
          cardWidth = centerLeftInGridContext - cardLeft;
        } else if (cat.name === "Video & VFX") {
          const originalRight = cardLeft + cardWidth;
          cardLeft = centerRightInGridContext;
          cardWidth = originalRight - centerRightInGridContext;
        } else if (cat.name === "3D Texturing & CAD") {
          const originalRight = cardLeft + cardWidth;
          cardLeft = centerLeftInGridContext;
          cardWidth = originalRight - centerLeftInGridContext;
        }

        // Ensure cardWidth is not negative or zero if critical
        if (
          cardWidth <= 0 &&
          (cat.name.includes("2D Graphics") ||
            cat.name.includes("Game Engines") ||
            cat.name.includes("Video & VFX") ||
            cat.name.includes("3D Texturing & CAD"))
        ) {
          // This might happen if centerCard values are not yet stable or CSS vars are missing
          // console.warn(`Calculated cardWidth for ${cat.name} is ${cardWidth}px. Check layout logic or CSS variables.`);
        }

        return (
          <div
            key={cat.name}
            className="border-border bg-card/80 hover:bg-card/90 absolute flex items-start justify-start overflow-hidden border p-6 backdrop-blur-sm transition-all duration-700"
            style={{
              width: `${Math.max(0, cardWidth)}px`,
              height: `${Math.max(0, cardHeight)}px`,
              left: `${cardLeft}px`,
              top: `${cardTop}px`,
              opacity: categoryPhase,
              transform: `scale(${0.8 + categoryPhase * 0.2})`,
              transitionDelay: `${index * 50}ms`,
            }}
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
