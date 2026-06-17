import { useQuery } from "@tanstack/react-query";
import { IdentitySoulLoading } from "./identity-soul-loading";
import { orgIdentityQueryOptions } from "./identity-soul-queries";
import {
  IdentitySoulEmptyState,
  IdentitySoulSection,
} from "./identity-soul-section";

export function IdentitySoulCard({ slug }: { slug: string }) {
  const { data, error, isPending } = useQuery({
    ...orgIdentityQueryOptions(),
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
