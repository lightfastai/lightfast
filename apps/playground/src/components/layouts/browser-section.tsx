import { ReactNode } from "react";

interface BrowserSectionProps {
  children: ReactNode;
}

/**
 * BrowserSection handles the layout of the browser viewing area.
 * It provides proper padding and overflow handling for the browser container.
 */
export function BrowserSection({ children }: BrowserSectionProps) {
  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex-1 min-h-0 border rounded-lg shadow-lg overflow-hidden bg-background">
        {children}
      </div>
    </div>
  );
}