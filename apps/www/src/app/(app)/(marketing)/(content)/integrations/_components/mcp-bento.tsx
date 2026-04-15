import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import type { Route } from "next";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { NavLink } from "~/components/nav-link";

type Tone = "light" | "dark";

interface BrandedCardProps {
  bg: string;
  comingSoon?: boolean;
  description: string;
  href: Route;
  illustration: ReactNode;
  logo: ComponentType<SVGProps<SVGSVGElement>>;
  logoTone: Tone;
  title: string;
}

function BrandedCard({
  href,
  logo: Logo,
  logoTone,
  bg,
  title,
  description,
  illustration,
  comingSoon,
}: BrandedCardProps) {
  const isLight = logoTone === "light";
  return (
    <NavLink
      className={`group relative block aspect-[440/605] overflow-hidden rounded-md ${bg}`}
      href={href}
      prefetch
    >
      <Logo
        aria-hidden
        className={`absolute top-8 left-8 size-12 ${isLight ? "text-white" : "text-foreground"}`}
      />
      <div className="absolute inset-x-0 top-[50%] bottom-[8%] overflow-hidden">
        {illustration}
      </div>
      <figcaption
        className={`absolute right-8 bottom-8 left-8 ${isLight ? "text-white" : "text-foreground"}`}
      >
        <h3 className="font-medium font-pp text-lg">{title}</h3>
        <p
          className={`mt-2 text-sm leading-relaxed ${isLight ? "text-white/85" : "text-muted-foreground"}`}
        >
          {description}
        </p>
        {comingSoon ? (
          <span
            className={`mt-3 inline-block rounded-full px-2 py-0.5 text-xs ${isLight ? "bg-white/15 text-white" : "bg-accent text-foreground"}`}
          >
            Coming soon
          </span>
        ) : null}
      </figcaption>
    </NavLink>
  );
}

function ClaudeTerminalMock() {
  return (
    <svg
      aria-hidden
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 376 240"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        fill="#B7603F"
        height="200"
        rx="10"
        stroke="rgba(255,255,255,0.12)"
        width="320"
        x="28"
        y="24"
      />
      <rect fill="#9E4E32" height="28" rx="10" width="320" x="28" y="24" />
      <rect fill="#9E4E32" height="8" width="320" x="28" y="44" />
      <circle cx="46" cy="38" fill="rgba(255,255,255,0.55)" r="4" />
      <circle cx="60" cy="38" fill="rgba(255,255,255,0.4)" r="4" />
      <circle cx="74" cy="38" fill="rgba(255,255,255,0.28)" r="4" />
      <g
        fill="rgba(255,255,255,0.92)"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="11"
      >
        <text x="46" y="80">
          $ claude
        </text>
        <text fill="rgba(255,255,255,0.65)" x="46" y="102">
          &gt; lightfast.search(&quot;rate limit bug&quot;)
        </text>
        <text x="46" y="132">
          ✓ 3 results
        </text>
        <text fill="rgba(255,255,255,0.7)" x="46" y="152">
          • INC-412 · rate-limit middleware
        </text>
        <text fill="rgba(255,255,255,0.7)" x="46" y="170">
          • PR #3108 · token bucket fix
        </text>
        <text fill="rgba(255,255,255,0.7)" x="46" y="188">
          • Sentry · 429 spike (prod)
        </text>
      </g>
      <rect
        fill="rgba(255,255,255,0.85)"
        height="12"
        width="8"
        x="46"
        y="198"
      />
    </svg>
  );
}

function CodexEditorMock() {
  return (
    <svg
      aria-hidden
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 376 240"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        fill="#151515"
        height="200"
        rx="10"
        stroke="rgba(255,255,255,0.08)"
        width="320"
        x="28"
        y="24"
      />
      <rect fill="#0F0F0F" height="26" rx="10" width="320" x="28" y="24" />
      <rect fill="#0F0F0F" height="8" width="320" x="28" y="42" />
      <rect
        fill="#1F1F1F"
        height="20"
        rx="4"
        stroke="rgba(255,255,255,0.08)"
        width="96"
        x="44"
        y="30"
      />
      <text
        fill="rgba(255,255,255,0.85)"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="10"
        x="56"
        y="44"
      >
        router.ts
      </text>
      <rect
        fill="rgba(255,255,255,0.08)"
        height="18"
        rx="9"
        width="100"
        x="232"
        y="30"
      />
      <text
        fill="rgba(255,255,255,0.75)"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="9"
        x="242"
        y="42"
      >
        lightfast_search · mcp
      </text>
      <g
        fill="rgba(255,255,255,0.35)"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="10"
      >
        <text x="44" y="78">
          1
        </text>
        <text x="44" y="96">
          2
        </text>
        <text x="44" y="114">
          3
        </text>
        <text x="44" y="132">
          4
        </text>
        <text x="44" y="150">
          5
        </text>
        <text x="44" y="168">
          6
        </text>
      </g>
      <g
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="10"
      >
        <text fill="rgba(255,255,255,0.35)" x="70" y="78">
          import {"{"} router {"}"} from &quot;./trpc&quot;;
        </text>
        <text fill="rgba(255,255,255,0.35)" x="70" y="96">
          export const appRouter = router({"{"}
        </text>
        <rect
          fill="rgba(255,255,255,0.06)"
          height="16"
          width="260"
          x="66"
          y="102"
        />
        <text fill="rgba(255,255,255,0.95)" x="70" y="114">
          search: await lightfast_search(q),
        </text>
        <text fill="rgba(255,255,255,0.35)" x="70" y="132">
          workspace: workspaceRouter,
        </text>
        <text fill="rgba(255,255,255,0.35)" x="70" y="150">
          jobs: jobsRouter,
        </text>
        <text fill="rgba(255,255,255,0.35)" x="70" y="168">
          {"}"});
        </text>
      </g>
    </svg>
  );
}

function SlackThreadMock() {
  return (
    <svg
      aria-hidden
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 376 240"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        fill="#3F1140"
        height="200"
        rx="10"
        stroke="rgba(255,255,255,0.1)"
        width="320"
        x="28"
        y="24"
      />
      <rect fill="#340E36" height="32" rx="10" width="320" x="28" y="24" />
      <rect fill="#340E36" height="8" width="320" x="28" y="48" />
      <text
        fill="rgba(255,255,255,0.95)"
        fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        fontSize="11"
        fontWeight="600"
        x="46"
        y="44"
      >
        # incidents
      </text>
      <text
        fill="rgba(255,255,255,0.45)"
        fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        fontSize="10"
        x="130"
        y="44"
      >
        12 members
      </text>
      <g transform="translate(46, 78)">
        <rect fill="rgba(255,255,255,0.22)" height="24" rx="4" width="24" />
        <text
          fill="rgba(255,255,255,0.95)"
          fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          fontSize="11"
          fontWeight="600"
          x="36"
          y="10"
        >
          jeevan
        </text>
        <text
          fill="rgba(255,255,255,0.8)"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize="10"
          x="36"
          y="28"
        >
          /lightfast ask why is checkout 5xx-ing?
        </text>
      </g>
      <g transform="translate(46, 136)">
        <rect fill="#F4B400" height="24" rx="4" width="24" />
        <text
          fill="#3F1140"
          fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
          x="14"
          y="16"
        >
          L
        </text>
        <text
          fill="rgba(255,255,255,0.95)"
          fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          fontSize="11"
          fontWeight="600"
          x="36"
          y="10"
        >
          Lightfast
        </text>
        <text
          fill="rgba(255,255,255,0.85)"
          fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          fontSize="10"
          x="36"
          y="28"
        >
          Stripe webhook retries spiked after PR #3108.
        </text>
        <rect
          fill="rgba(255,255,255,0.12)"
          height="18"
          rx="9"
          width="104"
          x="36"
          y="40"
        />
        <text
          fill="rgba(255,255,255,0.85)"
          fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          fontSize="9"
          x="46"
          y="52"
        >
          source · github/vercel
        </text>
      </g>
    </svg>
  );
}

export function McpBentoSection() {
  return (
    <section className="mt-64 mb-32">
      <div className="mb-32 flex grid grid-cols-1 gap-8 px-16 md:grid-cols-2 md:items-end md:gap-12">
        <h2 className="max-w-xs font-medium font-pp text-3xl text-foreground md:text-4xl">
          Use Lightfast with your favourite tools
        </h2>
        <p className="text-lg text-muted-foreground">
          Expose your Lightfast team knowledge as MCP tools and call them from
          your coding agents and team chat — no context switch, no data copy.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-3">
        <BrandedCard
          bg="bg-[#D97757]"
          description="Call lightfast_search from the Claude Code CLI to pull team knowledge straight into your session."
          href={"/docs/integrate/mcp#claude-code-cli" as Route}
          illustration={<ClaudeTerminalMock />}
          logo={IntegrationLogoIcons.claude}
          logoTone="light"
          title="Claude Code"
        />
        <BrandedCard
          bg="bg-[#0A0A0A]"
          description="Wire Lightfast as an MCP server in Codex and route slash-commands through your real stack context."
          href={"/docs/integrate/mcp#openai-codex" as Route}
          illustration={<CodexEditorMock />}
          logo={IntegrationLogoIcons.codex}
          logoTone="light"
          title="Codex"
        />
        <BrandedCard
          bg="bg-[#4A154B]"
          comingSoon
          description="Bring Lightfast context into team channels so questions about your stack get grounded answers."
          href={"/docs/integrate/mcp" as Route}
          illustration={<SlackThreadMock />}
          logo={IntegrationLogoIcons.slack}
          logoTone="light"
          title="Slack"
        />
      </div>
    </section>
  );
}
