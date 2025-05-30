import type { GridLayout } from "./types";
import { integrationCategories } from "./constants";

export interface IntegrationCategoriesProps {
  gridLayout: GridLayout;
  expansionPhase: number;
  categoryPhase: number;
}

export const IntegrationCategories = ({
  gridLayout,
  expansionPhase,
  categoryPhase,
}: IntegrationCategoriesProps) => {
  return (
    <div
      className="absolute transition-all duration-500"
      style={{
        left: `${gridLayout.gridOffsetX}px`,
        top: `${gridLayout.gridOffsetY}px`,
        width: `${gridLayout.gridWidth}px`,
        height: `${gridLayout.gridHeight}px`,
        opacity: expansionPhase > 0.3 ? categoryPhase : 0,
      }}
    >
      {integrationCategories.map((cat, index) => {
        const cardWidth = gridLayout.cellWidth * cat.grid.colSpan;
        const cardHeight = gridLayout.cellHeight * cat.grid.rowSpan;
        const cardLeft = gridLayout.cellWidth * cat.grid.colStart;
        const cardTop = gridLayout.cellHeight * cat.grid.rowStart;

        return (
          <div
            key={cat.name}
            className="border-border bg-card/80 hover:bg-card/90 absolute flex items-start justify-start overflow-hidden border p-6 backdrop-blur-sm transition-all duration-700"
            style={{
              width: `${cardWidth}px`,
              height: `${cardHeight}px`,
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
