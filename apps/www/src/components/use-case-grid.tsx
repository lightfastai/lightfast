export interface UseCaseItem {
  description: string;
  title: string;
}

interface UseCaseGridProps {
  items: UseCaseItem[];
}

export function UseCaseGrid({ items }: UseCaseGridProps) {
  // Split items into 3 columns
  const columns: UseCaseItem[][] = [[], [], []];
  items.forEach((item, index) => {
    columns[index % 3]?.push(item);
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {columns.map((column, columnIndex) => (
        <div className="flex flex-col gap-4" key={columnIndex}>
          {column.map((item, itemIndex) => (
            <div
              className="rounded-xs border border-border/40 bg-accent/40 px-6 py-9"
              key={itemIndex}
            >
              <h3 className="mb-2 font-medium text-foreground text-md">
                {item.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
