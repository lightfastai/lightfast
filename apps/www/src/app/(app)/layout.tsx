import "~/styles/globals.css";

import type { ReactNode } from "react";
import { ApolloTracker } from "~/components/apollo-tracker";
import { env } from "~/env";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      {env.NEXT_PUBLIC_VERCEL_ENV === "production" && <ApolloTracker />}
    </>
  );
}
