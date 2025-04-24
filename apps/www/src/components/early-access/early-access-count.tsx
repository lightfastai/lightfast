import { getEarlyAccessCountSafe } from "./api/get-early-access-count";
import { EarlyAccountCountUpdater } from "./early-access-count-updater";

export async function EarlyAccessCount() {
  const result = await getEarlyAccessCountSafe();

  // If there's an error, don't show anything
  if (result.isErr()) {
    console.error("Failed to fetch early access count:", result.error);
    return null;
  }

  const count = result.value;

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
