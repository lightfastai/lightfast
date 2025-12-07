export interface UseCaseItem {
  title: string;
  description: string;
}

interface UseCaseGridProps {
  items: UseCaseItem[];
}

export function UseCaseGrid({ items }: UseCaseGridProps) {
  // Split items into 3 columns
  const columns: UseCaseItem[][] = [[], [], []];
  items.forEach((item, index) => {
    columns[index % 3]!.push(item);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className="flex flex-col gap-4">
          {column.map((item, itemIndex) => (
            <div
              key={itemIndex}
              className="rounded-xs bg-accent/40 border border-border/40 px-6 py-9"
            >
              <h3 className="text-md font-medium text-foreground mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
