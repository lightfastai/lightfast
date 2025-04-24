"use client";

import { useEffect } from "react";
import { useAtom } from "jotai";

import { earlyAccesssCountAtom } from "./jotai/early-access-count-atom";

export function EarlyAccountCountUpdater({
  waitlistCount,
}: {
  waitlistCount: number;
}) {
  const [count, setCount] = useAtom(earlyAccesssCountAtom);

  useEffect(() => {
    setCount(waitlistCount);
  }, [waitlistCount, setCount]);

  return (
    <span className="font-semibold">
      {waitlistCount > count ? waitlistCount : count}
    </span>
  );
}
