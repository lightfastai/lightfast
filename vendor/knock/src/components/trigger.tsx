"use client";

import {
  NotificationFeedPopover,
  NotificationIconButton,
} from "@knocklabs/react";
import type { RefObject } from "react";
import { useRef, useState, Suspense } from "react";
import { env } from "../env";

import "@knocklabs/react/dist/index.css";
import "../styles.css";

function NotificationsTriggerContent() {
  const [isVisible, setIsVisible] = useState(false);
  const notifButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = (event: Event) => {
    if (event.target === notifButtonRef.current) {
      return;
    }
    setIsVisible(false);
  };

  return (
    <>
      <NotificationIconButton
        onClick={() => setIsVisible(!isVisible)}
        ref={notifButtonRef}
      />
      {notifButtonRef.current && (
        <NotificationFeedPopover
          buttonRef={notifButtonRef as RefObject<HTMLElement>}
          isVisible={isVisible}
          onClose={handleClose}
        />
      )}
    </>
  );
}

export const NotificationsTrigger = () => {
  if (!env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <NotificationsTriggerContent />
    </Suspense>
  );
};
