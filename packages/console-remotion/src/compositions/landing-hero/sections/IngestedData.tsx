import type React from "react";
import { IsometricCard } from "../shared/IsometricCard";
import { COLORS } from "../shared/colors";
import { FONT_FAMILY } from "../shared/fonts";

const SEARCH_RESULTS = [
  {
    title: "Authentication service architecture decision",
    domain: "github.com/lightfast/backend",
    timestamp: "3 days ago",
  },
  {
    title: "API rate limiting implementation — PR #842",
    domain: "github.com/lightfast/api",
    timestamp: "1 week ago",
  },
  {
    title: "User authentication flow diagram",
    domain: "notion.so/lightfast/docs",
    timestamp: "2 weeks ago",
  },
  {
    title: "Choosing between Clerk vs Auth0",
    domain: "slack.com/lightfast/engineering",
    timestamp: "3 weeks ago",
  },
  {
    title: "Payment service dependencies and ownership",
    domain: "linear.app/lightfast/ENG-1234",
    timestamp: "1 month ago",
  },
  {
    title: "Auth middleware refactor discussion",
    domain: "github.com/lightfast/backend",
    timestamp: "1 month ago",
  },
];

const NAV_ITEMS = [
  { label: "Search", active: true },
  { label: "Sources", active: false },
  { label: "Analytics", active: false },
  { label: "Settings", active: false },
];

const QUERY_TEXT = '"How does our authentication service work?"';
const SIDEBAR_WIDTH = 256;

const borderColor = COLORS.border;

export const IngestedData: React.FC = () => {
  return (
    <IsometricCard
      entranceFrame={0}
      animate={false}
      width={854}
      height={512}
      x={341}
      y={1024}
      maskImage="linear-gradient(200deg, black 0%, black 40%, transparent 90%)"
    >
      <div
        style={{
          display: "flex",
          height: "100%",
          overflow: "hidden",
          fontFamily: FONT_FAMILY,
          backgroundColor: COLORS.background,
        }}
      >
        {/* ── Sidebar ── */}
        <div
          style={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRight: `1px solid ${borderColor}`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* App name */}
          <div
            style={{
              padding: "14px 14px 10px",
              borderBottom: `1px solid ${borderColor}`,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: COLORS.primary,
                letterSpacing: "-0.01em",
              }}
            >
              lightfast
            </span>
          </div>

          {/* Nav items */}
          <div style={{ padding: "8px 6px" }}>
            {NAV_ITEMS.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "7px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: item.active ? 500 : 400,
                  color: item.active ? COLORS.text : COLORS.textMuted,
                  backgroundColor: item.active ? COLORS.cardGray : "transparent",
                  marginBottom: 2,
                }}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Bottom section */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: `1px solid ${borderColor}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  backgroundColor: COLORS.cardGray,
                  border: `1px solid ${borderColor}`,
                }}
              />
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>
                Acme Inc
              </span>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search query section */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: `1px solid ${borderColor}`,
              minHeight: 72,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 10, lineHeight: "16px" }}>
              <span style={{ color: COLORS.primary, fontWeight: 500 }}>lightfast</span>
              <span style={{ color: COLORS.textMuted }}>.</span>
              <span style={{ color: COLORS.text }}>search</span>
              <span style={{ color: COLORS.textMuted }}>(</span>
            </div>
            <div
              style={{
                fontSize: 10,
                lineHeight: "16px",
                paddingLeft: 16,
                color: COLORS.text,
              }}
            >
              {QUERY_TEXT}
            </div>
            <div style={{ fontSize: 10, lineHeight: "16px" }}>
              <span style={{ color: COLORS.textMuted }}>)</span>
            </div>
          </div>

          {/* Results list */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {SEARCH_RESULTS.map((result, index) => (
              <div
                key={index}
                style={{
                  padding: "8px 14px",
                  borderBottom:
                    index < SEARCH_RESULTS.length - 1
                      ? `1px solid ${borderColor}`
                      : undefined,
                  height: 46,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: COLORS.text,
                    lineHeight: "14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {result.title}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: COLORS.textMuted,
                    lineHeight: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 2,
                  }}
                >
                  <span>{result.domain}</span>
                  <span style={{ color: COLORS.textLight }}>|</span>
                  <span>{result.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </IsometricCard>
  );
};
