"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useRef } from "react";

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1001+", label: "1001+ employees" },
];

interface CompanySizeIslandProps {
  defaultValue: string;
  error?: string | null;
}

export function CompanySizeIsland({
  defaultValue,
  error,
}: CompanySizeIslandProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <label
        className="font-medium text-muted-foreground text-xs"
        htmlFor="companySize"
      >
        Company size
      </label>
      <input
        defaultValue={defaultValue}
        id="companySize"
        name="companySize"
        ref={inputRef}
        type="hidden"
      />
      <Select
        defaultValue={defaultValue}
        onValueChange={(v) => {
          if (inputRef.current) {
            inputRef.current.value = v;
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select company size" />
        </SelectTrigger>
        <SelectContent>
          {COMPANY_SIZES.map((size) => (
            <SelectItem key={size.value} value={size.value}>
              {size.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
