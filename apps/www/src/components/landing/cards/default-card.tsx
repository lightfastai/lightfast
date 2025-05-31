import type { IntegrationCategory } from "../constants";

interface DefaultCardProps {
  category: IntegrationCategory;
}

export const DefaultCard = ({ category }: DefaultCardProps) => {
  return (
    <div className="flex h-full flex-col">
      <span className="text-foreground/90 mb-4 text-2xl font-semibold">
        {category.name}
      </span>
      <div className="flex flex-1 flex-col gap-3">
        <span className="text-muted-foreground text-sm">Applications</span>
        <div className="flex flex-col gap-2">
          {category.applications.map((app) => (
            <div
              key={app.name}
              className="flex items-center gap-2 rounded-md border border-transparent bg-white/5 px-3 py-2 transition-all duration-300"
            >
              <span className="flex-1 text-sm text-white/90">{app.name}</span>
              <div
                className={`text-xs ${
                  app.status === "live"
                    ? "text-green-400"
                    : app.status === "planned"
                      ? "text-yellow-400"
                      : "text-white/40"
                }`}
              >
                {app.status === "live" && "●"}
                {app.status === "planned" && "○"}
                {app.status === "future" && "◦"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
