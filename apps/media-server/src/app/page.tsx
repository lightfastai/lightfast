"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const RunsTable = dynamic(
  () => import("~/components/runs-table").then((mod) => mod.RunsTable),
  {
    ssr: false,
  },
);

export default function RunsPage() {
  return (
    <div className="flex flex-col gap-8 p-8">
      <h1 className="text-4xl font-bold">Runs</h1>
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
  );
}
