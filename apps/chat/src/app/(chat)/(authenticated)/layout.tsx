import { AuthenticatedHeader } from "~/components/layouts/authenticated-header";
import { TRPCReactProvider } from "@repo/trpc-client/trpc-react-provider";
import { $TRPCSource } from "@vendor/trpc/headers";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <TRPCReactProvider source={$TRPCSource.Enum["lightfast-chat"]}>
      <div className="relative h-full">
        <AuthenticatedHeader />
        {children}
      </div>
    </TRPCReactProvider>
  );
}