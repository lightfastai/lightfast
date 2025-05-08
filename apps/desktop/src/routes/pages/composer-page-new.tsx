import React, { useMemo } from "react";
import { ComposerRootLayout } from "@/components/composer-root-layout";
import { Session } from "@/components/session/session";

import { nanoid } from "@repo/lib";

const ComposerPageNew: React.FC = () => {
  const sessionId = useMemo(() => nanoid(), []);
  return (
    <ComposerRootLayout>
      <Session sessionId={sessionId} />
    </ComposerRootLayout>
  );
};

export default ComposerPageNew;
