import "server-only";

import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { headers } from "next/headers";
import { cache } from "react";

import type { CloudAppRouter } from "@api/cloud";
import { cloudAppRouter, createCloudContext, createCallerFactory } from "@api/cloud";
import { $TRPCHeaderName } from "@vendor/trpc";
import { createQueryClient } from "./query-client";

/**
 * This wraps the `createCloudContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(() => {
  const heads = new Headers(headers());
  heads.set($TRPCHeaderName.enum["x-lightfast-trpc-source"], "lightfast-cloud-rsc");

  return createCloudContext({
    headers: heads,
  });
});

const getQueryClient = cache(createQueryClient);
const caller = createCallerFactory(cloudAppRouter)(createContext);

export const { trpc, HydrateClient } = createHydrationHelpers<CloudAppRouter>(
  caller,
  getQueryClient,
);