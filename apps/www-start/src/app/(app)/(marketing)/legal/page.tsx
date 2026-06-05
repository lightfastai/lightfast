import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { LegalPage } from "~/lib/legal-content";
import { buildLegalJsonLd } from "~/lib/legal-content";

const markdownComponents = {
  h1: ({ children, ...props }) => (
    <h1
      className="mt-0 mb-8 font-medium text-4xl text-foreground tracking-normal"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mt-12 mb-4 border-border border-b pb-2 font-medium text-2xl text-foreground tracking-normal"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="mt-8 mb-3 font-medium text-foreground text-xl tracking-normal"
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="my-4 text-muted-foreground leading-7" {...props}>
      {children}
    </p>
  ),
  a: ({ children, href, ...props }) => {
    const isExternal = href?.startsWith("http");

    return (
      <a
        className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
        href={href}
        rel={isExternal ? "noopener noreferrer" : undefined}
        target={isExternal ? "_blank" : undefined}
        {...props}
      >
        {children}
      </a>
    );
  },
  ul: ({ children, ...props }) => (
    <ul
      className="my-4 ml-6 list-disc space-y-2 text-muted-foreground"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="my-4 ml-6 list-decimal space-y-2 text-muted-foreground"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="pl-1 leading-7" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-medium text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="text-foreground" {...props}>
      {children}
    </em>
  ),
  hr: (props) => <hr className="my-8 border-border" {...props} />,
  table: ({ children, ...props }) => (
    <div className="my-6 overflow-x-auto rounded-md border border-border">
      <table
        className="w-full min-w-[720px] border-collapse text-sm"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border-border border-b bg-card px-4 py-3 text-left font-medium text-foreground"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className="border-border border-t px-4 py-3 text-muted-foreground"
      {...props}
    >
      {children}
    </td>
  ),
} satisfies Components;

function formatUpdatedAt(updatedAt: string) {
  return new Date(updatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function LegalPageView({ page }: { page: LegalPage }) {
  return (
    <>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is generated from local typed content.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildLegalJsonLd(page)),
        }}
        type="application/ld+json"
      />
      <div className="grid grid-cols-1 items-start gap-8 py-24 sm:py-28 md:grid-cols-12 lg:py-32">
        <div className="md:col-span-2">
          {page.data.updatedAt ? (
            <div className="text-muted-foreground text-sm">
              <p className="mb-1 font-medium">Last updated</p>
              <time className="whitespace-nowrap">
                {formatUpdatedAt(page.data.updatedAt)}
              </time>
            </div>
          ) : null}
        </div>
        <article className="space-y-8 md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4">
          <div className="max-w-none">
            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
            >
              {page.body}
            </ReactMarkdown>
          </div>
        </article>
      </div>
    </>
  );
}
