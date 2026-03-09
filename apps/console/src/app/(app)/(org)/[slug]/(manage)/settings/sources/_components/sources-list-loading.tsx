export function SourcesListLoading() {
  return (
    <div className="w-full divide-y rounded-lg border">
      {[1, 2, 3, 4].map((index) => (
        <div
          className="flex items-center justify-between px-4 py-3"
          key={index}
        >
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
