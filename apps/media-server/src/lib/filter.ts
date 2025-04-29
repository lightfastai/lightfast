import { type ColumnDef } from "@tanstack/react-table";
import { type LucideIcon } from "lucide-react";
import { z } from "zod";

export type ColumnDataType =
  | "text" // Text data
  | "number" // Numerical data
  | "date" // Dates
  | "option" // Single-valued option (e.g. status)
  | "multiOption"; // Multi-valued option (e.g. labels)

export interface ColumnOption {
  // The label to display for the option
  label: string;
  // The internal value of the option
  value: string;
  // An optional icon to display next to the label
  icon?: LucideIcon;
}

export type ElementType<T> = T extends (infer U)[] ? U : T;

export interface ColumnMeta<TData, TValue> {
  // The display name of the column
  displayName: string;
  // The column icon
  icon: LucideIcon;
  // The data type of the column
  type: ColumnDataType;
  // An optional list of options for the column
  options?: ColumnOption[];
  // An optional function to transform columns with type 'option' or 'multiOption'
  transformOptionFn?: (value: ElementType<NonNullable<TValue>>) => ColumnOption;
  // An optional "soft" max for the range slider
  max?: number;
}

export const dataTableFilterQuerySchema = z
  .object({
    id: z.string(),
    value: z.object({
      operator: z.string(),
      values: z.any(),
    }),
  })
  .array()
  .min(0);

export type DataTableFilterQuerySchema = z.infer<
  typeof dataTableFilterQuerySchema
>;

export function initializeFiltersFromQuery<TData>(
  filters: DataTableFilterQuerySchema,
  columns: ColumnDef<TData, any>[],
) {
  return filters && filters.length > 0
    ? filters.map((f) => {
        const column = columns.find((c) => c.id === f.id)!;
        const columnMeta = column.meta as ColumnMeta<TData, any>;

        const values =
          columnMeta.type === "date"
            ? f.value.values.map((v: string) => new Date(v))
            : f.value.values;

        return {
          ...f,
          value: {
            operator: f.value.operator,
            values,
            columnMeta,
          },
        };
      })
    : [];
}

// Helper function to define column meta
export function defineMeta<TData, TValue>(
  accessor: (row: TData) => TValue,
  meta: Omit<ColumnMeta<TData, TValue>, "transformOptionFn"> & {
    transformOptionFn?: (
      value: ElementType<NonNullable<TValue>>,
    ) => ColumnOption;
  },
): ColumnMeta<TData, TValue> {
  return meta as ColumnMeta<TData, TValue>;
}
