"use client";

import { useEffect } from "react";
import { useAtom } from "jotai";

import { earlyAccessCountAtom } from "./jotai/early-access-count-atom";

export function EarlyAccountCountUpdater({
  waitlistCount,
}: {
  waitlistCount: number;
}) {
  const [count, setCount] = useAtom(earlyAccessCountAtom);

  useEffect(() => {
    setCount(waitlistCount);
  }, [waitlistCount, setCount]);

  return (
    <span className="font-semibold">
      {waitlistCount > count ? waitlistCount : count}
    </span>
  );
}
