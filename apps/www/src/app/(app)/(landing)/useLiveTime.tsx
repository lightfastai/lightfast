"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@repo/ui/components/ui/button";

export function CurrentTimeButton() {
  const date = useMemo<string>(() => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }, []);

  const [time, setTime] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // const handleClick = () => {
  //   toast({
  //     title: "Automation Notification",
  //     description: (
  //       <div className="flex flex-col gap-1">
  //         <span className="font-medium">
  //           This is a MacOS-style notification.
  //         </span>
  //         <span className="text-muted-foreground text-xs">
  //           You can customize this content.
  //         </span>
  //       </div>
  //     ),
  //     className:
  //       "bg-background/90 border border-border shadow-2xl rounded-xl p-4 w-80",
  //     duration: 5000,
  //   });
  // };

  return (
    <Button
      variant="ghost"
      aria-label="Show notifications"
      // onClick={handleClick}
      size="xs"
      className="rounded-md px-2"
    >
      <div className="flex items-center gap-2 text-xs">
        <span>{date}</span>
        <span>{time}</span>
      </div>
    </Button>
  );
}
