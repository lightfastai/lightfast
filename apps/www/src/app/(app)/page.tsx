import Link from "next/link";
import { Dot } from "lucide-react";

import { AiNodeCreator } from "~/components/ai-node-creator/ai-node-creator";
import { siteConfig } from "~/config/site";
import { EarlyAcessForm } from "../../components/early-access/early-access-form";
import { Icons } from "../icons";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center pt-32">
      <div className="flex w-full flex-col items-center justify-center gap-4 py-4">
        <span className="font-mono text-xs text-muted-foreground">
          Introducing
        </span>{" "}
        <h1 className="text-center text-3xl font-semibold">
          {siteConfig.name}{" "}
          <span className="gradient-text font-mono">Computer</span>
        </h1>
        <p className="max-w-lg text-balance text-center text-xs text-muted-foreground">
          Simplifying the way you integrate AI workflows into your day to day
          &#x2014; from design to development
        </p>
      </div>

      <div className="flex w-full flex-col items-center justify-center py-4">
        <div className="w-full max-w-lg space-y-4">
          <EarlyAcessForm />
        </div>
      </div>

      <div className="my-8 w-full max-w-3xl">
        <AiNodeCreator />
      </div>

      <footer className="mt-auto w-full px-4 py-12 md:px-6">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-4">
            <Link
              target="_blank"
              href={siteConfig.links.github.href}
              aria-label="GitHub"
            >
              <Icons.gitHub className="size-4 hover:text-foreground" />
            </Link>
            <Link
              target="_blank"
              href={siteConfig.links.discord.href}
              aria-label="Discord"
            >
              <Icons.discord className="size-4 hover:text-foreground" />
            </Link>
            <Link
              target="_blank"
              href={siteConfig.links.twitter.href}
              aria-label="Twitter"
            >
              <Icons.twitter className="size-3 hover:text-foreground" />
            </Link>
          </div>

          <div className="flex flex-col items-center gap-2">
            <nav className="flex items-center gap-2 md:gap-4">
              <Link
                target="_blank"
                href={"/privacy"}
                className="text-xs hover:text-foreground"
              >
                Privacy
              </Link>
              <Dot className="size-2" />
              <Link
                target="_blank"
                href={"/terms"}
                className="text-xs hover:text-foreground"
              >
                Terms
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs">
              {" "}
              {siteConfig.name} Inc. © {new Date().getFullYear()}{" "}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
