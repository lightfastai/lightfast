import React, { useMemo } from "react";
import { ComposerRootLayout } from "@/components/composer-root-layout";
import { Session } from "@/components/session/session";
import { useParams } from "@tanstack/react-router";

import { nanoid } from "@repo/lib";

const ComposerPage: React.FC = () => {
  const params = useParams({ from: "/$sessionId" });
  // If sessionId is present in params, use it; otherwise, generate a new one
  const sessionId = params.sessionId ?? useMemo(() => nanoid(), []);

  return (
    <ComposerRootLayout>
      <Session sessionId={sessionId} />
    </ComposerRootLayout>
  );
};

export default ComposerPage;
