"use client";

import type { ReactNode } from "react";
import posthogRaw from "posthog-js";
import { PostHogProvider as PostHogProviderRaw } from "posthog-js/react";

import { env } from "~/env";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const analytics = posthogRaw.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: "/ingest",
  ui_host: env.NEXT_PUBLIC_POSTHOG_HOST,
  person_profiles: "identified_only",
  capture_pageview: false, // Disable automatic pageview capture, as we capture manually
  capture_pageleave: true, // Overrides the `capture_pageview` setting
})!;

interface PostHogProviderProps {
  readonly children: ReactNode;
}

export const PostHogProvider = (
  properties: Omit<PostHogProviderProps, "client">,
) => <PostHogProviderRaw client={analytics} {...properties} />;
