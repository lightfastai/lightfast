"use client";

import * as Sentry from "@sentry/nextjs";
import { useUser } from "@vendor/clerk/client";
import { useEffect } from "react";

export function SentryUserIdentification() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        username: user.username ?? undefined,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [user, isLoaded]);

  return null;
}
