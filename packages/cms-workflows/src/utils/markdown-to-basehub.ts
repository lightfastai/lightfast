/**
 * Converts markdown to BaseHub RichText JSON format.
 *
 * BaseHub's `format: "markdown"` parser doesn't handle GFM tables properly,
 * so we parse markdown ourselves and output the JSON format directly.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type {
  Root,
  Content,
  Paragraph,
  Heading,
  Text,
  Strong,
  Emphasis,
  InlineCode,
  Code,
  List,
  ListItem,
  Link,
  ThematicBreak,
  Blockquote,
  Table,
  TableRow,
  TableCell,
  Image,
  Break,
  Delete,
} from "mdast";

// BaseHub RichText types (from @basehub/mutation-api-helpers)
type Mark =
  | { type: "bold" | "italic" | "underline" | "strike" | "kbd" }
  | {
      type: "code";
      attrs: { isInline?: boolean; language: string; code: string };
    }
  | {
      type: "link";
      attrs:
        | { type: "link"; href: string; target?: string | null }
        | { type: "internal"; targetId: string; target?: string | null };
    }
  | { type: "highlight"; attrs: { color?: string | null } };

type BaseRichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: Mark[];
  content?: RichTextNode[];
};

type TextNode = {
  type: "text";
  text: string;
  marks?: Mark[];
};

type CodeBlockNode = {
  type: "codeBlock";
  attrs: { language?: string };
  content?: [{ type: "text"; text: string }];
};

type HeadingNode = {
  type: "heading";
  attrs: { level: number; id?: string };
  content?: RichTextNode[];
};

type OrderedListNode = {
  type: "orderedList";
  attrs?: { start: number };
  content?: RichTextNode[];
};

type TableCellNode = {
  type: "tableCell" | "tableHeader" | "tableFooter";
  attrs: { colspan: number; rowspan: number; colwidth?: null | number[] };
  content?: RichTextNode[];
};

type ImageNode = {
  type: "image";
  attrs: {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
    caption?: string;
  };
};

export type RichTextNode =
  | BaseRichTextNode
  | TextNode
  | CodeBlockNode
  | HeadingNode
  | OrderedListNode
  | TableCellNode
  | ImageNode;

/**
 * Context passed through the AST conversion to track state like marks
 */
interface ConversionContext {
  marks: Mark[];
  isInTableHeader: boolean;
}

/**
 * Create a text node with optional marks
 */
function createTextNode(text: string, marks: Mark[] = []): TextNode {
  const node: TextNode = { type: "text", text };
  if (marks.length > 0) {
    node.marks = [...marks];
  }
  return node;
}

/**
 * Generate a slug from heading text for the id attribute
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Extract plain text from mdast node for slugification
 */
function extractText(node: Content): string {
  if (node.type === "text") {
    return node.value;
  }
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map(extractText).join("");
  }
  if (node.type === "inlineCode") {
    return node.value;
  }
  return "";
}

/**
 * Convert mdast inline content (text, strong, emphasis, etc.) to BaseHub nodes
 */
function convertInlineContent(
  children: Content[],
  ctx: ConversionContext,
): RichTextNode[] {
  const result: RichTextNode[] = [];

  for (const child of children) {
    switch (child.type) {
      case "text": {
        if (child.value) {
          result.push(createTextNode(child.value, ctx.marks));
        }
        break;
      }
      case "strong": {
        const strongCtx = {
          ...ctx,
          marks: [...ctx.marks, { type: "bold" as const }],
        };
        result.push(
          ...convertInlineContent(child.children as Content[], strongCtx),
        );
        break;
      }
      case "emphasis": {
        const emCtx = {
          ...ctx,
          marks: [...ctx.marks, { type: "italic" as const }],
        };
        result.push(
          ...convertInlineContent(child.children as Content[], emCtx),
        );
        break;
      }
      case "delete": {
        const deleteCtx = {
          ...ctx,
          marks: [...ctx.marks, { type: "strike" as const }],
        };
        result.push(
          ...convertInlineContent(
            (child as Delete).children as Content[],
            deleteCtx,
          ),
        );
        break;
      }
      case "inlineCode": {
        const codeValue = (child as InlineCode).value;
        const codeMark: Mark = {
          type: "code",
          attrs: { isInline: true, language: "", code: codeValue },
        };
        result.push(createTextNode(codeValue, [...ctx.marks, codeMark]));
        break;
      }
      case "link": {
        const linkNode = child as Link;
        const linkMark: Mark = {
          type: "link",
          attrs: { type: "link", href: linkNode.url },
        };
        const linkCtx = { ...ctx, marks: [...ctx.marks, linkMark] };
        result.push(
          ...convertInlineContent(linkNode.children as Content[], linkCtx),
        );
        break;
      }
      case "break": {
        result.push({ type: "hardBreak" });
        break;
      }
      case "image": {
        const imgNode = child as Image;
        result.push({
          type: "image",
          attrs: {
            src: imgNode.url,
            alt: imgNode.alt ?? undefined,
          },
        } as ImageNode);
        break;
      }
      default: {
        // Handle any other inline nodes by trying to extract their children
        if ("children" in child && Array.isArray(child.children)) {
          result.push(
            ...convertInlineContent(child.children as Content[], ctx),
          );
        }
      }
    }
  }

  return result;
}

/**
 * Convert a single mdast block node to BaseHub RichTextNode(s)
 */
function convertNode(
  node: Content,
  ctx: ConversionContext,
): RichTextNode | RichTextNode[] | null {
  switch (node.type) {
    case "paragraph": {
      const para = node as Paragraph;
      const content = convertInlineContent(para.children as Content[], ctx);
      return { type: "paragraph", content };
    }

    case "heading": {
      const heading = node as Heading;
      const headingText = extractText(heading);
      const content = convertInlineContent(heading.children as Content[], ctx);
      return {
        type: "heading",
        attrs: { level: heading.depth, id: slugify(headingText) },
        content,
      } as HeadingNode;
    }

    case "code": {
      const codeBlock = node as Code;
      return {
        type: "codeBlock",
        attrs: { language: codeBlock.lang ?? undefined },
        content: [{ type: "text", text: codeBlock.value }],
      } as CodeBlockNode;
    }

    case "list": {
      const list = node as List;
      const listContent = list.children.map((item: ListItem) =>
        convertNode(item, ctx),
      ) as RichTextNode[];

      if (list.ordered) {
        return {
          type: "orderedList",
          attrs: { start: list.start ?? 1 },
          content: listContent,
        } as OrderedListNode;
      }
      return { type: "bulletList", content: listContent };
    }

    case "listItem": {
      const listItem = node as ListItem;
      const itemContent: RichTextNode[] = [];

      for (const child of listItem.children) {
        const converted = convertNode(child as Content, ctx);
        if (converted) {
          if (Array.isArray(converted)) {
            itemContent.push(...converted);
          } else {
            itemContent.push(converted);
          }
        }
      }

      return { type: "listItem", content: itemContent };
    }

    case "blockquote": {
      const blockquote = node as Blockquote;
      const quoteContent: RichTextNode[] = [];

      for (const child of blockquote.children) {
        const converted = convertNode(child as Content, ctx);
        if (converted) {
          if (Array.isArray(converted)) {
            quoteContent.push(...converted);
          } else {
            quoteContent.push(converted);
          }
        }
      }

      return { type: "blockquote", content: quoteContent };
    }

    case "thematicBreak": {
      return { type: "horizontalRule" };
    }

    case "table": {
      const table = node as Table;
      const tableContent: RichTextNode[] = [];

      for (let rowIndex = 0; rowIndex < table.children.length; rowIndex++) {
        const row = table.children[rowIndex] as TableRow;
        const isHeaderRow = rowIndex === 0;
        const rowCtx = { ...ctx, isInTableHeader: isHeaderRow };

        const cells = row.children.map((cell: TableCell) => {
          const tableCell = cell;
          const cellType = isHeaderRow ? "tableHeader" : "tableCell";

          // Table cells should contain a paragraph wrapping the inline content
          const cellInlineContent = convertInlineContent(
            tableCell.children as Content[],
            rowCtx,
          );

          return {
            type: cellType,
            attrs: { colspan: 1, rowspan: 1 },
            content: [{ type: "paragraph", content: cellInlineContent }],
          } as TableCellNode;
        });

        tableContent.push({ type: "tableRow", content: cells });
      }

      return { type: "table", content: tableContent };
    }

    case "image": {
      const img = node as Image;
      return {
        type: "image",
        attrs: {
          src: img.url,
          alt: img.alt ?? undefined,
        },
      } as ImageNode;
    }

    default: {
      // For unknown block types, try to handle as paragraph if it has children
      if ("children" in node && Array.isArray(node.children)) {
        const content = convertInlineContent(node.children as Content[], ctx);
        if (content.length > 0) {
          return { type: "paragraph", content };
        }
      }
      return null;
    }
  }
}

/**
 * Convert markdown string to BaseHub RichText JSON format.
 *
 * @param markdown - The markdown string to convert
 * @returns Array of RichTextNode that can be used with BaseHub's `format: "json"`
 *
 * @example
 * ```typescript
 * const json = markdownToBaseHubJson(`
 * ## Hello
 *
 * | Name | Value |
 * |------|-------|
 * | foo  | bar   |
 * `);
 *
 * // Use in mutation:
 * body: {
 *   type: "rich-text",
 *   value: { format: "json", value: json }
 * }
 * ```
 */
export function markdownToBaseHubJson(markdown: string): RichTextNode[] {
  const processor = unified().use(remarkParse).use(remarkGfm);

  const ast = processor.parse(markdown) as Root;
  const ctx: ConversionContext = { marks: [], isInTableHeader: false };
  const result: RichTextNode[] = [];

  for (const child of ast.children) {
    const converted = convertNode(child as Content, ctx);
    if (converted) {
      if (Array.isArray(converted)) {
        result.push(...converted);
      } else {
        result.push(converted);
      }
    }
  }

  return result;
}
