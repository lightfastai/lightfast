import { UnauthenticatedHeader } from "~/components/layouts/unauthenticated-header";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <TooltipProvider>
      <div className="dark relative min-h-screen flex flex-col bg-background">
        <UnauthenticatedHeader />
        <div className="flex-1">{children}</div>
      </div>
    </TooltipProvider>
  );
}