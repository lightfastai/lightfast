/**
 * Re-export posthog as analytics for consistent naming.
 * Use this for custom event tracking after initialization.
 *
 * @example
 * import { analytics } from "@vendor/analytics/posthog";
 * analytics.capture("my_event", { property: "value" });
 */
export { default as analytics } from "posthog-js";
