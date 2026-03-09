interface FeatureListProps {
  className?: string;
  features: string[];
  title?: string;
}

export function FeatureList({
  title,
  features,
  className = "",
}: FeatureListProps) {
  return (
    <div className={`border-primary border-l-4 py-2 pl-6 ${className}`}>
      {title && (
        <h3 className="mb-4 font-semibold text-foreground text-lg">{title}</h3>
      )}
      <div className="space-y-3">
        {features.map((feature, index) => (
          <p
            className="text-muted-foreground leading-relaxed"
            key={`${feature}-${index}`}
          >
            {feature}
          </p>
        ))}
      </div>
    </div>
  );
}
