"use client";

import { useCallback } from "react";
import Cookies from "js-cookie";

import { REQUEST_ID_HEADER } from "../constants";

/**
 * Hook for managing request IDs in client-side code
 * Provides functions for getting, setting, and working with request IDs
 */
export function useRequestId() {
  /**
   * Gets the current request ID from the secure cookie
   */
  const getRequestId = useCallback((): string | undefined => {
    if (typeof document === "undefined") return undefined;
    return Cookies.get(REQUEST_ID_HEADER);
  }, []);

  /**
   * Sets the request ID in a secure cookie
   * Uses security flags to prevent common attack vectors:
   * - Secure: Only sent over HTTPS
   * - SameSite=Strict: Prevents CSRF attacks
   * - path=/: Available across the site
   */
  const setRequestId = useCallback((requestId: string) => {
    if (typeof document === "undefined") return;

    Cookies.set(REQUEST_ID_HEADER, requestId, {
      path: "/",
      secure: true,
      sameSite: "Strict",
    });
  }, []);

  /**
   * Updates the stored request ID from a response's headers
   * Returns the new request ID if one was found
   */
  const updateRequestIdFromResponse = useCallback(
    (response: Response): string | undefined => {
      const responseRequestId =
        response.headers.get(REQUEST_ID_HEADER) ?? undefined;
      if (responseRequestId) {
        setRequestId(responseRequestId);
      }
      return responseRequestId;
    },
    [setRequestId],
  );

  /**
   * Adds the current request ID to a Headers object if one exists
   */
  const addRequestIdToHeaders = useCallback(
    (headers: Headers): void => {
      const currentRequestId = getRequestId();
      if (currentRequestId) {
        headers.set(REQUEST_ID_HEADER, currentRequestId);
      }
    },
    [getRequestId],
  );

  /**
   * Clears the request ID cookie
   */
  const clearRequestId = useCallback(() => {
    if (typeof document === "undefined") return;
    Cookies.remove(REQUEST_ID_HEADER, { path: "/" });
  }, []);

  return {
    getRequestId,
    setRequestId,
    updateRequestIdFromResponse,
    addRequestIdToHeaders,
    clearRequestId,
  };
}
