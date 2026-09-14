import {
  DOT_MATRIX_PATH,
  getLogoMetrics,
  LOGO_DOT_PITCH,
  LOGO_MARK_VIEWBOX_SIZE,
  WORDMARK_LOCKUP_VIEWBOX,
  WORDMARK_PATH,
} from "@repo/ui/components/brand/logo";
import { AbsoluteFill, Img } from "@vendor/remotion";

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

export interface BrandPreviewProps {
  icons?: { filename: string; size: number; src: string }[];
  vectors?: { filename: string; inverse: boolean; src: string }[];
}

/** Uses the generated files, including true 1× pixels for the small icons. */
export function BrandPreview({ icons = [], vectors = [] }: BrandPreviewProps) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#eeeeee",
        color: "#111111",
        padding: 40,
        fontFamily: "Arial, sans-serif",
        gap: 24,
      }}
    >
      <div style={{ fontSize: 28 }}>Lightfast · dotted public asset pack</div>
      <div style={{ display: "flex", gap: 32 }}>
        {icons
          .filter(({ size }) => size <= 48)
          .map(({ filename, size, src }) => (
            <div key={filename} style={{ width: 240 }}>
              <div>{filename} · native 1×</div>
              <div style={{ height: 64, paddingTop: 8 }}>
                <Img height={size} src={src} width={size} />
              </div>
              <Img
                height={192}
                src={src}
                style={{ imageRendering: "pixelated" }}
                width={192}
              />
              <div style={{ marginTop: 8 }}>Nearest-neighbor enlargement</div>
            </div>
          ))}
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        {icons
          .filter(({ size }) => size > 48)
          .map(({ filename, src }) => (
            <div key={filename} style={{ width: 220 }}>
              <Img height={128} src={src} width={128} />
              <div style={{ marginTop: 8, fontSize: 14 }}>{filename}</div>
            </div>
          ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {vectors.map(({ filename, inverse, src }) => (
          <div key={filename}>
            <div
              style={{
                backgroundColor: inverse ? "#000000" : "#ffffff",
                height: 112,
              }}
            >
              <Img
                height={112}
                src={src}
                style={{ width: "100%", height: 112, objectFit: "contain" }}
              />
            </div>
            <div style={{ marginTop: 6, fontSize: 14 }}>
              {filename} · scaled preview
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 14 }}>
        Exact 37-dot source · 3L clearspace · small-size antialiasing retained ·
        no optical adjustment
      </div>
    </AbsoluteFill>
  );
}
