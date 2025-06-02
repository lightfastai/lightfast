import { cn } from "@repo/ui/lib/utils";

import type { IntegrationCategory } from "../../lib/landing/constants";
import { integrationCategories } from "../../lib/landing/constants";
import { ThreeDModelingCard } from "./cards/3d-modeling-card";
import { DefaultCard } from "./cards/default-card";
import { InteractiveLiveCard } from "./cards/interactive-live-card";
import { VideoVFXCard } from "./cards/video-vfx-card";

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
        // Convert category name to CSS-friendly data attribute
        const categorySlug = cat.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace("&", "");

        return (
          <div
            key={cat.name}
            className={cn(
              "border-border bg-card/80 hover:bg-card/90 absolute flex items-start justify-start overflow-hidden border p-6 backdrop-blur-sm",
              "optimized-integration-card",
              "integration-card",
            )}
            data-category={categorySlug}
            style={
              {
                "--col-start": cat.grid.colStart,
                "--col-span": cat.grid.colSpan,
                "--row-start": cat.grid.rowStart,
                "--row-span": cat.grid.rowSpan,
                "--index": index,
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
