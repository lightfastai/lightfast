import "server-only";

import { appRouter, createCallerFactory, createTRPCContext } from "@api/app";
import {
  NATIVE_AUTH_HEADERS,
  type NativeClient,
} from "@repo/native-auth-contract";

const createCaller = createCallerFactory(appRouter);

export async function createNativeOAuthFacadeCaller(input: {
  headers: Headers;
  source: NativeClient;
}) {
  const headers = new Headers(input.headers);
  headers.set("x-trpc-source", input.source);
  headers.set(NATIVE_AUTH_HEADERS.client, input.source);

  return createCaller(await createTRPCContext({ headers }));
}
