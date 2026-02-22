import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import type { SlideVariant } from "./title-slide-content";
import { ContentSlideContent } from "./content-slide-content";
import { CustomTitleSlide } from "./custom-title-slide";
import { CustomWhyNowSlide } from "./custom-why-now-slide";
import { CustomTeamSlide } from "./custom-team-slide";
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
  switch (slide.type) {
    case "title":
      return <CustomTitleSlide slide={slide} variant={variant} />;
    case "why-now":
      return <CustomWhyNowSlide slide={slide} variant={variant} />;
    case "content":
      return <ContentSlideContent slide={slide} variant={variant} />;
    case "showcase":
      return <ShowcaseSlideContent slide={slide} variant={variant} />;
    case "columns":
      return <ColumnsSlideContent slide={slide} variant={variant} />;
    case "team":
      return <CustomTeamSlide slide={slide} variant={variant} />;
    default:
      return null;
  }
}
