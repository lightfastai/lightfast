import { Skeleton } from "@repo/ui/components/ui/skeleton";

const ROWS = [
  { name: "w-40", detail: "w-64" },
  { name: "w-32", detail: "w-56" },
  { name: "w-36", detail: "w-60" },
];

export function OrgApiKeyListLoading() {
  return (
    <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
      {ROWS.map((row, i) => (
        <div
          className="flex items-center justify-between gap-4 px-4 py-4"
          key={i}
        >
          <div className="space-y-2">
            <Skeleton className={`h-4 ${row.name}`} />
            <Skeleton className={`h-3 ${row.detail}`} />
          </div>
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
      ))}
    </div>
  );
}
