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
            <div key={app.name} className="application-item">
              <span className="app-name">{app.name}</span>
              <div className={`status-indicator status-${app.status}`}>
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
