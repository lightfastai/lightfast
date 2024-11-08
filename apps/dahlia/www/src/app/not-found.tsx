import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";

export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
      <Button variant="link">
        <Link href="/">Return Home</Link>
      </Button>
    </div>
  );
}
