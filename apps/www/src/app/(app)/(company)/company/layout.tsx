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
    <div className="dark min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
