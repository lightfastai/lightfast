import type React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { IsometricCard } from "../shared/IsometricCard";
import { SPRING_CONFIGS, SECTION_TIMING, ROW_STAGGER } from "../shared/timing";
import { COLORS } from "../shared/colors";
import { FONT_FAMILY } from "../shared/fonts";

const MOCK_DATA = [
  { company: "Acme Corp", category: "Enterprise", date: "Jan 15", amount: "$42,000" },
  { company: "Globex Inc", category: "Startup", date: "Jan 18", amount: "$8,500" },
  { company: "Initech", category: "Mid-market", date: "Jan 20", amount: "$23,100" },
  { company: "Umbrella Co", category: "Enterprise", date: "Jan 22", amount: "$67,800" },
  { company: "Stark Ind", category: "Enterprise", date: "Jan 25", amount: "$91,200" },
];

const COLUMNS = ["Account", "Segment", "Date", "Value"];
const COL_WIDTHS = [120, 90, 70, 70];

export const IngestedData: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = SECTION_TIMING.INGESTED_DATA.entrance;

  return (
    <IsometricCard
      entranceFrame={entrance}
      width={380}
      height={320}
      x={100}
      y={560}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px 12px",
          borderBottom: `1px solid ${COLORS.borderLight}`,
          fontFamily: FONT_FAMILY,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: COLORS.textMuted,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Ingested Accounts
        </div>
      </div>

      {/* Table header */}
      <div
        style={{
          display: "flex",
          padding: "10px 20px",
          backgroundColor: COLORS.tableHeader,
          borderBottom: `1px solid ${COLORS.borderLight}`,
          fontFamily: FONT_FAMILY,
        }}
      >
        {COLUMNS.map((col, i) => (
          <div
            key={col}
            style={{
              width: COL_WIDTHS[i],
              fontSize: 10,
              fontWeight: 500,
              color: COLORS.textLight,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {col}
          </div>
        ))}
      </div>

      {/* Table rows */}
      <div>
        {MOCK_DATA.map((row, i) => {
          const rowEntrance = spring({
            frame: frame - (entrance + 12 + i * ROW_STAGGER.INGESTED_DATA),
            fps,
            config: SPRING_CONFIGS.SMOOTH,
          });

          const rowOpacity = interpolate(rowEntrance, [0, 1], [0, 1]);
          const rowTranslate = interpolate(rowEntrance, [0, 1], [8, 0]);

          const values = [row.company, row.category, row.date, row.amount];

          return (
            <div
              key={i}
              style={{
                display: "flex",
                padding: "10px 20px",
                borderBottom:
                  i < MOCK_DATA.length - 1
                    ? `1px solid ${COLORS.borderLight}`
                    : "none",
                backgroundColor: i % 2 === 1 ? COLORS.tableRowAlt : "transparent",
                opacity: rowOpacity,
                transform: `translateY(${rowTranslate}px)`,
                fontFamily: FONT_FAMILY,
              }}
            >
              {values.map((val, j) => (
                <div
                  key={j}
                  style={{
                    width: COL_WIDTHS[j],
                    fontSize: 11,
                    color: j === 0 ? COLORS.text : COLORS.textMuted,
                    fontWeight: j === 0 ? 500 : 400,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {val}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </IsometricCard>
  );
};
