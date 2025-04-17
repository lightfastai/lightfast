import { AiNodeCreator } from "~/components/ai-node-creator/ai-node-creator";
import { EarlyAcessForm } from "~/components/early-access/early-access-form";
import { SiteFooter } from "~/components/site-footer";
import { siteConfig } from "~/config/site";

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

      <SiteFooter />
    </div>
  );
}
