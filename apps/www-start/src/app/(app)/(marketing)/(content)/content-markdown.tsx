import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { resolveContentAssetSrc } from "~/lib/content-assets";

const markdownComponents = {
  h2: ({ children, ...props }) => (
    <h2
      className="mt-12 mb-4 font-medium font-pp text-2xl text-foreground"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-8 mb-3 font-medium text-foreground text-xl" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="my-4 text-muted-foreground text-sm leading-7" {...props}>
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
      className="my-4 ml-6 list-disc space-y-2 text-muted-foreground text-sm"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="my-4 ml-6 list-decimal space-y-2 text-muted-foreground text-sm"
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
  img: ({ alt, src, ...props }) => (
    <img
      alt={alt ?? ""}
      className="my-8 w-full rounded-lg border border-border/50 object-cover"
      height={675}
      loading="eager"
      src={resolveContentAssetSrc(src)}
      width={1200}
      {...props}
    />
  ),
  code: ({ children, className, ...props }) => {
    if (className) {
      return (
        <code
          className="block overflow-x-auto rounded-md border border-border/50 bg-card p-4 text-sm"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <code
        className="rounded-sm bg-card px-1.5 py-0.5 text-foreground text-sm"
        {...props}
      >
        {children}
      </code>
    );
  },
} satisfies Components;

export function ContentMarkdown({ body }: { body: string }) {
  return (
    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
      {body}
    </ReactMarkdown>
  );
}
