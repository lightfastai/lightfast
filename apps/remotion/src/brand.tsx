import {
  DOT_MATRIX_PATH,
  getLogoMetrics,
  LOGO_DOT_PITCH,
  LOGO_MARK_VIEWBOX_SIZE,
  WORDMARK_LOCKUP_VIEWBOX,
  WORDMARK_PATH,
} from "@repo/ui/components/brand/logo";
import { AbsoluteFill } from "@vendor/remotion";

export const BRAND_CLEARSPACE = 3 * LOGO_DOT_PITCH;
const metrics = getLogoMetrics(LOGO_MARK_VIEWBOX_SIZE);

export function getBrandDimensions(lockup = false) {
  return {
    width:
      2 * BRAND_CLEARSPACE +
      metrics.markSize +
      (lockup ? metrics.gap + metrics.wordmarkWidth : 0),
    height:
      2 * BRAND_CLEARSPACE +
      (lockup ? metrics.wordmarkHeight : metrics.markSize),
  };
}

/** Exact shared paths and lockup metrics, with the public 3L exclusion zone. */
export function BrandSvg({
  lockup = false,
  inverse = false,
}: {
  lockup?: boolean;
  inverse?: boolean;
}) {
  const { width, height } = getBrandDimensions(lockup);
  return (
    <svg
      aria-label="Lightfast"
      height={height}
      role="img"
      style={{ display: "block", width: "100%", height: "100%" }}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill={inverse ? "#ffffff" : "#000000"}>
        <svg
          height={metrics.markSize}
          viewBox={`0 0 ${LOGO_MARK_VIEWBOX_SIZE} ${LOGO_MARK_VIEWBOX_SIZE}`}
          width={metrics.markSize}
          x={BRAND_CLEARSPACE}
          y={(height - metrics.markSize) / 2}
        >
          <path d={DOT_MATRIX_PATH} />
        </svg>
        {lockup ? (
          <svg
            height={metrics.wordmarkHeight}
            viewBox={WORDMARK_LOCKUP_VIEWBOX}
            width={metrics.wordmarkWidth}
            x={BRAND_CLEARSPACE + metrics.markSize + metrics.gap}
            y={BRAND_CLEARSPACE}
          >
            <path d={WORDMARK_PATH} />
          </svg>
        ) : null}
      </g>
    </svg>
  );
}

export function BrandIcon() {
  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      <BrandSvg />
    </AbsoluteFill>
  );
}
