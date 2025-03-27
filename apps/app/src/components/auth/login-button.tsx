import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";

export const LoginButton = () => {
  return (
    <Button variant="outline" asChild>
      <Link href={"http://localhost:4103/sign-in"} prefetch={false}>
        Sign-in
      </Link>
    </Button>
  );
};
