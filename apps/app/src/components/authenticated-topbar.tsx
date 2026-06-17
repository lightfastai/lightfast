interface AuthenticatedTopbarProps {
  actions?: React.ReactNode;
  left?: React.ReactNode;
}

export function AuthenticatedTopbar({
  actions,
  left,
}: AuthenticatedTopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 px-4">
      {left}
      <div className="flex min-w-0 flex-1 items-center">{actions}</div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden items-center gap-3 md:flex">
          <a
            className="text-muted-foreground text-sm hover:text-foreground"
            href="/docs/get-started/overview"
            rel="noopener noreferrer"
            target="_blank"
          >
            Docs
          </a>
          <a
            className="text-muted-foreground text-sm hover:text-foreground"
            href="/docs/api-reference"
            rel="noopener noreferrer"
            target="_blank"
          >
            API Reference
          </a>
        </div>
      </div>
    </header>
  );
}
