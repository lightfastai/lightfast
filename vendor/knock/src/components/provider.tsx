"use client";

import type { ColorMode } from "@knocklabs/react";
import {
  KnockFeedProvider,
  KnockProvider,
} from "@knocklabs/react";
import type { ReactNode } from "react";
import { env } from "../env";

const knockApiKey = env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY;
const knockFeedChannelId = env.NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID;

interface NotificationsProviderProps {
  children: ReactNode;
  userId: string;
}

export const NotificationsProvider = ({
  children,
  userId,
}: NotificationsProviderProps) => {
  if (!knockApiKey) {
    return children;
  }

  return (
    <KnockProvider apiKey={knockApiKey} userId={userId}>
      <KnockFeedProvider colorMode={"dark" as ColorMode} feedId={knockFeedChannelId}>
        {children}
      </KnockFeedProvider>
    </KnockProvider>
  );
};
