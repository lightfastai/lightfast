import type { ReactNode } from "react";

import { PostHogProvider } from "./providers/posthog/client";
import { VercelAnalytics } from "./providers/vercel";

interface AnalyticsProviderProps {
  readonly children: ReactNode;
}

export const AnalyticsProvider = ({ children }: AnalyticsProviderProps) => (
  <PostHogProvider>
    {children}
    <VercelAnalytics />
  </PostHogProvider>
);
