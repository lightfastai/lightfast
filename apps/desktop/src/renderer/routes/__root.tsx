import { ClerkLoaded } from "@clerk/clerk-react";

import { InnerApp } from "../components/router/inner-app";

export const Root = () => {
  return (
    <ClerkLoaded>
      <InnerApp />
    </ClerkLoaded>
  );
};
