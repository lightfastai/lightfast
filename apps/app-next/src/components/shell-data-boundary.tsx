import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export function ShellDataBoundary({ children }: { children: React.ReactNode }) {
  prefetch(trpc.viewer.organization.listUserOrganizations.queryOptions());
  prefetch(trpc.viewer.account.get.queryOptions());

  return <HydrateClient>{children}</HydrateClient>;
}
