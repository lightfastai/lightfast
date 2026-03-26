import { Icons } from "@repo/ui/components/icons";
import NextLink from "next/link";
import { ManifestoShader } from "./_components/manifesto-shader";

export const revalidate = 3600;

async function getLatestCommit(): Promise<{ hash: string; url: string }> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/lightfastai/.lightfast/commits?per_page=1",
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const [commit] = (await res.json()) as [{ sha: string }];
    return {
      hash: commit.sha.slice(0, 7),
      url: `https://github.com/lightfastai/.lightfast/commit/${commit.sha}`,
    };
  } catch {
    return { hash: "unknown", url: "https://github.com/lightfastai/.lightfast" };
  }
}

export default async function ManifestoPage() {
  const { hash, url } = await getLatestCommit();

  return (
    <main className="flex h-screen flex-col">
      {/* Top (50%) */}
      <section className="relative flex-[5]">
        <header className="relative flex items-start justify-between px-6 pt-6">
          <NextLink href="/">
            <Icons.logoShort className="h-4 w-4 text-foreground" />
          </NextLink>

          <div className="font-pp absolute left-[50%] max-w-sm space-y-4 text-lg lg:text-2xl">
            <p className="font-medium text-foreground">
              This is our specification.
            </p>
            <p className="font-medium text-foreground">
              We are building the runtime that executes Programs — the substrate
              where organisational intelligence runs autonomously, accumulates
              memory, and compounds over time.
            </p>
            <p className="font-medium text-foreground">
              We believe a company should be expressible as a Program. We
              believe a founder's highest leverage is writing that Program
              clearly. We believe everything else — the orchestration, the
              memory, the execution, the intelligence — is the runtime's job.
            </p>
          </div>
        </header>

        {/* Bottom row — CTA left, last sentence at same level */}
        <div className="absolute bottom-6 left-0 right-0 flex items-start px-6">
          <div className="flex items-center gap-4">
            <span className="font-mono text-foreground text-sm uppercase">
              Read the Program →
            </span>
            <NextLink
              className="font-mono text-foreground text-sm uppercase hover:underline"
              href={url}
              rel="noopener noreferrer"
              target="_blank"
            >
              @{hash}
            </NextLink>
          </div>
          <p className="font-pp absolute left-[50%] font-semibold text-foreground text-lg lg:text-2xl">
            We are building the runtime.
          </p>
        </div>
      </section>

      {/* Middle — shader (30%) */}
      <section className="relative flex-[3]">
        <ManifestoShader />
      </section>

      {/* Bottom — footer (20%) */}
      <footer className="flex flex-[2] items-center justify-center px-6">
        {/* placeholder */}
      </footer>
    </main>
  );
}
