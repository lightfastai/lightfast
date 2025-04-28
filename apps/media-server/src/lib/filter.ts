import { type ColumnDef } from "@tanstack/react-table";
import { type LucideIcon } from "lucide-react";
import { z } from "zod";

export type ColumnMetaType = "date" | "option" | "text";

export interface ColumnOption {
  label: string;
  value: string;
}

export interface ColumnMeta<TData> {
  type: ColumnMetaType;
  displayName: string;
  icon?: LucideIcon;
  options?: ColumnOption[];
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
        const columnMeta = column.meta as ColumnMeta<TData>;

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
