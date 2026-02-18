import type React from "react";
import { IsometricCard } from "../shared/IsometricCard";
import { COLORS } from "../shared/colors";
import { FONT_FAMILY } from "../shared/fonts";

const SOURCES = [
  { label: "GitHub", value: "Active" },
  { label: "Slack", value: "Active" },
  { label: "Linear", value: "Active" },
  { label: "Notion", value: "Syncing" },
];

const INDEXED = [
  { label: "Repositories", value: "24" },
  { label: "Channels", value: "156" },
  { label: "Projects", value: "42" },
  { label: "Pages", value: "1.2k" },
];

const OUTPUT = [
  { label: "Accuracy", value: "94%" },
  { label: "Latency", value: "120ms" },
  { label: "Queries", value: "2.4k" },
  { label: "Saved", value: "18h" },
];

type CardConfig = {
  title: string;
  items: { label: string; value: string }[];
  x: number;
};

const CARDS: CardConfig[] = [
  { title: "Connected", items: SOURCES, x: 0 },
  { title: "Indexed", items: INDEXED, x: 512 },
  { title: "Output", items: OUTPUT, x: 1024 },
];

const BottomCard: React.FC<{ config: CardConfig }> = ({ config }) => {
  return (
    <IsometricCard
      entranceFrame={0}
      animate={false}
      width={512}
      height={512}
      x={config.x}
      y={1024}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px 10px",
          borderBottom: `1px solid ${COLORS.borderLight}`,
          fontFamily: FONT_FAMILY,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: COLORS.textMuted,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {config.title}
        </div>
      </div>

      {/* Rows */}
      <div style={{ padding: "8px 0" }}>
        {config.items.map((item, i) => {
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 16px",
                fontFamily: FONT_FAMILY,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: COLORS.text,
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: COLORS.textLight,
                  fontWeight: 400,
                }}
              >
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </IsometricCard>
  );
};

export const IngestedData: React.FC = () => {
  return (
    <>
      {CARDS.map((card, i) => (
        <BottomCard key={i} config={card} />
      ))}
    </>
  );
};
