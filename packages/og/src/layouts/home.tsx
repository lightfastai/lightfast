import { colors } from "../brand";
import { lissajousPath } from "../brand/logo";

const LOGO_SIZE = 64;

export function HomeLayout() {
  return (
    <div
      style={{ backgroundColor: colors.background }}
      tw="flex items-center justify-center w-full h-full"
    >
      <div style={{ gap: "20px" }} tw="flex items-center">
        <svg
          height={LOGO_SIZE}
          viewBox={`0 0 ${LOGO_SIZE} ${LOGO_SIZE}`}
          width={LOGO_SIZE}
        >
          <path
            d={lissajousPath(LOGO_SIZE, 0.05)}
            fill="none"
            stroke={colors.foreground}
            strokeWidth={5}
          />
        </svg>
        <div
          style={{
            fontFamily: "PP Supply Sans",
            color: colors.foreground,
            letterSpacing: "0.05em",
          }}
          tw="text-6xl font-medium"
        >
          Lightfast
        </div>
      </div>
    </div>
  );
}
