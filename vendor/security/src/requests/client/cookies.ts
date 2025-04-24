import Cookies from "js-cookie";

import { REQUEST_ID_HEADER } from "../constants";

/**
 * Utility functions for managing request IDs in secure cookies
 * Used to maintain request ID state across client-side requests
 */

/**
 * Gets the current request ID from the secure cookie
 */
export const getRequestId = (): string | undefined => {
  if (typeof document === "undefined") return undefined;
  return Cookies.get(REQUEST_ID_HEADER);
};

/**
 * Sets the request ID in a secure cookie
 * Uses security flags to prevent common attack vectors:
 * - Secure: Only sent over HTTPS
 * - SameSite=Strict: Prevents CSRF attacks
 * - path=/: Available across the site
 */
export const setRequestId = (requestId: string) => {
  if (typeof document === "undefined") return;

  Cookies.set(REQUEST_ID_HEADER, requestId, {
    path: "/",
    secure: true,
    sameSite: "Strict",
  });
};

/**
 * Updates the stored request ID from a response's headers
 * Returns the new request ID if one was found
 */
export const updateRequestIdFromResponse = (
  response: Response,
): string | undefined => {
  const responseRequestId =
    response.headers.get(REQUEST_ID_HEADER) ?? undefined;
  if (responseRequestId) {
    setRequestId(responseRequestId);
  }
  return responseRequestId;
};

/**
 * Adds the current request ID to a Headers object if one exists
 */
export const addRequestIdToHeaders = (headers: Headers): void => {
  const currentRequestId = getRequestId();
  if (currentRequestId) {
    headers.set(REQUEST_ID_HEADER, currentRequestId);
  }

  console.log("currentRequestId", currentRequestId);
};

/**
 * Clears the request ID cookie
 */
export const clearRequestId = (): void => {
  if (typeof document === "undefined") return;
  Cookies.remove(REQUEST_ID_HEADER, { path: "/" });
};
