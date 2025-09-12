import { UnauthenticatedHeader } from "~/components/layouts/unauthenticated-header";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { TRPCReactProvider } from "~/trpc/react";
import { HydrateClient } from "~/trpc/server";

interface UnauthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function UnauthenticatedLayout({ children }: UnauthenticatedLayoutProps) {
  return (
    <TRPCReactProvider>
      <HydrateClient>
        <TooltipProvider>
          <div className="dark relative h-screen flex flex-col">
            <UnauthenticatedHeader />
            <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
          </div>
        </TooltipProvider>
      </HydrateClient>
    </TRPCReactProvider>
  );
}