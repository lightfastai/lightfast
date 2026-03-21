import type { Route } from "next";
import { createLoader, createSerializer, parseAsString } from "nuqs/server";

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
