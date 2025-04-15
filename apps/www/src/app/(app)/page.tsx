"use client";

import Link from "next/link";
import { Dot, Github, MessageSquare, Twitter } from "lucide-react";

import { WaitlistForm } from "../../components/waitlist-form";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center pt-32">
      <div className="flex w-full flex-col items-center justify-center gap-4 py-4">
        <h1 className="text-center text-5xl font-semibold">
          The future of Design is here
        </h1>
        <p className="max-w-2xl text-balance text-center text-xl text-muted-foreground">
          Simplifying the way you integrate AI workflows into your day to day
          &#x2014; from design to development
        </p>
      </div>

      <div className="flex w-full flex-col items-center justify-center border-b border-t py-4">
        <div className="w-full max-w-lg space-y-4">
          <WaitlistForm />
        </div>
      </div>

      <div className="my-8 w-full max-w-3xl overflow-hidden rounded-xl border">
        <div className="flex flex-col gap-4 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.1)_1px,transparent_0)] bg-[length:1rem_1rem] p-64">
          {" "}
        </div>
      </div>

      <footer className="mt-auto w-full px-4 py-12 md:px-6">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-4">
            <Link href="#" aria-label="GitHub">
              <Github className="size-4 hover:text-foreground" />
            </Link>
            <Link href="#" aria-label="Discord">
              <MessageSquare className="size-4 hover:text-foreground" />
            </Link>
            <Link href="#" aria-label="Twitter">
              <Twitter className="size-4 hover:text-foreground" />
            </Link>
          </div>

          <div className="flex flex-col items-center gap-2">
            <nav className="flex items-center gap-2 md:gap-4">
              <Link href="#" className="text-xs hover:text-foreground">
                Privacy
              </Link>
              <Dot className="size-2" />
              <Link href="#" className="text-xs hover:text-foreground">
                Terms
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs">
              {" "}
              Polychromos Inc. © {new Date().getFullYear()}{" "}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
