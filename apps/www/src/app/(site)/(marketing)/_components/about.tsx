"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";

const AboutSheet = dynamic(
  () => import("./about-sheet").then((mod) => mod.AboutSheet),
  { ssr: false }
);

export function About({
  children = "About",
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-transparent bg-transparent bg-clip-padding px-0 text-primary underline-offset-4 outline-none transition-all select-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 ${className ?? "h-8 font-medium text-sm"}`}
        data-about-trigger
        data-popup-open={open ? "" : undefined}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        type="button"
      >
        {children}
      </button>
      {mounted ? <AboutSheet onOpenChange={setOpen} open={open} /> : null}
    </>
  );
}
