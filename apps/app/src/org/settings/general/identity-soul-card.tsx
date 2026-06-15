import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { IdentitySoulLoading } from "./identity-soul-loading";
import {
  IdentitySoulEmptyState,
  IdentitySoulSection,
} from "./identity-soul-section";

export function IdentitySoulCard({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const { data, error, isPending } = useQuery({
    ...trpc.org.settings.identity.get.queryOptions(),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });

  if (isPending) {
    return <IdentitySoulLoading />;
  }

  if (error) {
    return (
      <div className="rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
        {error.message}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (!data.configured) {
    return <IdentitySoulEmptyState slug={slug} />;
  }

  return <IdentitySoulSection identity={data} />;
}
