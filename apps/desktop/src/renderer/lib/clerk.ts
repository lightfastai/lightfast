import type {
  FapiRequestInit,
  FapiResponse,
} from "@clerk/clerk-js/dist/types/core/fapiClient";
import { BuildClerkOptions } from "@/renderer/types/clerk";
import { Clerk } from "@clerk/clerk-js/headless";

import { sendToken } from "../helpers/ipc/clerk-actions";

const KEY = "__clerk_client_jwt";

// Cache the Clerk session
const MemoryTokenCache = {
  async getToken(key: string) {
    return await window.electron.ipcRenderer.invoke("auth:token:get", key);
  },
  async saveToken(key: string, token: string) {
    return window.electron.ipcRenderer.send("auth:token", token, key);
  },
  clearToken(key: string) {
    sendToken(null, key);
  },
};

let __internal_clerk: Clerk | undefined;

export function createClerkInstance(ClerkClass: typeof Clerk) {
  return (options?: BuildClerkOptions): Clerk => {
    const {
      publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
        process.env.CLERK_PUBLISHABLE_KEY ||
        "",
      tokenCache = MemoryTokenCache,
    } = options || {};

    if (!__internal_clerk && !publishableKey) {
      throw new Error("Missing Publishable Key");
    }

    // Support "hot-swapping" the Clerk instance at runtime. See JS-598 for additional details.
    const hasKeyChanged =
      __internal_clerk &&
      !!publishableKey &&
      publishableKey !== __internal_clerk.publishableKey;

    if (!__internal_clerk || hasKeyChanged) {
      if (hasKeyChanged) {
        tokenCache.clearToken?.(KEY);
      }

      const getToken = tokenCache.getToken;
      const saveToken = tokenCache.saveToken;
      __internal_clerk = new ClerkClass(publishableKey);

      // This is an internal API
      __internal_clerk.__unstable__onBeforeRequest(
        async (requestInit: FapiRequestInit) => {
          // https://reactnative.dev/docs/0.61/network#known-issues-with-fetch-and-cookie-based-authentication
          requestInit.credentials = "omit";

          // Instructs the backend to parse the api token from the Authorization header.
          requestInit.url?.searchParams.append("_is_native", "1");

          const jwt = await getToken(KEY);
          (requestInit.headers as Headers).set("authorization", jwt || "");
        },
      );

      // @ts-expect-error - This is an internal API
      __internal_clerk.__unstable__onAfterResponse(
        async (_: FapiRequestInit, response: FapiResponse<unknown>) => {
          const authHeader = response.headers.get("authorization");
          if (authHeader) {
            await saveToken(KEY, authHeader);
          }
        },
      );
    }
    return __internal_clerk!;
  };
}

export const getClerkInstance = createClerkInstance(Clerk);
