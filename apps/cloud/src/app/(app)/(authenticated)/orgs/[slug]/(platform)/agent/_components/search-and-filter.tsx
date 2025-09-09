"use client";

import { Search } from "lucide-react";
import { Input } from "@repo/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";

interface SearchAndFilterProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  totalItems: number;
}

export function SearchAndFilter({ 
  searchTerm, 
  onSearchChange, 
  filter, 
  onFilterChange, 
  totalItems 
}: SearchAndFilterProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={filter} onValueChange={onFilterChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            <SelectItem value="deployed">Deployed</SelectItem>
            <SelectItem value="recent">Recently updated</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="text-sm text-muted-foreground">
        {totalItems} {totalItems === 1 ? 'agent' : 'agents'}
      </div>
    </div>
  );
}