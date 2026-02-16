import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import type { SlideVariant } from "./title-slide-content";
import { ContentSlideContent } from "./content-slide-content";
import { CustomTitleSlide } from "./custom-title-slide";
import { CustomClosingSlide } from "./custom-closing-slide";
import { ShowcaseSlideContent } from "./showcase-slide-content";
import { ColumnsSlideContent } from "./columns-slide-content";

type Slide = (typeof PITCH_SLIDES)[number];

/**
 * Resolves a slide data object to its corresponding React component.
 * Used by both the interactive pitch deck and the PDF capture renderer.
 */
export function resolveSlideComponent(
  slide: Slide,
  variant: SlideVariant,
): React.ReactElement | null {
  if (slide.type === "title") {
    if (slide.id === "title") {
      return <CustomTitleSlide slide={slide} variant={variant} />;
    }
    return <CustomClosingSlide slide={slide} variant={variant} />;
  }
  switch (slide.type) {
    case "content":
      return <ContentSlideContent slide={slide} variant={variant} />;
    case "showcase":
      return <ShowcaseSlideContent slide={slide} variant={variant} />;
    case "columns":
      return <ColumnsSlideContent slide={slide} variant={variant} />;
    default:
      return null;
  }
}
