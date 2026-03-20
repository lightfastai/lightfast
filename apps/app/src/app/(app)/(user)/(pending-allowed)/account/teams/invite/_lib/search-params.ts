import { createLoader, createSerializer, parseAsString } from "nuqs/server";
import type { Route } from "next";

export const inviteSearchParams = {
  teamSlug: parseAsString,
  error: parseAsString,
};

export const loadInviteSearchParams = createLoader(inviteSearchParams);
export const serializeInviteParams = createSerializer<
  typeof inviteSearchParams,
  Route<string>,
  Route<string>
>(inviteSearchParams);
