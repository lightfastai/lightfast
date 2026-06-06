import { cn } from "@repo/ui/lib/utils";
import type { FC } from "react";
import type { ConnectorProvider } from "./connectors-model";

interface ConnectorIconProps {
  className?: string;
  provider: ConnectorProvider;
}

function LinearMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 100 100"
    >
      <path d="M12.9266 16.3713c-.5283.5806-.4933 1.4714.0617 2.0265l68.5946 68.5946c.5551.555 1.4459.59 2.0265.0617 10.0579-9.1522 16.3713-22.3478 16.3713-37.0179C99.9807 22.402 77.5788 0 49.9445 0 35.2744 0 22.0788 6.31337 12.9266 16.3713ZM4.35334 29.3894c-.25348.5589-.12567 1.2142.30824 1.6481L68.9432 95.3191c.4339.4339 1.0892.5617 1.6481.3083 1.485-.6736 2.9312-1.4176 4.3344-2.2277.8341-.4815.9618-1.6195.2808-2.3005L8.88146 24.7742c-.68097-.681-1.81894-.5532-2.30045.2808-.81013 1.4032-1.55411 2.8494-2.22767 4.3344ZM.453579 47.796c-.300979-.301-.46112014-.7158-.4327856-1.1405.1327026-1.9891.3816396-3.9463.7400796-5.865.214926-1.1505 1.620727-1.5497 2.448307-.7222L59.9124 96.7715c.8275.8276.4283 2.2334-.7222 2.4483-1.9187.3585-3.8759.6074-5.865.7401-.4247.0283-.8395-.1318-1.1405-.4328L.453579 47.796ZM3.93331 61.7589c-1.0331-1.0331-2.70028-.1429-2.32193 1.2683C6.22104 80.2203 19.7604 93.7597 36.9535 98.3693c1.4112.3784 2.3014-1.2888 1.2683-2.3219L3.93331 61.7589Z" />
    </svg>
  );
}

function XMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="12"
      viewBox="0 0 100 100"
    >
      <path d="M18 18 82 82" />
      <path d="M82 18 18 82" />
    </svg>
  );
}

const marks: Record<ConnectorProvider, FC<{ className?: string }>> = {
  linear: LinearMark,
  x: XMark,
};

export function ConnectorIcon({ className, provider }: ConnectorIconProps) {
  const Mark = marks[provider];
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-transparent text-foreground",
        className
      )}
    >
      {Mark ? <Mark className="size-5" /> : null}
    </span>
  );
}
