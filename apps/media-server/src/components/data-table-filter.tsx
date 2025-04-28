"use client";

import { Column, Table } from "@tanstack/react-table";
import { Plus, X } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";

import { type ColumnMeta } from "~/lib/filter";

interface DataTableFilterProps<TData> {
  table: Table<TData>;
}

export function DataTableFilter<TData>({ table }: DataTableFilterProps<TData>) {
  const filters = table.getState().columnFilters;

  return (
    <div className="flex items-center gap-2">
      {filters.map((filter) => {
        const column = table.getColumn(filter.id);
        const meta = column?.columnDef?.meta as ColumnMeta<TData, unknown>;
        if (!meta) return null;

        return (
          <div
            key={filter.id}
            className="bg-muted flex items-center gap-1 rounded-md px-2 py-1"
          >
            {meta.icon && <meta.icon className="h-4 w-4" />}
            <span className="text-sm">{meta.displayName}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1"
              onClick={() => column?.setFilterValue(undefined)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Plus className="mr-2 h-4 w-4" />
            Add filter
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search columns..." />
            <CommandList>
              <CommandEmpty>No columns found.</CommandEmpty>
              <CommandGroup>
                {table
                  .getAllColumns()
                  .filter((column): column is Column<TData, unknown> => {
                    if (!column || !column.getCanFilter()) return false;
                    const meta = column.columnDef.meta as ColumnMeta<
                      TData,
                      unknown
                    >;
                    return !!meta;
                  })
                  .map((column) => {
                    const meta = column.columnDef.meta as ColumnMeta<
                      TData,
                      unknown
                    >;
                    const isFiltered = filters.some(
                      (filter) => filter.id === column.id,
                    );

                    return (
                      <CommandItem
                        key={column.id}
                        onSelect={() => {
                          if (isFiltered) {
                            column.setFilterValue(undefined);
                          } else if (
                            meta.type === "option" &&
                            meta.options?.[0]
                          ) {
                            column.setFilterValue(meta.options[0].value);
                          } else {
                            column.setFilterValue("");
                          }
                        }}
                      >
                        {meta.icon && <meta.icon className="mr-2 h-4 w-4" />}
                        {meta.displayName}
                        {isFiltered && (
                          <X className="text-muted-foreground ml-auto h-4 w-4" />
                        )}
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
