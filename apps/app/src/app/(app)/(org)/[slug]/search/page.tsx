import { Suspense } from "react";
import { OrgSearch, OrgSearchSkeleton } from "~/components/org-search";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  return (
    <Suspense fallback={<OrgSearchSkeleton />}>
      <OrgSearch initialQuery={q} />
    </Suspense>
  );
}
