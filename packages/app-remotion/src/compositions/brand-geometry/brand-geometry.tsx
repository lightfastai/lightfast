import {
  Logo as BrandLogo,
  DOT_MATRIX_PATH,
  LOGO_DOT_DIAMETER,
  LOGO_DOT_PITCH,
  LOGO_MARK_VIEWBOX_SIZE,
} from "@repo/ui-v2/components/brand/logo";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
} from "@vendor/remotion";
import { loadFont } from "@vendor/remotion/fonts";
import type React from "react";
import { useEffect, useState } from "react";

let fontsLoaded = false;

const ensureBrandGeometryFontsLoaded = async () => {
  if (fontsLoaded) {
    return;
  }

  await Promise.all([
    loadFont({
      family: "Roobert-TRIAL-Medium",
      url: staticFile("fonts/roobert/Roobert-TRIAL-Medium.woff2"),
      weight: "500",
    }),
    loadFont({
      family: "PP Neue Montreal",
      url: staticFile("fonts/pp-neue-montreal/PPNeueMontreal-Book.woff2"),
      weight: "400",
    }),
  ]);

  fontsLoaded = true;
};

const MARK_SIZE = 240;
const UNIT = (MARK_SIZE / LOGO_MARK_VIEWBOX_SIZE) * LOGO_DOT_PITCH;
const CLEARSPACE = UNIT * 2;
const CLEARSPACE_BOX_SIZE = MARK_SIZE + CLEARSPACE * 2;
const DIAGRAM_SIZE = 520;
const DIAGRAM_OFFSET = (DIAGRAM_SIZE - CLEARSPACE_BOX_SIZE) / 2;
const MARK_OFFSET = DIAGRAM_OFFSET + CLEARSPACE;
const MARK_SCALE = MARK_SIZE / LOGO_MARK_VIEWBOX_SIZE;
const LOCKUP_SCALE = 1.25;
const SOCIAL_LOCKUP_SCALE = 0.9;

const MarkPath = ({ size }: { size: number }) => (
  <svg
    aria-hidden="true"
    height={size}
    viewBox={`0 0 ${LOGO_MARK_VIEWBOX_SIZE} ${LOGO_MARK_VIEWBOX_SIZE}`}
    width={size}
  >
    <path d={DOT_MATRIX_PATH} fill="currentColor" />
  </svg>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="font-mono text-[17px] text-muted-foreground uppercase tracking-[0.18em]">
    {children}
  </div>
);

const Caption = ({ children }: { children: React.ReactNode }) => (
  <p className="max-w-[520px] text-[21px] text-muted-foreground leading-[1.28]">
    {children}
  </p>
);

const UnitDiagram = () => {
  const pitch = 68;
  const dot = 44;
  const firstCenter = 72;
  const secondCenter = firstCenter + pitch;
  const y = 62;

  return (
    <div className="grid grid-cols-[250px_1fr] gap-8 border-border border-b pb-6">
      <div>
        <Label>Unit</Label>
        <h2 className="mt-3 font-title text-[48px] leading-none">1L</h2>
        <Caption>
          One dot pitch, measured center to center, becomes the spacing unit.
        </Caption>
      </div>

      <div className="flex items-end justify-between gap-8">
        <svg
          aria-label="Dot pitch unit diagram"
          height="126"
          viewBox="0 0 250 126"
          width="250"
        >
          <circle cx={firstCenter} cy={y} fill="currentColor" r={dot / 2} />
          <circle cx={secondCenter} cy={y} fill="currentColor" r={dot / 2} />
          <line
            stroke="var(--border)"
            strokeDasharray="10 10"
            strokeWidth="2"
            x1={firstCenter}
            x2={firstCenter}
            y1="16"
            y2="98"
          />
          <line
            stroke="var(--border)"
            strokeDasharray="10 10"
            strokeWidth="2"
            x1={secondCenter}
            x2={secondCenter}
            y1="16"
            y2="98"
          />
          <line
            stroke="var(--foreground)"
            strokeWidth="2"
            x1={firstCenter}
            x2={secondCenter}
            y1="98"
            y2="98"
          />
          <text
            fill="var(--foreground)"
            fontFamily="var(--font-geist-mono)"
            fontSize="16"
            letterSpacing="3"
            textAnchor="middle"
            x={(firstCenter + secondCenter) / 2}
            y="124"
          >
            1L
          </text>
        </svg>

        <div className="grid grid-cols-3 gap-5 font-mono text-[16px] text-muted-foreground">
          <div>
            <div className="text-foreground">{LOGO_MARK_VIEWBOX_SIZE}</div>
            <div>mark</div>
          </div>
          <div>
            <div className="text-foreground">{LOGO_DOT_PITCH}</div>
            <div>pitch</div>
          </div>
          <div>
            <div className="text-foreground">{LOGO_DOT_DIAMETER}</div>
            <div>dot</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClearspaceDiagram = () => (
  <div>
    <Label>Clearspace</Label>
    <div className="relative mt-8 size-[520px]">
      <svg
        aria-label="Logo clearspace diagram"
        className="absolute inset-0"
        height={DIAGRAM_SIZE}
        viewBox={`0 0 ${DIAGRAM_SIZE} ${DIAGRAM_SIZE}`}
        width={DIAGRAM_SIZE}
      >
        <rect
          fill="transparent"
          height={CLEARSPACE_BOX_SIZE}
          stroke="var(--border)"
          strokeDasharray="12 12"
          strokeWidth="2"
          width={CLEARSPACE_BOX_SIZE}
          x={DIAGRAM_OFFSET}
          y={DIAGRAM_OFFSET}
        />
        <rect
          fill="transparent"
          height={MARK_SIZE}
          stroke="var(--foreground)"
          strokeOpacity="0.36"
          strokeWidth="2"
          width={MARK_SIZE}
          x={MARK_OFFSET}
          y={MARK_OFFSET}
        />
        <g
          transform={`translate(${MARK_OFFSET} ${MARK_OFFSET}) scale(${MARK_SCALE})`}
        >
          <path d={DOT_MATRIX_PATH} fill="var(--foreground)" />
        </g>
        <line
          stroke="var(--foreground)"
          strokeWidth="2"
          x1={DIAGRAM_OFFSET}
          x2={MARK_OFFSET}
          y1={DIAGRAM_OFFSET - 28}
          y2={DIAGRAM_OFFSET - 28}
        />
        <text
          fill="var(--foreground)"
          fontFamily="var(--font-geist-mono)"
          fontSize="18"
          letterSpacing="3"
          textAnchor="middle"
          x={DIAGRAM_OFFSET + CLEARSPACE / 2}
          y={DIAGRAM_OFFSET - 42}
        >
          2L
        </text>
        <line
          stroke="var(--foreground)"
          strokeWidth="2"
          x1={MARK_OFFSET + 10}
          x2={MARK_OFFSET + UNIT + 10}
          y1={MARK_OFFSET + MARK_SIZE + 32}
          y2={MARK_OFFSET + MARK_SIZE + 32}
        />
        <text
          fill="var(--foreground)"
          fontFamily="var(--font-geist-mono)"
          fontSize="18"
          letterSpacing="3"
          textAnchor="middle"
          x={MARK_OFFSET + UNIT / 2 + 10}
          y={MARK_OFFSET + MARK_SIZE + 64}
        >
          1L
        </text>
      </svg>
    </div>
  </div>
);

const PrimaryLockupDiagram = () => (
  <div className="border-border border-b pb-6">
    <Label>Primary lockup</Label>
    <div className="relative mt-6 h-[132px] overflow-visible">
      <div
        className="absolute top-1/2 left-0 origin-left -translate-y-1/2"
        style={{ transform: `translateY(-50%) scale(${LOCKUP_SCALE})` }}
      >
        <BrandLogo className="text-current" size="xl" />
      </div>
      <div className="absolute top-0 left-[96px] h-full border-border border-l border-dashed" />
      <div className="absolute top-0 left-[126px] h-full border-border border-l border-dashed" />
      <div className="absolute top-[106px] left-[96px] font-mono text-[17px] text-muted-foreground tracking-[0.16em]">
        gap = 2L
      </div>
    </div>
  </div>
);

const PartnershipDiagram = () => (
  <div>
    <Label>Partnership spacing</Label>
    <div className="relative mt-5 flex h-[112px] items-center">
      <div className="flex size-[96px] items-center justify-center border border-border text-[20px] text-muted-foreground">
        Partner
      </div>
      <div className="flex w-[124px] flex-col items-center gap-4">
        <div className="h-px w-full border-border border-t border-dashed" />
        <div className="font-mono text-[17px] text-muted-foreground">4L</div>
      </div>
      <div className="font-light text-[48px] text-muted-foreground leading-none">
        +
      </div>
      <div className="flex w-[124px] flex-col items-center gap-4">
        <div className="h-px w-full border-border border-t border-dashed" />
        <div className="font-mono text-[17px] text-muted-foreground">4L</div>
      </div>
      <div
        className="origin-left"
        style={{ transform: `scale(${SOCIAL_LOCKUP_SCALE})` }}
      >
        <BrandLogo className="text-current" size="xl" />
      </div>
    </div>
  </div>
);

export const BrandGeometry: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading brand geometry fonts"));

  useEffect(() => {
    void ensureBrandGeometryFontsLoaded()
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);

  return (
    <AbsoluteFill className="bg-background text-foreground">
      <div className="flex h-full w-full flex-col px-16 py-12">
        <header className="flex items-start justify-between border-border border-b pb-6">
          <div>
            <Label>Lightfast brand geometry</Label>
            <h1 className="mt-4 font-title text-[64px] leading-none">
              Dot pitch defines spacing.
            </h1>
          </div>
          <div className="flex items-center gap-4 font-mono text-[18px] text-muted-foreground tracking-[0.16em]">
            <MarkPath size={40} />
            <span>L = 1 dot pitch</span>
          </div>
        </header>

        <main className="grid flex-1 grid-cols-[540px_1fr] gap-16 overflow-visible pt-9">
          <ClearspaceDiagram />
          <div className="flex min-w-0 flex-col gap-7">
            <UnitDiagram />
            <PrimaryLockupDiagram />
            <PartnershipDiagram />
          </div>
        </main>
      </div>
    </AbsoluteFill>
  );
};
