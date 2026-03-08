import { colors } from "../brand";
import type { DocsOGProps } from "../types";

export function DocsLayout({ title, section, breadcrumb }: DocsOGProps) {
  return (
    <div
      style={{ backgroundColor: colors.background }}
      tw="flex flex-col w-full h-full p-20"
    >
      <div
        style={{ gap: "8px", fontFamily: "PP Neue Montreal" }}
        tw="flex items-center mb-10 text-xl"
      >
        <span style={{ color: colors.foreground }} tw="font-medium">
          Lightfast
        </span>
        <span style={{ color: colors.border }}>/</span>
        <span style={{ color: colors.mutedForeground }} tw="font-normal">
          Docs
        </span>
      </div>

      {(section ?? (breadcrumb && breadcrumb.length > 0)) && (
        <div
          style={{
            gap: "8px",
            fontSize: 18,
            fontFamily: "PP Neue Montreal",
            color: colors.mutedForeground,
          }}
          tw="flex items-center mb-4 font-normal"
        >
          {section && <span>{section}</span>}
          {!section &&
            breadcrumb?.map((crumb, i) => (
              <span key={crumb} style={{ gap: "8px" }} tw="flex items-center">
                {i > 0 && <span style={{ color: colors.border }}>/</span>}
                <span>{crumb}</span>
              </span>
            ))}
        </div>
      )}

      <div tw="flex flex-1 items-center">
        <div
          style={{
            fontSize: 52,
            fontFamily: "PP Neue Montreal",
            color: colors.foreground,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
          }}
          tw="font-bold"
        >
          {title}
        </div>
      </div>

      <div
        style={{
          fontSize: 18,
          fontFamily: "PP Neue Montreal",
          color: colors.mutedForeground,
        }}
        tw="flex items-center mt-auto font-normal"
      >
        docs.lightfast.ai
      </div>
    </div>
  );
}
