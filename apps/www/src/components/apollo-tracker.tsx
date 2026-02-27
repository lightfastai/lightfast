"use client";

import Script from "next/script";

interface ApolloTrackerWindow {
  trackingFunctions: {
    onLoad: (config: { appId: string }) => void;
  };
}

export function ApolloTracker() {
  return (
    <Script
      src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js"
      strategy="afterInteractive"
      onLoad={() => {
        const w = window as unknown as ApolloTrackerWindow;
        w.trackingFunctions.onLoad({
          appId: "699803948d160c00210042bd",
        });
      }}
    />
  );
}
