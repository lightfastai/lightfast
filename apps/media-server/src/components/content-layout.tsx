interface ContentLayoutProps {
  children: React.ReactNode;
}

export function ContentLayout({ children }: ContentLayoutProps) {
  return (
    <div className="border-border bg-muted/20 flex h-full w-full flex-col overflow-hidden rounded-lg border">
      {children}
    </div>
  );
}
