import { ReactNode } from "react";

interface PlaygroundLayoutProps {
  header: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
}

/**
 * PlaygroundLayout provides the overall structure for the playground page.
 * It handles the responsive layout with a header, sidebar (chat), and main content (browser).
 */
export function PlaygroundLayout({ header, sidebar, main }: PlaygroundLayoutProps) {
  return (
    <div className="h-screen flex flex-col relative">
      {/* Header - Absolutely positioned */}
      {header}
      
      {/* Content Section - Full height with top padding to account for header */}
      <div className="h-full pt-14 lg:grid lg:grid-cols-10 flex flex-col">
        {/* Sidebar/Chat Section - 30% on desktop */}
        <div className="lg:col-span-3 flex flex-col h-full">
          {sidebar}
        </div>
        
        {/* Main/Browser Section - 70% on desktop */}
        <div className="lg:col-span-7 flex-1 lg:flex-initial">
          {main}
        </div>
      </div>
    </div>
  );
}