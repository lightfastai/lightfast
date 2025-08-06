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
    <div className="h-screen flex flex-col">
      {/* Header Section - Fixed height, always at top */}
      <div className="flex-shrink-0">
        {header}
      </div>
      
      {/* Content Section - Takes remaining height */}
      <div className="flex-1 min-h-0 lg:grid lg:grid-cols-10 flex flex-col">
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