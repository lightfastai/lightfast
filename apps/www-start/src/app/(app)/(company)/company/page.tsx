import { ManifestoShader } from "./_components/manifesto-shader";

export interface LatestCommit {
  hash: string;
  url: string;
}

export const FALLBACK_LATEST_COMMIT: LatestCommit = {
  hash: "unknown",
  url: "https://github.com/lightfastai/.lightfast",
};

function readCommitSha(data: unknown) {
  if (!Array.isArray(data)) {
    return null;
  }

  const [commit] = data;
  if (
    typeof commit === "object" &&
    commit !== null &&
    "sha" in commit &&
    typeof commit.sha === "string"
  ) {
    return commit.sha;
  }

  return null;
}

export async function getLatestCommit(): Promise<LatestCommit> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/lightfastai/.lightfast/commits?per_page=1",
      {
        cache: "force-cache",
        headers: { Accept: "application/vnd.github.v3+json" },
      }
    );

    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}`);
    }

    const sha = readCommitSha(await res.json());
    if (!sha) {
      throw new Error("GitHub API response did not include a commit SHA");
    }

    return {
      hash: sha.slice(0, 7),
      url: `https://github.com/lightfastai/.lightfast/commit/${sha}`,
    };
  } catch {
    return FALLBACK_LATEST_COMMIT;
  }
}

interface ManifestoPageProps {
  latestCommit?: LatestCommit;
}

export default function ManifestoPage({
  latestCommit,
}: ManifestoPageProps = {}) {
  const { hash, url } = latestCommit ?? FALLBACK_LATEST_COMMIT;

  return (
    <main className="flex h-screen flex-col">
      <section className="relative flex-[5]">
        <header className="relative flex items-start justify-between px-6 pt-6">
          <div className="absolute left-[50%] max-w-sm space-y-4 font-pp text-lg lg:text-2xl">
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
              believe a founder&apos;s highest leverage is writing that Program
              clearly. We believe everything else — the orchestration, the
              memory, the execution, the intelligence — is the runtime&apos;s
              job.
            </p>
          </div>
        </header>

        <div className="absolute right-0 bottom-6 left-0 flex items-start px-6">
          <div className="flex items-center gap-4">
            <span className="font-mono text-foreground text-sm uppercase">
              Read the Program -&gt;
            </span>
            <a
              className="font-mono text-foreground text-sm uppercase hover:underline"
              href={url}
              rel="noopener noreferrer"
              target="_blank"
            >
              @{hash}
            </a>
          </div>
          <p className="absolute left-[50%] font-pp font-semibold text-foreground text-lg lg:text-2xl">
            We are building the runtime.
          </p>
        </div>
      </section>

      <section className="relative flex-[3]">
        <ManifestoShader />
      </section>

      <footer className="flex flex-[2] items-center justify-center px-6" />
    </main>
  );
}
