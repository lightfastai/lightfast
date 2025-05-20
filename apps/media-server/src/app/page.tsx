import { Suspense } from "react";
import dynamic from "next/dynamic";

import {
  getQueryClient,
  trpc,
} from "@repo/trpc-client/trpc-react-server-provider";

const RunsTable = dynamic(
  () => import("~/components/runs-table").then((mod) => mod.RunsTable),
  {
    ssr: true,
  },
);

export default async function RunsPage() {
  const queryClient = getQueryClient();
  const data = await queryClient.fetchQuery(
    trpc.app.health.health.queryOptions(),
  );
  console.log("server data", data);
  return (
    <div className="divide-border flex h-full flex-col divide-y">
      <div className="flex-none px-8 py-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Runs</h1>
          <p className="text-muted-foreground">
            A view of all the runs that have been made
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="bg-card text-muted-foreground rounded-lg border p-8 text-center">
              Loading runs...
            </div>
          }
        >
          <RunsTable />
        </Suspense>
      </div>
    </div>
  );
}
