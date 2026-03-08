import { colors } from "../brand";
import type { ContentOGProps } from "../types";

export function ContentLayout({
  title,
  description,
  category,
  date,
  author,
}: ContentOGProps) {
  return (
    <div
      style={{ backgroundColor: colors.background }}
      tw="flex flex-col w-full h-full p-20"
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

      {category && (
        <div tw="flex mb-4">
          <div
            style={{
              fontFamily: "PP Neue Montreal",
              color: colors.brandBlue,
              letterSpacing: "0.05em",
            }}
            tw="text-base font-bold uppercase"
          >
            {category}
          </div>
        </div>
      )}

      <div style={{ gap: "16px" }} tw="flex flex-col flex-1">
        <div
          style={{
            fontFamily: "PP Neue Montreal",
            color: colors.foreground,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          tw="text-5xl font-bold"
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              fontSize: 22,
              fontFamily: "PP Neue Montreal",
              color: colors.mutedForeground,
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            tw="font-normal"
          >
            {description}
          </div>
        )}
      </div>

      <div
        style={{
          gap: "16px",
          fontSize: 18,
          fontFamily: "PP Neue Montreal",
          color: colors.mutedForeground,
        }}
        tw="flex items-center mt-auto"
      >
        {author && <span>{author}</span>}
        {author && date && <span style={{ color: colors.border }}>|</span>}
        {date && <span>{date}</span>}
      </div>
    </div>
  );
}
