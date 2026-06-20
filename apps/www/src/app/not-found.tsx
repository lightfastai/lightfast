import { Button } from "@repo/ui-v2/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6 py-24 text-center text-foreground">
      <div className="w-full max-w-md">
        <p className="text-muted-foreground text-sm leading-6">404</p>
        <h1 className="mt-4 font-medium text-3xl leading-tight tracking-normal">
          Page not found
        </h1>
        <p className="mt-3 text-muted-foreground text-base leading-7">
          Sorry, we could not find the page you are looking for.
        </p>
        <Button
          className="mt-8"
          nativeButton={false}
          render={<Link href="/" />}
        >
          Return home
        </Button>
      </div>
    </main>
  );
}
