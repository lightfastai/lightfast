interface TemporaryModeSentinelProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Server component: emits a hidden sentinel div only when in temporary mode.
export async function TemporaryModeSentinel({ searchParams }: TemporaryModeSentinelProps) {
  const params = await searchParams;
  const value = params.mode ?? params.temporary;
  const isTemporary = Array.isArray(value)
    ? value.some((v) => v === "temporary" || v === "1")
    : value === "temporary" || value === "1";

  if (!isTemporary) return null;
  return <div data-temp-chat-flag className="hidden" />;
}

