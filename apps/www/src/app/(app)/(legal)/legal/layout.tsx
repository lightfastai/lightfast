import type { ReactNode } from "react";

interface LegalLayoutProps {
  children: ReactNode;
}

export default function LegalLayout({ children }: LegalLayoutProps) {
  return (
    <div className="manifesto-page bg-background text-foreground min-h-[calc(100vh-12rem)] py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl">
        {children}
      </div>
    </div>
  );
}
