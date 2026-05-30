import {
  WORKSPACE_SIGNALS_LIMIT,
  WORKSPACE_SIGNALS_WINDOW_DAYS,
} from "@repo/api-contract";

/**
 * Additive banner shown only when the working set is clipped by the cap. Makes
 * the in-memory filtering honest: filters are complete within the window, and
 * any clipping is visible. Silent truncation is forbidden.
 */
export function SignalsTruncationBanner({ truncated }: { truncated: boolean }) {
  if (!truncated) {
    return null;
  }
  return (
    <div
      className="mx-3 mb-2 rounded-lg border border-border/70 bg-muted/25 px-4 py-2 text-muted-foreground text-sm"
      data-testid="signals-truncation-banner"
      role="status"
    >
      Showing the {WORKSPACE_SIGNALS_LIMIT.toLocaleString()} most recent of the
      last {WORKSPACE_SIGNALS_WINDOW_DAYS} days — filters apply to this window.
    </div>
  );
}
