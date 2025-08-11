import { UnauthenticatedHeader } from "~/components/layouts/unauthenticated-header";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";

interface UnauthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function UnauthenticatedLayout({ children }: UnauthenticatedLayoutProps) {
  return (
    <TooltipProvider>
      <div className="relative h-screen flex flex-col">
        <UnauthenticatedHeader />
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </TooltipProvider>
  );
}