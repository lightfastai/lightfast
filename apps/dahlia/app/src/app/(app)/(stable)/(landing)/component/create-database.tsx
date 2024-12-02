"use client";

import { Button } from "@repo/ui/components/ui/button";

import { api } from "~/trpc/react";

export default function CreateDatabase() {
  const { mutate: createDatabase } = api.app.database.create.useMutation();
  const { data } = api.app.database.get.useQuery();
  return (
    <>
      <Button onClick={() => createDatabase()}>Create Database</Button>
      {data && <div>Database Created with id: {data.dbId}</div>}
    </>
  );
}
