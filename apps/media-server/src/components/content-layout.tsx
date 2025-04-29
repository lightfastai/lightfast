interface ContentLayoutProps {
  children: React.ReactNode;
}

export function ContentLayout({ children }: ContentLayoutProps) {
  return (
    <div className="border-border bg-muted/20 flex h-full w-full flex-col rounded-lg border py-2">
      {children}
    </div>
  );
}
