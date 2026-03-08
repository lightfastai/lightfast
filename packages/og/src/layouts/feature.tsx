import { colors } from "../brand";
import type { FeatureOGProps } from "../types";

export function FeatureLayout({ title, description }: FeatureOGProps) {
  return (
    <div
      style={{ backgroundColor: colors.background }}
      tw="flex flex-col justify-center w-full h-full p-20"
    >
      <div
        style={{
          fontFamily: "PP Neue Montreal",
          color: colors.foreground,
        }}
        tw="text-xl font-medium mb-10"
      >
        Lightfast
      </div>

      <div style={{ gap: "16px" }} tw="flex flex-col">
        <div
          style={{
            fontSize: 56,
            fontFamily: "PP Neue Montreal",
            color: colors.foreground,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
          tw="font-bold"
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              fontFamily: "PP Neue Montreal",
              color: colors.mutedForeground,
              lineHeight: 1.4,
            }}
            tw="text-2xl font-normal"
          >
            {description}
          </div>
        )}
      </div>

      <div
        style={{
          fontFamily: "PP Neue Montreal",
          color: colors.mutedForeground,
        }}
        tw="flex items-center mt-auto text-xl font-normal"
      >
        lightfast.ai
      </div>
    </div>
  );
}
