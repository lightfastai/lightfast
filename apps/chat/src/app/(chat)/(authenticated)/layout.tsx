import { AuthenticatedHeader } from "~/components/layouts/authenticated-header";
import { TRPCReactProvider } from "@repo/trpc-client/trpc-react-provider";
import { getQueryClient, trpc } from "@repo/trpc-client/trpc-react-server-provider";
import { $TRPCSource } from "@vendor/trpc/headers";
import { notFound } from "next/navigation";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const queryClient = getQueryClient();
  const session = await queryClient.fetchQuery(
    trpc.auth.session.getSession.queryOptions(),
  );
  
  if (!session?.userId) {
    notFound();
  }

  return (
    <TRPCReactProvider source={$TRPCSource.Enum["lightfast-chat"]}>
      <div className="relative h-full">
        <AuthenticatedHeader />
        {children}
      </div>
    </TRPCReactProvider>
  );
}