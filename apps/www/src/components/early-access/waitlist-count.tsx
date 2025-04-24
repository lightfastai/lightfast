import { getWaitlistCountSafe } from "./upstash";

export async function WaitlistCount() {
  const result = await getWaitlistCountSafe();

  // If there's an error, don't show anything
  if (result.isErr()) {
    console.error("Failed to fetch waitlist count:", result.error);
    return null;
  }

  const count = result.value;

  return (
    <div className="col-span-12 mt-2 text-center duration-500 animate-in fade-in">
      <p className="text-xs text-muted-foreground">
        Join <span className="font-semibold">{count}</span> others on the
        waitlist 🚀
      </p>
    </div>
  );
}
