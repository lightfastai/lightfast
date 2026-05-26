import "server-only";

import { Unkey } from "@unkey/api";

import { unkeyEnv } from "./env";

let client: Unkey | undefined;

export type UnkeyClient = Unkey;

export function createUnkeyClient(rootKey = unkeyEnv.UNKEY_ROOT_KEY) {
  return new Unkey({ rootKey });
}

export function getUnkeyClient() {
  client ??= createUnkeyClient();
  return client;
}

export { unkeyEnv };
