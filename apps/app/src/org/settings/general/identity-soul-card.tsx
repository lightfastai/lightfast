import { getOrgIdentity } from "@api/app/tanstack/org-identity";
import { useQuery } from "@tanstack/react-query";
import { IdentitySoulLoading } from "./identity-soul-loading";
import {
  IdentitySoulEmptyState,
  IdentitySoulSection,
} from "./identity-soul-section";

const orgIdentityQueryKey = ["org-identity", "get"] as const;

export function IdentitySoulCard({ slug }: { slug: string }) {
  const { data, error, isPending } = useQuery({
    queryFn: () => getOrgIdentity(),
    queryKey: orgIdentityQueryKey,
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
