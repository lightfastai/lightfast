"use client";

import type { ColorMode } from "@knocklabs/react";
import {
  KnockFeedProvider,
  KnockProvider,
} from "@knocklabs/react";
import type { ReactNode } from "react";
import { env } from "../env";

const knockApiKey = env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY;
const knockFeedChannelId = "lightfast-console-notifications";

interface NotificationsProviderProps {
  children: ReactNode;
  userId: string;
  userToken?: string | null;
}

export const NotificationsProvider = ({
  children,
  userId,
  userToken,
}: NotificationsProviderProps) => {
  if (!knockApiKey) {
    return children;
  }

  // Don't render Knock context until we have a valid user token (for enhanced security)
  // Only skip waiting if userToken is explicitly null (API key not configured)
  if (userToken === undefined) {
    return children;
  }

  return (
    <KnockProvider
      apiKey={knockApiKey}
      userId={userId}
      userToken={userToken ?? undefined}
    >
      <KnockFeedProvider colorMode={"dark" as ColorMode} feedId={knockFeedChannelId}>
        {children}
      </KnockFeedProvider>
    </KnockProvider>
  );
};
