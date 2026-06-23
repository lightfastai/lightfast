import { Button } from "@repo/ui-v2/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center py-28 text-center text-foreground sm:py-32 lg:py-24">
      <div className="mx-auto w-full max-w-md">
        <p className="text-muted-foreground text-sm leading-6">404</p>
        <h1 className="mt-4 font-medium text-3xl leading-tight tracking-normal">
          Page not found
        </h1>
        <p className="mt-3 text-base text-muted-foreground leading-7">
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
