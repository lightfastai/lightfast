import { getSchemaFields } from "~/lib/schema-reader";

interface EnumValuesProps {
  schema: string;
  field: string;
  descriptions?: Record<string, string>; // Manual descriptions per value
}

export function EnumValues({ schema, field, descriptions }: EnumValuesProps) {
  const fields = getSchemaFields(schema);
  const target = fields.find((f) => f.name === field);

  if (!target?.enum) {
    return null;
  }

  return (
    <ul>
      {target.enum.map((value) => (
        <li key={value}>
          <code>&quot;{value}&quot;</code>
          {descriptions?.[value] ? ` - ${descriptions[value]}` : ""}
        </li>
      ))}
    </ul>
  );
}
