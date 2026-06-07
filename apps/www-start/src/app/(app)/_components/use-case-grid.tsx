export interface UseCaseItem {
  description: string;
  title: string;
}

interface UseCaseGridProps {
  items: UseCaseItem[];
}

export function UseCaseGrid({ items }: UseCaseGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          className="rounded-xs border border-border/40 bg-accent/40 px-6 py-9"
          key={item.title}
        >
          <h3 className="mb-2 font-medium text-base text-foreground">
            {item.title}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}
