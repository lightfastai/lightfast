import {
  DOT_MATRIX_PATH,
  getLogoMetrics,
  LOGO_MARK_SIZES,
  LOGO_MARK_VIEWBOX_SIZE,
  WORDMARK_LOCKUP_VIEWBOX,
  WORDMARK_PATH,
} from "@repo/ui-v2/components/brand/logo";
import { ImageResponse } from "next/og";

export const alt = "Lightfast";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const runtime = "nodejs";

const logoMetrics = getLogoMetrics(LOGO_MARK_SIZES.lg);
const logoColor = "#050505";

const px = (value: number) => `${Number(value.toFixed(3))}px`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          backgroundColor: "#ffffff",
          color: logoColor,
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
          }}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            height={logoMetrics.markSize}
            style={{
              display: "flex",
              height: px(logoMetrics.markSize),
              overflow: "visible",
              width: px(logoMetrics.markSize),
            }}
            viewBox={`0 0 ${LOGO_MARK_VIEWBOX_SIZE} ${LOGO_MARK_VIEWBOX_SIZE}`}
            width={logoMetrics.markSize}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d={DOT_MATRIX_PATH} fill={logoColor} />
          </svg>
          <svg
            aria-label="Lightfast"
            focusable="false"
            height={logoMetrics.wordmarkHeight}
            role="img"
            style={{
              display: "flex",
              height: px(logoMetrics.wordmarkHeight),
              marginLeft: px(logoMetrics.gap),
              overflow: "visible",
              width: px(logoMetrics.wordmarkWidth),
            }}
            viewBox={WORDMARK_LOCKUP_VIEWBOX}
            width={logoMetrics.wordmarkWidth}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d={WORDMARK_PATH} fill={logoColor} />
          </svg>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
