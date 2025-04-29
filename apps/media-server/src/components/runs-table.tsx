"use client";

import React, { useEffect, useState } from "react";
import {
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { parseAsJson, useQueryState } from "nuqs";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { cn } from "@repo/ui/lib/utils";

import type { Resource } from "~/stores/resources";
import { useResources } from "~/hooks/use-resources";
import {
  dataTableFilterQuerySchema,
  initializeFiltersFromQuery,
} from "~/lib/filter";
import { columns } from "./columns";
import { DataTableFilter } from "./data-table-filter";

function ExpandedContent({ resource }: { resource: Resource }) {
  return (
    <div className="bg-muted/50 px-8 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium">Details</h4>
          <div className="mt-2 space-y-2">
            <div>
              <span className="text-muted-foreground">ID:</span> {resource.id}
            </div>
            <div>
              <span className="text-muted-foreground">Engine:</span>{" "}
              {resource.engine}
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              {resource.type}
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              {resource.status}
            </div>
          </div>
        </div>
        <div>
          <h4 className="font-medium">Data</h4>
          <div className="mt-2">
            <pre className="text-muted-foreground text-sm whitespace-pre-wrap">
              {JSON.stringify(resource.data, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RunsTable() {
  const { resources, loading } = useResources();
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "created_at",
      desc: true,
    },
  ]);
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

  const toggleRow = (rowId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }));
  };

  return (
    <div className="divide-border divide-y">
      <div className="px-8 py-4">
        <DataTableFilter table={table} />
      </div>
      <div className="h-full">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                <TableHead className="w-[40px] px-8" />
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-8">
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
                  colSpan={columns.length + 1}
                  className="text-muted-foreground px-8 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : resources.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-muted-foreground px-8 text-center"
                >
                  No runs found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    className={cn(
                      "hover:bg-muted/50 cursor-pointer transition-colors",
                      expandedRows[row.id] && "bg-muted/50",
                    )}
                    onClick={() => toggleRow(row.id)}
                  >
                    <TableCell className="w-[40px] px-8">
                      <div className="flex size-6 items-center justify-center">
                        {expandedRows[row.id] ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </div>
                    </TableCell>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-8">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {expandedRows[row.id] && (
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={columns.length + 1} className="p-0">
                        <ExpandedContent resource={row.original as Resource} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
