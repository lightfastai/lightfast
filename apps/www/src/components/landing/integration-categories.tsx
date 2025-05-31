import { cn } from "@repo/ui/lib/utils";

import type { IntegrationCategory } from "./constants";
import { ThreeDModelingCard } from "./cards/3d-modeling-card";
import { DefaultCard } from "./cards/default-card";
import { InteractiveLiveCard } from "./cards/interactive-live-card";
import { VideoVFXCard } from "./cards/video-vfx-card";
import { integrationCategories } from "./constants";

// Function to render the appropriate card component
function renderUniqueCard(category: IntegrationCategory) {
  switch (category.name) {
    case "3D Modeling":
      return <ThreeDModelingCard category={category} />;
    case "Video & VFX":
      return <VideoVFXCard category={category} />;
    case "Interactive & Live":
      return <InteractiveLiveCard category={category} />;
    default:
      return <DefaultCard category={category} />;
  }
}

export const IntegrationCategories = () => {
  return (
    <div className="optimized-integration-container">
      {integrationCategories.map((cat, index) => {
        // Determine grid position class based on category and edge positioning
        let positionClass = "integration-card-default";

        // Check for edge positioning based on grid coordinates
        const isLeftEdge = cat.grid.colStart === 0;
        const isRightEdge = cat.grid.colStart + cat.grid.colSpan === 12;
        const isTopEdge = cat.grid.rowStart === 0;
        const isBottomEdge = cat.grid.rowStart + cat.grid.rowSpan === 12;

        // Apply edge classes for cards that touch viewport edges
        if (isLeftEdge && isTopEdge) {
          positionClass =
            "integration-card-edge-left integration-card-edge-top";
        } else if (isLeftEdge && isBottomEdge) {
          positionClass =
            "integration-card-edge-left integration-card-edge-bottom";
        } else if (isRightEdge && isTopEdge) {
          positionClass =
            "integration-card-edge-right integration-card-edge-top";
        } else if (isRightEdge && isBottomEdge) {
          positionClass =
            "integration-card-edge-right integration-card-edge-bottom";
        } else if (isLeftEdge) {
          positionClass = "integration-card-edge-left";
        } else if (isRightEdge) {
          positionClass = "integration-card-edge-right";
        } else if (isTopEdge) {
          positionClass = "integration-card-edge-top";
        } else if (isBottomEdge) {
          positionClass = "integration-card-edge-bottom";
        }

        // Special positioning for cards that align with center card
        if (cat.name === "2D Graphics") {
          positionClass =
            "integration-card-2d-graphics integration-card-edge-top";
        } else if (cat.name === "Game Engines") {
          positionClass =
            "integration-card-game-engines integration-card-edge-bottom";
        } else if (cat.name === "Video & VFX") {
          positionClass =
            "integration-card-video-vfx integration-card-edge-top";
        } else if (cat.name === "3D Texturing & CAD") {
          positionClass =
            "integration-card-3d-texturing integration-card-edge-bottom";
        }

        return (
          <div
            key={cat.name}
            className={cn(
              "border-border bg-card/80 hover:bg-card/90 absolute flex items-start justify-start overflow-hidden border p-6 backdrop-blur-sm",
              "optimized-integration-card",
              positionClass,
            )}
            style={
              {
                transitionDelay: `${index * 50}ms`,
                // Grid positioning via CSS custom properties
                "--grid-col-start": cat.grid.colStart,
                "--grid-col-span": cat.grid.colSpan,
                "--grid-row-start": cat.grid.rowStart,
                "--grid-row-span": cat.grid.rowSpan,
              } as React.CSSProperties
            }
          >
            {renderUniqueCard(cat)}
          </div>
        );
      })}
    </div>
  );
};
