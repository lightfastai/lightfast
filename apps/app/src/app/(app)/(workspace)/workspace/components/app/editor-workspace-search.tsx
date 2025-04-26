import { Search } from "lucide-react";

import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";

interface SearchFormProps {
  value: string;
  onChange: (value: string) => void;
}

export function EditorWorkspaceSearch({ value, onChange }: SearchFormProps) {
  return (
    <div className="relative w-full">
      <Label htmlFor="search" className="sr-only">
        Search
      </Label>
      <Input
        id="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Find workspace..."
        className="rounded-none border-none pl-8"
      />
      <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
    </div>
  );
}
