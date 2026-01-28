import posthog from "posthog-js";
import { posthogEnv } from "../../../env";

/**
 * Initialize PostHog analytics.
 * Call this from your app's instrumentation-client.ts file.
 *
 * @param options.baseUrl - Base URL for the app (used to construct /ingest proxy path)
 */
export const initializePostHogAnalytics = (options: { baseUrl: string }) => {
  if (typeof window === "undefined") return;

  posthog.init(posthogEnv.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: `${options.baseUrl}/ingest`,
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // Manual tracking via PostHogPageView
  });
};
