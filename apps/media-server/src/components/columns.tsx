"use client";

import { Column, ColumnDef } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  CircleDotDashed,
  FileText,
  Image,
  Video,
} from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";

import type { Resource } from "~/stores/resources";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="data-[state=open]:bg-accent -ml-3 h-8"
          >
            <span>{title}</span>
            {column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp className="text-muted-foreground/70 mr-2 h-3.5 w-3.5" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown className="text-muted-foreground/70 mr-2 h-3.5 w-3.5" />
            Desc
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const RESOURCE_STATUS_OPTIONS = [
  { label: "Init", value: "init" },
  { label: "In Queue", value: "in_queue" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

const RESOURCE_TYPE_OPTIONS = [
  { label: "Image", value: "image", icon: Image },
  { label: "Video", value: "video", icon: Video },
  { label: "Text", value: "text", icon: FileText },
];

export const columns: ColumnDef<Resource>[] = [
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    enableSorting: true,
    meta: {
      type: "option",
      displayName: "Status",
      icon: CircleDotDashed,
      options: RESOURCE_STATUS_OPTIONS,
    },
  },
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Run ID" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-xs">{row.getValue("id")}</div>
    ),
    enableSorting: true,
    meta: {
      type: "text",
      displayName: "Run ID",
      icon: FileText,
    },
  },
  {
    accessorKey: "engine",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Engine" />
    ),
    enableSorting: true,
    meta: {
      type: "text",
      displayName: "Engine",
      icon: FileText,
    },
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    enableSorting: true,
    meta: {
      type: "option",
      displayName: "Type",
      icon: FileText,
      options: RESOURCE_TYPE_OPTIONS,
    },
  },
  {
    accessorKey: "external_request_id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created at" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("external_request_id");
      return value ?? <span className="text-muted-foreground">—</span>;
    },
    enableSorting: true,
    meta: {
      type: "text",
      displayName: "Created at",
      icon: FileText,
    },
  },
  {
    id: "resource",
    header: "Resource",
    cell: ({ row }) => {
      const resource = row.original;
      if (resource.type === "image" && resource.url) {
        return (
          <img
            src={resource.url}
            alt="Resource"
            className="h-12 rounded shadow"
          />
        );
      }
      if (resource.type === "video" && resource.url) {
        return (
          <video src={resource.url} className="h-12 rounded shadow" controls />
        );
      }
      if (resource.type === "text" && resource.data) {
        return (
          <span className="whitespace-pre-wrap">{String(resource.data)}</span>
        );
      }
      return <span className="text-muted-foreground">—</span>;
    },
  },
];
