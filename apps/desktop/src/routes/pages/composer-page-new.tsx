import React, { useMemo } from "react";
import { ComposerRootLayout } from "@/components/composer-root-layout";
import { Session } from "@/components/session";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";

import { nanoid } from "@repo/lib";

const ComposerPageNew: React.FC = () => {
  const sessionId = useMemo(() => nanoid(), []);
  const { data: session } = useQuery(trpc.app.auth.getSession.queryOptions());
  console.log("Session From Server", session);
  return (
    <ComposerRootLayout>
      <Session sessionId={sessionId} />
    </ComposerRootLayout>
  );
};

export default ComposerPageNew;
