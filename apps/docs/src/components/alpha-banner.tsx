export function AlphaBanner() {
  return (
    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xs p-4 mb-6">
      <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium mb-1">
        Alpha API
      </p>
      <p className="text-sm text-fd-muted-foreground">
        This API is currently in alpha. Breaking changes may occur between
        releases. We recommend pinning to a specific version and monitoring the
        changelog for updates.
      </p>
    </div>
  );
}
