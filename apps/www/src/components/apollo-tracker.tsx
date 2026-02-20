"use client";

import Script from "next/script";

export function ApolloTracker() {
  return (
    <Script
      src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js"
      strategy="afterInteractive"
      onLoad={() => {
        (window as any).trackingFunctions.onLoad({
          appId: "699803948d160c00210042bd",
        });
      }}
    />
  );
}
