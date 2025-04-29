"use client";

import { Column, ColumnDef } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronsUpDown,
  CircleDashed,
  CircleDotDashed,
  FileText,
  Image,
  Loader2,
  TimerIcon,
  Video,
  XCircle,
} from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
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

const RESOURCE_STATUS_CONFIG = {
  init: { label: "Init", icon: CircleDashed, color: "text-muted-foreground" },
  in_queue: { label: "In Queue", icon: TimerIcon, color: "text-yellow-500" },
  processing: { label: "Processing", icon: Loader2, color: "text-blue-500" },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-green-500",
  },
  failed: { label: "Failed", icon: XCircle, color: "text-red-500" },
} as const;

const RESOURCE_STATUS_OPTIONS = Object.entries(RESOURCE_STATUS_CONFIG).map(
  ([value, config]) => ({
    label: config.label,
    value,
  }),
);

const RESOURCE_TYPE_OPTIONS = [
  { label: "Image", value: "image", icon: Image },
  { label: "Video", value: "video", icon: Video },
  { label: "Text", value: "text", icon: FileText },
];

export const columns: ColumnDef<Resource>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
    enableSorting: false,
    meta: {
      type: "text",
      displayName: "ID",
      icon: FileText,
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    enableSorting: false,
    cell: ({ row }) => {
      const status = row.getValue(
        "status",
      ) as keyof typeof RESOURCE_STATUS_CONFIG;
      const config = RESOURCE_STATUS_CONFIG[status];
      const Icon = config.icon;

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center">
                <Icon
                  className={cn("h-4 w-4", config.color, {
                    "animate-spin": status === "processing",
                  })}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{config.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
    meta: {
      type: "option",
      displayName: "Status",
      icon: CircleDotDashed,
      options: RESOURCE_STATUS_OPTIONS,
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
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created At" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("created_at"));
      return date.toLocaleString();
    },
    enableSorting: true,
    meta: {
      type: "text",
      displayName: "Created At",
      icon: FileText,
    },
  },
];
