// --- Data Structure ---

interface IntegrationApp {
  name: string;
  category: string;
  connection: string;
  priority: string;
  status: string;
  issue?: string;
}

interface IntegrationCategory {
  name: string;
  grid: {
    colSpan: number;
    rowSpan: number;
    colStart: number;
    rowStart: number;
  };
  color: string;
  apps?: IntegrationApp[];
  isLogo?: boolean;
}

// --- Integration Data ---

const integrationCategories: IntegrationCategory[] = [
  {
    name: "Category 1",
    grid: { colSpan: 2, rowSpan: 6, colStart: 1, rowStart: 1 },
    color: "bg-blue-500",
  },
  {
    name: "Category 2",
    grid: { colSpan: 2, rowSpan: 5, colStart: 1, rowStart: 7 },
    color: "bg-red-500",
  },
  {
    name: "Category 3",
    grid: { colSpan: 4, rowSpan: 4, colStart: 3, rowStart: 1 },
    color: "bg-yellow-400",
  },
  {
    name: "Category 4",
    grid: { colSpan: 3, rowSpan: 7, colStart: 3, rowStart: 5 },
    color: "bg-green-400",
  },
  {
    name: "Category 5 (Center)",
    grid: { colSpan: 1, rowSpan: 1, colStart: 6, rowStart: 5 },
    color: "bg-purple-400",
  },
  {
    name: "Category 9",
    grid: { colSpan: 3, rowSpan: 5, colStart: 7, rowStart: 1 },
    color: "bg-purple-400",
  },
  {
    name: "Category 6",
    grid: { colSpan: 2, rowSpan: 3, colStart: 10, rowStart: 1 },
    color: "bg-pink-400",
  },
  {
    name: "Category 7",
    grid: { colSpan: 2, rowSpan: 8, colStart: 10, rowStart: 4 },
    color: "bg-orange-400",
  },
  {
    name: "Category 8",
    grid: { colSpan: 4, rowSpan: 6, colStart: 6, rowStart: 6 },
    color: "bg-teal-400",
  },
];

// --- Component ---

export function IntegrationsSection() {
  return (
    <section className="bg-background py-16">
      <div>
        {/* Header */}
        <div className="mb-12 text-center">
          <h2 className="text-foreground mb-4 text-3xl font-bold">
            Works with your
            <span className="text-primary ml-2 italic">favorite tools</span>
          </h2>
        </div>

        {/* 12x12 Custom Grid */}
        <div
          className="relative mx-auto grid w-full grid-cols-12 grid-rows-12 gap-2"
          style={{ minHeight: 600 }}
        >
          {integrationCategories.map((cat, idx) => {
            const gridStyles = {
              gridColumn: `${cat.grid.colStart} / span ${cat.grid.colSpan}`,
              gridRow: `${cat.grid.rowStart} / span ${cat.grid.rowSpan}`,
            };
            return (
              <div
                key={cat.name}
                className={`flex items-center justify-center border text-lg font-bold text-white ${cat.color}`}
                style={gridStyles}
              >
                {cat.name}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
