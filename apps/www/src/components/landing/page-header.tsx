export interface PageHeaderProps {
  categoryPhase: number;
}

export const PageHeader = ({ categoryPhase }: PageHeaderProps) => {
  return (
    <div
      className="absolute top-16 right-0 left-0 text-center transition-opacity duration-500"
      style={{ opacity: categoryPhase }}
    >
      <h2 className="text-foreground mb-4 text-3xl font-bold">
        Works with your
        <span className="text-primary ml-2 italic">favorite tools</span>
      </h2>
    </div>
  );
};
