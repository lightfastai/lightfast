import React from "react";
import { ComposerRootLayout } from "@/components/root-layout";

const ComposerPage: React.FC = () => {
  return (
    <ComposerRootLayout>
      <div className="flex h-full flex-col items-center justify-center p-16">
        <h1>Composer</h1>
        {/* Add your composer UI here */}
      </div>
    </ComposerRootLayout>
  );
};

export default ComposerPage;
