import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export default async function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefetch jobs for all common status filters
  // This prevents loading skeletons when switching between tabs
  const statusFilters: (JobStatus | undefined)[] = [
    undefined, // "all"
    "running",
    "completed",
    "failed",
  ];

  for (const status of statusFilters) {
    prefetch(
      trpc.jobs.list.queryOptions({
        status,
        limit: 50,
      })
    );
  }

  return <HydrateClient>{children}</HydrateClient>;
}
