export default function ShareNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Conversation not found</h1>
        <p className="text-sm text-muted-foreground">
          This shared conversation is no longer available or the link is invalid.
        </p>
      </div>
    </div>
  );
}

