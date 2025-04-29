"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

import { CreateTestEventDialog } from "~/components/create-test-event-dialog";

const RunsTable = dynamic(
  () => import("~/components/runs-table").then((mod) => mod.RunsTable),
  {
    ssr: false,
  },
);

export default function RunsPage() {
  return (
    <div className="divide-border divide-y">
      <div className="flex items-center justify-between px-8 py-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Runs</h1>
          <p className="text-muted-foreground">
            A view of all the runs that have been made
          </p>
        </div>
        <CreateTestEventDialog />
      </div>
      <div className="h-full rounded-lg">
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
