"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

interface UseSentryIdentifierProps {
  userId: string;
}

export function SentryIdentifier({ userId }: UseSentryIdentifierProps) {
  useEffect(() => {
    Sentry.setUser({
      id: userId,
    });
  }, [userId]);

  return null;
}
