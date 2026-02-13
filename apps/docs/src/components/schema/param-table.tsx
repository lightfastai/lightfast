import { getSchemaFields } from "~/lib/schema-reader";

interface ParamTableProps {
  /** OpenAPI schema name (e.g., "V1SearchRequest") */
  schema: string;
  /** Only show these fields (if specified) */
  include?: string[];
  /** Hide these fields */
  exclude?: string[];
  /** Override "Required" column to show "Default" column */
  showDefaults?: boolean;
}

export function ParamTable({
  schema,
  include,
  exclude,
  showDefaults = true,
}: ParamTableProps) {
  const fields = getSchemaFields(schema);
  const filtered = fields
    .filter((f) => !include || include.includes(f.name))
    .filter((f) => !exclude || !exclude.includes(f.name));

  return (
    <div className="my-10 w-full overflow-x-auto rounded-xs bg-card border border-transparent">
      <table className="w-full border-collapse">
        <thead className="border-b border-border/50">
          <tr className="border-b border-border/30 transition-colors hover:bg-muted/30">
            <th className="text-xs h-10 px-4 text-left align-middle font-semibold [&:has([role=checkbox])]:pr-0 break-words">Property</th>
            <th className="text-xs h-10 px-4 text-left align-middle font-semibold [&:has([role=checkbox])]:pr-0 break-words">Type</th>
            <th className="text-xs h-10 px-4 text-left align-middle font-semibold [&:has([role=checkbox])]:pr-0 break-words">Required</th>
            {showDefaults && <th className="text-xs h-10 px-4 text-left align-middle font-semibold [&:has([role=checkbox])]:pr-0 break-words">Default</th>}
            <th className="text-xs h-10 px-4 text-left align-middle font-semibold [&:has([role=checkbox])]:pr-0 break-words">Description</th>
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {filtered.map((field) => (
            <tr key={field.name} className="border-b border-border/30 transition-colors hover:bg-muted/30">
              <td className="text-xs p-4 align-middle [&:has([role=checkbox])]:pr-0 break-words">
                <code className="font-mono border text-sm bg-card/80 px-2 rounded-md tracking-wide">{field.name}</code>
              </td>
              <td className="text-xs p-4 align-middle [&:has([role=checkbox])]:pr-0 break-words">
                <code className="font-mono border text-sm bg-card/80 px-2 rounded-md tracking-wide">{field.type}</code>
              </td>
              <td className="text-xs p-4 align-middle [&:has([role=checkbox])]:pr-0 break-words">{field.required ? "Yes" : "No"}</td>
              {showDefaults && (
                <td className="text-xs p-4 align-middle [&:has([role=checkbox])]:pr-0 break-words">
                  {field.default !== undefined ? (
                    <code className="font-mono border text-sm bg-card/80 px-2 rounded-md tracking-wide">{JSON.stringify(field.default)}</code>
                  ) : (
                    "-"
                  )}
                </td>
              )}
              <td className="text-xs p-4 align-middle [&:has([role=checkbox])]:pr-0 break-words">
                {field.description ?? "-"}
                {field.constraints ? ` (${field.constraints})` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
