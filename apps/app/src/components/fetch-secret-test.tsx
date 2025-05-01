"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@vendor/trpc/client/react";

export function FetchSecretTest() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.app.auth.randomSecret.queryOptions(),
  );
  if (isLoading) return <div>Loading...</div>;
  return <div>{data}</div>;
}
