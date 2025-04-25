import type { ReactNode } from "react";

interface LegalLayoutProps {
  children: ReactNode;
  params: { slug: string };
}

export default function LegalLayout({ children }: LegalLayoutProps) {
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-8 sm:py-16">
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  );
}
