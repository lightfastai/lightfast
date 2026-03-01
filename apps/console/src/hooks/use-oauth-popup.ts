"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/components/ui/sonner";
import { useTRPC } from "@repo/console-trpc/react";

interface UseOAuthPopupOptions {
  provider: "github" | "vercel" | "linear" | "sentry";
  messageType?: string;
  queryKeysToInvalidate: readonly (readonly unknown[])[];
  popupWindowName?: string;
  onSuccess?: () => void;
  errorMessage?: string;
}

interface UseOAuthPopupReturn {
  handleConnect: () => Promise<void>;
  openCustomUrl: (
    buildUrl: (data: { url: string; state: string }) => string,
  ) => Promise<void>;
}

export function useOAuthPopup({
  provider,
  messageType,
  queryKeysToInvalidate,
  popupWindowName,
  onSuccess,
  errorMessage,
}: UseOAuthPopupOptions): UseOAuthPopupReturn {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successReceivedRef = useRef(false);

  // Keep latest values in refs so the effect doesn't re-subscribe on every render
  const queryKeysRef = useRef(queryKeysToInvalidate);
  queryKeysRef.current = queryKeysToInvalidate;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const resolvedMessageType = messageType ?? `${provider}_connected`;
  const resolvedWindowName = popupWindowName ?? `${provider}-install`;
  const capitalizedProvider = provider.charAt(0).toUpperCase() + provider.slice(1);
  const resolvedErrorMessage =
    errorMessage ??
    `Failed to connect to ${capitalizedProvider}. Please try again.`;

  const invalidateAll = useCallback(() => {
    successReceivedRef.current = true;
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    for (const queryKey of queryKeysRef.current) {
      void queryClient.invalidateQueries({ queryKey: queryKey as unknown[] });
    }
    onSuccessRef.current?.();
  }, [queryClient]);

  // Listen for OAuth completion via BroadcastChannel (primary) and postMessage (fallback)
  useEffect(() => {
    // Primary: BroadcastChannel (works regardless of window.opener / COOP)
    const channel = new BroadcastChannel("oauth-connections");
    channel.onmessage = (event: MessageEvent) => {
      if ((event.data as { type?: string }).type === resolvedMessageType)
        invalidateAll();
    };

    // Fallback: postMessage (works if window.opener is available)
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string }).type === resolvedMessageType)
        invalidateAll();
    };
    window.addEventListener("message", handler);

    return () => {
      channel.close();
      window.removeEventListener("message", handler);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, [invalidateAll, resolvedMessageType]);

  const openPopupAndPoll = useCallback(
    (url: string, windowName: string) => {
      const width = 600;
      const height = 800;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        url,
        windowName,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
      );
      if (!popup || popup.closed) {
        alert("Popup was blocked. Please allow popups for this site.");
        return;
      }
      successReceivedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        if (popup.closed) {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          // Delayed fallback: COOP may cause popup.closed to fire before OAuth completes.
          // BroadcastChannel is the primary mechanism; this is a safety net.
          if (!successReceivedRef.current) {
            fallbackTimerRef.current = setTimeout(() => {
              if (!successReceivedRef.current) {
                for (const queryKey of queryKeysRef.current) {
                  void queryClient.invalidateQueries({
                    queryKey: queryKey as unknown[],
                  });
                }
                onSuccessRef.current?.();
              }
            }, 3000);
          }
        }
      }, 500);
    },
    [queryClient],
  );

  const handleConnect = useCallback(async () => {
    try {
      const data = await queryClient.fetchQuery(
        trpc.connections.getAuthorizeUrl.queryOptions({ provider }),
      );
      openPopupAndPoll(data.url, resolvedWindowName);
    } catch {
      toast.error(resolvedErrorMessage);
    }
  }, [queryClient, trpc, provider, resolvedWindowName, resolvedErrorMessage, openPopupAndPoll]);

  const openCustomUrl = useCallback(
    async (buildUrl: (data: { url: string; state: string }) => string) => {
      try {
        const data = await queryClient.fetchQuery(
          trpc.connections.getAuthorizeUrl.queryOptions({ provider }),
        );
        openPopupAndPoll(buildUrl(data), resolvedWindowName);
      } catch {
        toast.error(resolvedErrorMessage);
      }
    },
    [queryClient, trpc, provider, resolvedWindowName, resolvedErrorMessage, openPopupAndPoll],
  );

  return { handleConnect, openCustomUrl };
}
