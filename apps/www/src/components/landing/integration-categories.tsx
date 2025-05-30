import { cn } from "@repo/ui/lib/utils";

import { integrationCategories } from "./constants";

export const IntegrationCategories = () => {
  return (
    <div className="optimized-integration-container">
      {integrationCategories.map((cat, index) => {
        // Determine grid position class based on category
        let positionClass = "integration-card-default";

        if (cat.name === "2D Graphics") {
          positionClass = "integration-card-2d-graphics";
        } else if (cat.name === "Game Engines") {
          positionClass = "integration-card-game-engines";
        } else if (cat.name === "Video & VFX") {
          positionClass = "integration-card-video-vfx";
        } else if (cat.name === "3D Texturing & CAD") {
          positionClass = "integration-card-3d-texturing";
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
