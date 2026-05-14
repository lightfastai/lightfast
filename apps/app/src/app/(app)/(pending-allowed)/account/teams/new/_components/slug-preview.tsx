interface SlugPreviewProps {
  slug: string;
}

export function SlugPreview({ slug }: SlugPreviewProps) {
  return (
    <p className="font-mono text-muted-foreground text-sm">
      lightfast.ai/
      <span className="text-foreground">{slug || "your-team"}</span>
    </p>
  );
}
