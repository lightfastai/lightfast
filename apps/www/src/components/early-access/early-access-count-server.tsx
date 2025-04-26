import dynamic from "next/dynamic";

import { log } from "@vendor/observability/log";

import { getEarlyAccessCountSafe } from "./api/get-early-access-count";

const EarlyAccountCountUpdater = dynamic(
  () =>
    import("./early-access-count-updater").then(
      (mod) => mod.EarlyAccountCountUpdater,
    ),
  {
    ssr: true,
    loading: () => <span className="font-semibold">0</span>,
  },
);

export async function EarlyAccessCountServer() {
  const countResult = await getEarlyAccessCountSafe({ logger: log });

  if (countResult.isErr()) {
    return null;
  }

  const count = countResult.value;

  return (
    <div className="col-span-12 mt-2 text-center duration-500 animate-in fade-in">
      <p className="text-xs text-muted-foreground">
        Join{" "}
        <span className="font-semibold">
          <EarlyAccountCountUpdater waitlistCount={count} />
        </span>{" "}
        others on the waitlist 🚀
      </p>
    </div>
  );
}
