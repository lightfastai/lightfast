import {
  DOT_MATRIX_PATH,
  getLogoMetrics,
  LOGO_MARK_VIEWBOX_SIZE,
  WORDMARK_LOCKUP_VIEWBOX,
  WORDMARK_PATH,
} from "@repo/ui-v2/components/brand/logo";
import { AbsoluteFill } from "@vendor/remotion";
import type React from "react";

type BrandClearspaceTheme = "dark" | "light";

interface Palette {
  background: string;
  border: string;
  foreground: string;
  guide: string;
  label: string;
  measure: string;
  measureLine: string;
  measureSoft: string;
}

const COLOR_THEMES = {
  light: {
    background: "oklch(1 0 0)",
    foreground: "oklch(0.277 0 0)",
    border: "oklch(0.159 0 0 / 18%)",
    guide: "oklch(0.159 0 0 / 12%)",
    measure: "oklch(0.277 0 0)",
    measureSoft: "oklch(0.478 0 0)",
    measureLine: "oklch(0.159 0 0 / 35%)",
    label: "oklch(0.478 0 0)",
  },
  dark: {
    background: "oklch(0.2178 0 0)",
    foreground: "oklch(0.9461 0 0)",
    border: "oklch(1 0 0 / 20%)",
    guide: "oklch(1 0 0 / 14%)",
    measure: "oklch(0.9461 0 0)",
    measureSoft: "oklch(0.894 0 0)",
    measureLine: "oklch(1 0 0 / 35%)",
    label: "oklch(0.894 0 0)",
  },
} satisfies Record<BrandClearspaceTheme, Palette>;

const monoTextStyle = {
  fontFamily: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
  fontWeight: 400,
  letterSpacing: "0.08em",
} satisfies React.CSSProperties;

const Mark = ({
  color,
  size,
  x = 0,
  y = 0,
}: {
  color: string;
  size: number;
  x?: number;
  y?: number;
}) => (
  <svg
    height={size}
    overflow="visible"
    viewBox={`0 0 ${LOGO_MARK_VIEWBOX_SIZE} ${LOGO_MARK_VIEWBOX_SIZE}`}
    width={size}
    x={x}
    y={y}
  >
    <path d={DOT_MATRIX_PATH} fill={color} />
  </svg>
);

const Wordmark = ({
  color,
  markSize,
  x,
  y,
}: {
  color: string;
  markSize: number;
  x: number;
  y: number;
}) => {
  const metrics = getLogoMetrics(markSize);

  return (
    <svg
      aria-label="Lightfast"
      height={metrics.wordmarkHeight}
      overflow="visible"
      role="img"
      viewBox={WORDMARK_LOCKUP_VIEWBOX}
      width={metrics.wordmarkWidth}
      x={x}
      y={y}
    >
      <path d={WORDMARK_PATH} fill={color} />
    </svg>
  );
};

const HorizontalMeasure = ({
  dotSize,
  labelColor,
  lineColor,
  textSize,
  width,
  x,
  y,
}: {
  dotSize: number;
  labelColor: string;
  lineColor: string;
  textSize: number;
  width: number;
  x: number;
  y: number;
}) => (
  <g transform={`translate(${x} ${y})`}>
    <line
      stroke={lineColor}
      x1={0}
      x2={width}
      y1={dotSize / 2}
      y2={dotSize / 2}
    />
    <circle cx={0} cy={dotSize / 2} fill={labelColor} r={dotSize / 2} />
    <circle cx={width} cy={dotSize / 2} fill={labelColor} r={dotSize / 2} />
    <text
      fill={labelColor}
      fontSize={textSize}
      style={monoTextStyle}
      x={width / 2}
      y={dotSize + textSize + 1}
    >
      3L
    </text>
  </g>
);

const PartnerText = ({
  bold = false,
  color,
  x,
  y,
}: {
  bold?: boolean;
  color: string;
  x: number;
  y: number;
}) => (
  <text
    fill={color}
    fontFamily='"PP Neue Montreal", system-ui, sans-serif'
    fontSize={44}
    fontWeight={bold ? 700 : 400}
    letterSpacing="-0.02em"
    x={x}
    y={y}
  >
    <tspan dy="0" x={x}>
      Partner&apos;s
    </tspan>
    <tspan dy="46" x={x}>
      Logo
    </tspan>
  </text>
);

const getTheme = (theme: unknown): BrandClearspaceTheme =>
  theme === "light" ? "light" : "dark";

const LOGO_CLEARSPACE_CANVAS_WIDTH = 1600;
const LOGO_CLEARSPACE_CANVAS_HEIGHT = 900;
const PARTNERSHIP_CANVAS_WIDTH = 1600;
const PARTNERSHIP_CANVAS_HEIGHT = 540;

export const LogoSquareClearspaceDark: React.FC<Record<string, unknown>> = ({
  theme,
}) => {
  const colors = COLOR_THEMES[getTheme(theme)];
  const width = LOGO_CLEARSPACE_CANVAS_WIDTH;
  const height = LOGO_CLEARSPACE_CANVAS_HEIGHT;
  const scale = 4;
  const panelSize = 164 * scale;
  const markSize = 86 * scale;
  const clearspace = 39 * scale;
  const gap = 144;
  const measureDotSize = 5 * scale;
  const measureOffset = 21.5 * scale;
  const measureTextSize = 8 * scale;
  const groupWidth = panelSize * 2 + gap;
  const groupX = (width - groupWidth) / 2;
  const groupY = (height - panelSize) / 2;
  const previewX = groupX + panelSize + gap;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <svg
        aria-label="Lightfast square clearspace construction"
        height={height}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform={`translate(${groupX} ${groupY})`}>
          <rect
            fill="transparent"
            height={panelSize}
            stroke={colors.border}
            width={panelSize}
          />
          <line
            stroke={colors.guide}
            x1={clearspace}
            x2={clearspace}
            y1={0}
            y2={panelSize}
          />
          <line
            stroke={colors.guide}
            x1={clearspace + markSize}
            x2={clearspace + markSize}
            y1={0}
            y2={panelSize}
          />
          <line
            stroke={colors.guide}
            x1={0}
            x2={panelSize}
            y1={clearspace}
            y2={clearspace}
          />
          <line
            stroke={colors.guide}
            x1={0}
            x2={panelSize}
            y1={clearspace + markSize}
            y2={clearspace + markSize}
          />
          <Mark
            color={colors.foreground}
            size={markSize}
            x={clearspace}
            y={clearspace}
          />

          <HorizontalMeasure
            dotSize={measureDotSize}
            labelColor={colors.measureSoft}
            lineColor={colors.measureLine}
            textSize={measureTextSize}
            width={clearspace}
            x={0}
            y={measureOffset}
          />
          <g transform={`translate(${measureOffset} 0)`}>
            <line
              stroke={colors.measureLine}
              x1={0}
              x2={0}
              y1={0}
              y2={clearspace}
            />
            <circle
              cx={0}
              cy={0}
              fill={colors.measureSoft}
              r={measureDotSize / 2}
            />
            <circle
              cx={0}
              cy={clearspace}
              fill={colors.measureSoft}
              r={measureDotSize / 2}
            />
            <text
              fill={colors.label}
              fontSize={measureTextSize}
              style={monoTextStyle}
              x={7 * scale}
              y={18 * scale}
            >
              3L
            </text>
          </g>
        </g>

        <g transform={`translate(${previewX} ${groupY})`}>
          <rect
            fill="transparent"
            height={panelSize}
            stroke={colors.border}
            width={panelSize}
          />
          <Mark
            color={colors.foreground}
            size={markSize}
            x={clearspace}
            y={clearspace}
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

const PartnershipLogo = ({
  colors,
  x,
  y,
}: {
  colors: Palette;
  x: number;
  y: number;
}) => {
  const markSize = 80;
  const metrics = getLogoMetrics(markSize);

  return (
    <g transform={`translate(${x} ${y})`}>
      <Mark color={colors.foreground} size={markSize} />
      <Wordmark
        color={colors.foreground}
        markSize={markSize}
        x={markSize + metrics.gap}
        y={(markSize - metrics.wordmarkHeight) / 2}
      />
    </g>
  );
};

const PartnershipConstructionRow = ({
  clean = false,
  colors,
  x,
  y,
}: {
  clean?: boolean;
  colors: Palette;
  x: number;
  y: number;
}) => {
  const gap3L = 36;
  const dividerX = 424 + gap3L;
  const partnerX = dividerX + 1 + gap3L - 3;

  return (
    <g transform={`translate(${x} ${y})`}>
      <PartnershipLogo colors={colors} x={0} y={20} />
      {clean ? null : (
        <HorizontalMeasure
          dotSize={8}
          labelColor={colors.measure}
          lineColor={colors.measure}
          textSize={11}
          width={gap3L}
          x={424}
          y={56}
        />
      )}
      <line
        stroke={colors.foreground}
        x1={dividerX}
        x2={dividerX}
        y1={0}
        y2={120}
      />
      {clean ? null : (
        <HorizontalMeasure
          dotSize={8}
          labelColor={colors.measure}
          lineColor={colors.measure}
          textSize={11}
          width={gap3L}
          x={dividerX}
          y={56}
        />
      )}
      <PartnerText bold={clean} color={colors.foreground} x={partnerX} y={51} />
    </g>
  );
};

export const BrandPartnershipClearspaceDark: React.FC<
  Record<string, unknown>
> = ({ theme }) => {
  const colors = COLOR_THEMES[getTheme(theme)];
  const width = PARTNERSHIP_CANVAS_WIDTH;
  const height = PARTNERSHIP_CANVAS_HEIGHT;
  const constructionWidth = 768;
  const panelHeight = 272;
  const previewWidth = 676;
  const gap = 48;
  const groupWidth = constructionWidth + gap + previewWidth;
  const groupX = (width - groupWidth) / 2;
  const groupY = (height - panelHeight) / 2;
  const previewX = groupX + constructionWidth + gap;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <svg
        aria-label="Lightfast brand partnership clearspace construction"
        height={height}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform={`translate(${groupX} ${groupY})`}>
          <rect
            fill="transparent"
            height={panelHeight}
            stroke={colors.border}
            width={constructionWidth}
          />
          <line
            stroke={colors.guide}
            x1={0}
            x2={constructionWidth}
            y1={76}
            y2={76}
          />
          <line
            stroke={colors.guide}
            x1={0}
            x2={constructionWidth}
            y1={196}
            y2={196}
          />
          <line stroke={colors.guide} x1={48} x2={48} y1={0} y2={panelHeight} />
          <line
            stroke={colors.guide}
            x1={constructionWidth - 48}
            x2={constructionWidth - 48}
            y1={0}
            y2={panelHeight}
          />
          <line
            stroke={colors.border}
            x1={472}
            x2={472}
            y1={0}
            y2={panelHeight}
          />
          <line
            stroke={colors.border}
            x1={544}
            x2={544}
            y1={0}
            y2={panelHeight}
          />
          <PartnershipConstructionRow colors={colors} x={48} y={76} />
        </g>

        <g transform={`translate(${previewX} ${groupY})`}>
          <PartnershipConstructionRow clean colors={colors} x={0} y={76} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
