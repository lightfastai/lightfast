interface WorkspacePageProps {
  description: string;
  eyebrow?: string;
  title: string;
}

export function WorkspacePage({
  description,
  eyebrow,
  title,
}: WorkspacePageProps) {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-16">
      <section className="w-full max-w-xl space-y-4">
        {eyebrow ? (
          <p className="font-mono text-muted-foreground text-sm">{eyebrow}</p>
        ) : null}
        <h1 className="font-medium font-title text-3xl text-foreground">
          {title}
        </h1>
        <p className="max-w-md text-muted-foreground text-sm leading-6">
          {description}
        </p>
      </section>
    </main>
  );
}
