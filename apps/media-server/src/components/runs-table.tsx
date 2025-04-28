"use client";

import { useEffect, useState } from "react";
import {
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { parseAsJson, useQueryState } from "nuqs";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";

import { useResources } from "~/hooks/use-resources";
import {
  dataTableFilterQuerySchema,
  initializeFiltersFromQuery,
} from "~/lib/filter";
import { columns } from "./columns";
import { DataTableFilter } from "./data-table-filter";

export function RunsTable() {
  const { resources, loading } = useResources();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [queryFilters, setQueryFilters] = useQueryState(
    "filter",
    parseAsJson(dataTableFilterQuerySchema.parse).withDefault([]),
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() =>
    initializeFiltersFromQuery(queryFilters, columns),
  );

  const table = useReactTable({
    data: resources,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  // Update URL when filters change
  useEffect(() => {
    setQueryFilters(
      columnFilters.map((f) => ({
        id: f.id,
        value: { ...(f.value as any), columnMeta: undefined },
      })),
    );
  }, [columnFilters, setQueryFilters]);

  return (
    <div className="space-y-4">
      <DataTableFilter table={table} />
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : resources.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground text-center"
                >
                  No runs found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
