import { Card } from "@repo/ui-v2/components/ui/card";
import { Separator } from "@repo/ui-v2/components/ui/separator";
import { Fragment } from "react";
import {
  ACCELERATORS,
  type AcceleratorName,
  type FormatPlatform,
  formatAccelerator,
} from "../../../../../shared/accelerators";

const SHORTCUT_LABELS: Record<AcceleratorName, string> = {
  newWindow: "New primary window",
  settings: "Open settings",
  toggleSidebar: "Toggle sidebar",
};

export function Shortcuts({ platform }: { platform: FormatPlatform }) {
  const names = Object.keys(ACCELERATORS) as AcceleratorName[];
  return (
    <section className="mb-4 max-w-none">
      <Card className="gap-0 overflow-hidden py-0">
        {names.map((name, index) => (
          <Fragment key={name}>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="text-foreground text-xs">
                {SHORTCUT_LABELS[name]}
              </div>
              <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
                {formatAccelerator(ACCELERATORS[name], platform)}
              </kbd>
            </div>
            {index < names.length - 1 && <Separator />}
          </Fragment>
        ))}
      </Card>
    </section>
  );
}
