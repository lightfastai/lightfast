"use client";

import { Button } from "@repo/ui-v2/components/ui/button";
import { Sheet, SheetTrigger } from "@repo/ui-v2/components/ui/sheet";
import { cn } from "@repo/ui-v2/lib/utils";
import { type ReactNode, useState } from "react";
import { CompanySheet } from "./company-sheet";

export function Company({
  children = "Company",
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
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
      <CompanySheet />
    </Sheet>
  );
}
