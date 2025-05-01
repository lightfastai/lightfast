"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { parseAsJson, useQueryState } from "nuqs";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/ui/pagination";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { cn } from "@repo/ui/lib/utils";
import { trpc } from "@vendor/trpc/client/server";

import type { Resource } from "~/stores/resources";
import { useResources } from "~/hooks/use-resources";
import {
  dataTableFilterQuerySchema,
  initializeFiltersFromQuery,
} from "~/lib/filter";
import { columns } from "./columns";

function ExpandedContent({ resource }: { resource: Resource }) {
  const data = resource.data as Record<string, string>;
  const { data: runData } = useQuery(trpc.app.health.health.queryOptions());

  useEffect(() => {
    console.log(runData);
  }, [runData]);

  return (
    <div className="bg-muted/50 px-8 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium">Details</h4>
          <div className="mt-2 space-y-2">
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
          <div className="bg-card mt-2 rounded-md border p-4">
            <pre className="text-sm whitespace-pre-wrap">
              <code className="text-[#292D3E]">
                <span className="text-[#89DDFF]">{"{"}</span>
                {Object.entries(data).map(([key, value], i, arr) => (
                  <div key={key} className="ml-4">
                    <span className="text-[#C792EA]">"{key}"</span>
                    <span className="text-[#89DDFF]">: </span>
                    <span className="text-[#C3E88D]">"{String(value)}"</span>
                    <span className="text-[#89DDFF]">
                      {i === arr.length - 1 ? "" : ","}
                    </span>
                  </div>
                ))}
                <span className="text-[#89DDFF]">{"}"}</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RunsTable() {
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
  const [pageSize, setPageSize] = useState<number>(50);
  const [cursors, setCursors] = useState<
    Array<{ created_at: string; id: string }>
  >([]);
  const [currentPage, setCurrentPage] = useState(0);

  const { resources, loading, totalCount } = useResources(
    {
      pageSize,
      cursor: currentPage > 0 ? cursors[currentPage - 1] : undefined,
    },
    sorting.length > 0 ? sorting[0] : undefined,
  );

  // Update cursors when new data is received
  useEffect(() => {
    if (resources.length > 0) {
      const lastItem = resources[resources.length - 1];
      // Only update cursor if we're on the current page and we have created_at and id
      if (
        currentPage === cursors.length &&
        lastItem?.created_at &&
        lastItem?.id
      ) {
        setCursors((prev) => [
          ...prev,
          {
            created_at: lastItem.created_at,
            id: lastItem.id,
          },
        ]);
      }
    }
  }, [resources, currentPage, cursors.length]);

  const table = useReactTable({
    data: resources,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pageSize),
    onPaginationChange: (updater) => {
      if (typeof updater === "function") {
        const newState = updater({
          pageIndex: currentPage,
          pageSize,
        });
        setCurrentPage(newState.pageIndex);
        setPageSize(newState.pageSize);
      } else {
        setCurrentPage(updater.pageIndex);
        setPageSize(updater.pageSize);
      }
    },
    state: {
      sorting,
      columnFilters,
      pagination: {
        pageSize,
        pageIndex: currentPage,
      },
    },
  });

  // Reset cursors when sorting or page size changes
  useEffect(() => {
    setCursors([]);
    setCurrentPage(0);
  }, [sorting, pageSize]);

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

  const renderPageNumbers = () => {
    const currentPage = table.getState().pagination.pageIndex + 1;
    const totalPages = table.getPageCount();
    const pages: number[] = [];

    // Always show first page
    pages.push(1);

    // Show pages around current page
    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      if (i > 1 && i < totalPages) {
        pages.push(i);
      }
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    // Add ellipsis where needed
    const deduped = Array.from(new Set(pages)).sort((a, b) => a - b);
    const withEllipsis: (number | "...")[] = [];
    deduped.forEach((page, i) => {
      const prevPage = deduped[i - 1];
      if (i > 0 && prevPage !== undefined && page !== prevPage + 1) {
        withEllipsis.push("...");
      }
      withEllipsis.push(page);
    });

    return withEllipsis;
  };

  return (
    <div className="flex h-full flex-col">
      {/* <div className="px-8 py-4">
        <DataTableFilter table={table} />
      </div> */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="w-full">
          <Table className="w-full table-fixed">
            <TableHeader className="bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <TableHead className="w-[40px] px-8" />
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="px-8 whitespace-nowrap"
                      style={{ width: header.getSize() }}
                    >
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
          </Table>
        </div>
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <Table className="w-full table-fixed">
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
                ) : table.getRowModel().rows.length === 0 ? (
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
                          <TableCell
                            key={cell.id}
                            className="px-8 whitespace-nowrap"
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                      {expandedRows[row.id] && (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length + 1}
                            className="p-0"
                          >
                            <ExpandedContent
                              resource={row.original as Resource}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        <div className="bg-background flex items-center justify-between border-t px-8 py-2">
          <div className="flex items-center gap-4">
            <div className="text-muted-foreground text-xs">
              {totalCount} total runs
            </div>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                const newSize = Number(value);
                table.setPageSize(newSize);
              }}
            >
              <SelectTrigger className="h-8 w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto">
            <Pagination className="p-0">
              <PaginationContent className="p-0">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (table.getCanPreviousPage()) {
                        table.previousPage();
                      }
                    }}
                    aria-disabled={!table.getCanPreviousPage()}
                  />
                </PaginationItem>
                {renderPageNumbers().map((page, i) => (
                  <PaginationItem key={i}>
                    {page === "..." ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          table.setPageIndex(Number(page) - 1);
                        }}
                        isActive={currentPage === Number(page) - 1}
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (table.getCanNextPage()) {
                        table.nextPage();
                      }
                    }}
                    aria-disabled={!table.getCanNextPage()}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>
    </div>
  );
}
