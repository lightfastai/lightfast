import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Company",
  description: "The Lightfast company.",
};

export default function ManifestoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="dark min-h-screen bg-background text-foreground"
      style={
        {
          "--background": "oklch(0 0 0)",
          "--foreground": "oklch(0.95 0 0)",
          "--card": "oklch(0.06 0 0)",
          "--card-foreground": "oklch(0.95 0 0)",
          "--popover": "oklch(0 0 0)",
          "--popover-foreground": "oklch(0.95 0 0)",
          "--muted": "oklch(0.12 0 0)",
          "--muted-foreground": "oklch(0.55 0 0)",
          "--border": "oklch(0.2 0 0)",
          "--accent": "oklch(0.12 0 0)",
          "--accent-foreground": "oklch(0.95 0 0)",
          "--input": "oklch(0.15 0 0)",
          "--input-bg": "oklch(0.06 0 0)",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
