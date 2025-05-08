import React from "react";
import { ComposerRootLayout } from "@/components/composer-root-layout";
import { Session } from "@/components/session/session";
import { useParams } from "@tanstack/react-router";

const ComposerPageExisting: React.FC = () => {
  const { sessionId } = useParams({ from: "/$sessionId" });
  return (
    <ComposerRootLayout>
      <Session sessionId={sessionId} />
    </ComposerRootLayout>
  );
};

export default ComposerPageExisting;
