// InfoCard.tsx
import React from "react";

import { Card, CardContent, CardHeader } from "@repo/ui/components/ui/card";
import { Label } from "@repo/ui/components/ui/label";
import { cn } from "@repo/ui/lib/utils";

/**
 * Represents a single label-value pair in the InfoCard.
 */
export interface InfoCardItem {
  /** The label for the item (e.g., "Zoom") */
  label: string;

  /** The value corresponding to the label. Can be a string, number, or any React node */
  value: React.ReactNode;
}

/**
 * Props for the InfoCard component.
 */
export interface InfoCardProps {
  /** The title displayed in the CardHeader */
  title: string;

  /** An array of label-value pairs to display in the CardContent */
  items: InfoCardItem[];

  /** Optional additional class names for the Card component */
  className?: string;
}

/**
 * InfoCard Component
 *
 * @param {InfoCardProps} props - The props for the component.
 * @returns {JSX.Element} The rendered InfoCard component.
 */
export const InfoCard: React.FC<InfoCardProps> = ({
  title,
  items,
  className,
}) => {
  return (
    <Card className={cn("w-full rounded-md", className)}>
      <CardHeader className="flex font-mono text-xs uppercase text-muted-foreground">
        <h3>{title}</h3>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-7 gap-4">
            <div className="col-span-3 flex">
              <Label className="font-mono text-xs uppercase text-muted-foreground">
                {item.label}
              </Label>
            </div>
            <div className="col-span-4 flex items-center">
              <Label className="max-w-full truncate font-mono text-xs text-muted-foreground">
                <span className="block truncate">{item.value}</span>
              </Label>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
