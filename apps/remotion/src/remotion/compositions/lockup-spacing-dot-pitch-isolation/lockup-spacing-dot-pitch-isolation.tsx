import {
  DOT_MATRIX_PATH,
  getLogoMetrics,
  LOGO_MARK_VIEWBOX_SIZE,
  WORDMARK_LOCKUP_VIEWBOX,
  WORDMARK_LOCKUP_VIEWBOX_Y,
  WORDMARK_PATH,
  WORDMARK_UNITS_PER_EM,
} from "@repo/ui-v2/components/brand/logo";
import { AbsoluteFill } from "@vendor/remotion";
import type React from "react";

const WIDTH = 1116;
const HEIGHT = 600;

const STAGE_HEIGHT = 420;
const RENDER_SCALE = 0.88;

const CONSTRUCTION_WIDTH = 956;
const CONSTRUCTION_HEIGHT = 260;
const MARK_SIZE = 172;

type LockupSpacingDotPitchIsolationTheme = "dark" | "light";

interface Palette {
  accent: string;
  background: string;
  foreground: string;
  guide: string;
  guideDashed: string;
  guideSoft: string;
}

const COLOR_THEMES = {
  light: {
    background: "oklch(1 0 0)",
    foreground: "oklch(0.277 0 0)",
    guide: "oklch(0.159 0 0 / 18%)",
    guideSoft: "oklch(0.159 0 0 / 12%)",
    guideDashed: "oklch(0.478 0 0)",
    accent: "#FF2B2B",
  },
  dark: {
    background: "oklch(0.2178 0 0)",
    foreground: "oklch(0.9461 0 0)",
    guide: "oklch(1 0 0 / 20%)",
    guideSoft: "oklch(1 0 0 / 14%)",
    guideDashed: "oklch(0.65 0 0)",
    accent: "#FF4D4D",
  },
} satisfies Record<LockupSpacingDotPitchIsolationTheme, Palette>;

const logoMetrics = getLogoMetrics(MARK_SIZE);
const markScale = MARK_SIZE / LOGO_MARK_VIEWBOX_SIZE;
const dotDiameter = logoMetrics.dotDiameter;
const dotRadius = dotDiameter / 2;
const oneL = logoMetrics.dotPitch;
const twoL = logoMetrics.visibleGap;

const constructionX = (WIDTH - CONSTRUCTION_WIDTH * RENDER_SCALE) / 2;
const constructionY = (HEIGHT - STAGE_HEIGHT * RENDER_SCALE) / 2;

const markTop = 44;
const markTopGuideY = 43;
const markBottomGuideY = 216;
const wordmarkTopGuideY = markTopGuideY + oneL;
const wordmarkBottomGuideY = 229;
const wordmarkLTopY = -700;
const wordmarkUnitScale = logoMetrics.wordmarkSize / WORDMARK_UNITS_PER_EM;
const wordmarkLTopPadding =
  (wordmarkLTopY - WORDMARK_LOCKUP_VIEWBOX_Y) * wordmarkUnitScale;
const wordmarkSvgX = MARK_SIZE + logoMetrics.gap;
const wordmarkSvgY = wordmarkTopGuideY - wordmarkLTopPadding;
const twoLRailY = 298;
const oneLMeasureX = 776;

const guideTextStyle = {
  fontFamily: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
  fontSize: 13,
  fontWeight: 400,
  letterSpacing: "0.12em",
} satisfies React.CSSProperties;

const labelTextStyle = {
  ...guideTextStyle,
  fontSize: 12,
} satisfies React.CSSProperties;

const Dot = ({ color, cx, cy }: { color: string; cx: number; cy: number }) => (
  <circle cx={cx} cy={cy} fill={color} r={dotRadius} />
);

export const LockupSpacingDotPitchIsolation: React.FC<
  Record<string, unknown>
> = ({ theme }) => {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  const colors = COLOR_THEMES[selectedTheme];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        color: colors.foreground,
        height: HEIGHT,
        width: WIDTH,
      }}
    >
      <svg
        aria-label="Lightfast lockup dot pitch spacing construction"
        height={HEIGHT}
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g
          transform={`translate(${constructionX} ${constructionY}) scale(${RENDER_SCALE})`}
        >
          <rect
            fill="transparent"
            height={CONSTRUCTION_HEIGHT}
            width={CONSTRUCTION_WIDTH}
          />

          <line
            stroke={colors.guide}
            x1={MARK_SIZE}
            x2={MARK_SIZE}
            y1={20}
            y2={298}
          />
          <line
            stroke={colors.guide}
            x1={MARK_SIZE + twoL}
            x2={MARK_SIZE + twoL}
            y1={20}
            y2={298}
          />

          <svg
            height={MARK_SIZE}
            overflow="visible"
            viewBox={`0 0 ${LOGO_MARK_VIEWBOX_SIZE} ${LOGO_MARK_VIEWBOX_SIZE}`}
            width={MARK_SIZE}
            x={0}
            y={markTop}
          >
            <path d={DOT_MATRIX_PATH} fill={colors.foreground} />
          </svg>

          <svg
            aria-label="Lightfast"
            height={logoMetrics.wordmarkHeight}
            overflow="visible"
            role="img"
            viewBox={WORDMARK_LOCKUP_VIEWBOX}
            width={logoMetrics.wordmarkWidth}
            x={wordmarkSvgX}
            y={wordmarkSvgY}
          >
            <path d={WORDMARK_PATH} fill={colors.foreground} />
          </svg>

          <line
            stroke={colors.guide}
            x1={0}
            x2={CONSTRUCTION_WIDTH}
            y1={markTopGuideY}
            y2={markTopGuideY}
          />
          <line
            stroke={colors.guide}
            x1={0}
            x2={CONSTRUCTION_WIDTH}
            y1={markBottomGuideY}
            y2={markBottomGuideY}
          />
          <line
            stroke={colors.guideDashed}
            strokeDasharray="4 3"
            x1={0}
            x2={CONSTRUCTION_WIDTH}
            y1={wordmarkTopGuideY}
            y2={wordmarkTopGuideY}
          />
          <line
            stroke={colors.guideDashed}
            strokeDasharray="4 3"
            x1={0}
            x2={CONSTRUCTION_WIDTH}
            y1={wordmarkBottomGuideY}
            y2={wordmarkBottomGuideY}
          />
          <line
            stroke={colors.accent}
            x1={0}
            x2={CONSTRUCTION_WIDTH}
            y1={wordmarkTopGuideY}
            y2={wordmarkTopGuideY}
          />

          <g transform={`translate(${MARK_SIZE} ${twoLRailY})`}>
            <line stroke={colors.guide} x1={0} x2={twoL} y1={0} y2={0} />
            <line stroke={colors.guide} x1={0} x2={0} y1={-22} y2={22} />
            <line
              stroke={colors.guideSoft}
              x1={oneL}
              x2={oneL}
              y1={-12}
              y2={12}
            />
            <line stroke={colors.guide} x1={twoL} x2={twoL} y1={-22} y2={22} />
            <Dot color={colors.foreground} cx={0} cy={0} />
            <Dot color={colors.foreground} cx={oneL} cy={0} />
            <Dot color={colors.foreground} cx={twoL} cy={0} />
            <text
              fill={colors.guideDashed}
              style={guideTextStyle}
              textAnchor="middle"
              x={twoL / 2}
              y={44}
            >
              2L
            </text>
          </g>

          <g transform={`translate(${oneLMeasureX} ${markTopGuideY})`}>
            <line
              stroke={colors.accent}
              x1={dotRadius}
              x2={dotRadius}
              y1={0}
              y2={oneL}
            />
            <Dot color={colors.accent} cx={dotRadius} cy={0} />
            <Dot color={colors.accent} cx={dotRadius} cy={oneL} />
            <text fill={colors.accent} style={labelTextStyle} x={34} y={17}>
              1L
            </text>
          </g>
        </g>

        <metadata>
          {`theme=${selectedTheme}; markScale=${markScale}; dotDiameter=${dotDiameter}; oneL=${oneL}; twoL=${twoL}`}
        </metadata>
      </svg>
    </AbsoluteFill>
  );
};
