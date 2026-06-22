"use client";

import { Button } from "@repo/ui-v2/components/ui/button";
import { Sheet, SheetTrigger } from "@repo/ui-v2/components/ui/sheet";
import { cn } from "@repo/ui-v2/lib/utils";
import dynamic from "next/dynamic";
import { type ReactNode, useState } from "react";

const CompanySheet = dynamic(
  () => import("./company-sheet").then((mod) => mod.CompanySheet),
  { ssr: false }
);

export function Company({
  children = "Company",
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setMounted(true);
    }
    setOpen(nextOpen);
  }

  return (
    <Sheet onOpenChange={handleOpenChange} open={open}>
      <SheetTrigger
        render={
          <Button
            className={cn(
              "cursor-pointer",
              className ?? "h-8 px-0 font-medium text-sm"
            )}
            data-company-trigger
            data-popup-open={open ? "" : undefined}
            type="button"
            variant="link"
          />
        }
      >
        {children}
      </SheetTrigger>
      {mounted ? <CompanySheet /> : null}
    </Sheet>
  );
}
