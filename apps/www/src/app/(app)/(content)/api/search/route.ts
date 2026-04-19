import Mixedbread from "@mixedbread/sdk";
import GithubSlugger from "github-slugger";
import type { NextRequest } from "next/server";
import removeMd from "remove-markdown";
import type { SortedResult } from "~/app/(app)/(content)/docs/_types/search";
import { env } from "~/env";

export const runtime = "edge";

const mxbaiClient = new Mixedbread({ apiKey: env.MXBAI_API_KEY });

// --- Types ---

interface MixedbreadMetadata {
  file_path?: string;
  git_branch?: string;
  git_commit?: string;
  synced?: boolean;
  uploaded_at?: string;
}

interface MixedbreadGeneratedMetadata {
  description?: string;
  file_type?: string;
  keywords?: string;
  language?: string;
  title?: string;
  type?: string;
  word_count?: number;
}

interface MixedbreadSearchItem {
  chunk_index: number;
  file_id: string;
  filename: string;
  generated_metadata?: MixedbreadGeneratedMetadata;
  metadata?: MixedbreadMetadata;
  score: number;
  text?: string;
}

// --- Heading Extraction ---

function extractHeadingTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("#")) {
    return "";
  }
  const firstLine = trimmed.split("\n")[0]?.trim();
  if (!firstLine) {
    return "";
  }
  return removeMd(firstLine, { useImgAltText: false });
}

// --- URL Building ---

function buildUrl(filePath: string, filename: string): string {
  if (filePath) {
    if (filePath.includes("content/docs/")) {
      const pathPart = filePath.split("content/docs/")[1] ?? "";
      return `/docs/${pathPart.replace(/\.mdx?$/, "").replace(/\/index$/, "")}`;
    }
    if (filePath.includes("content/api/")) {
      const pathPart = filePath.split("content/api/")[1] ?? "";
      return `/docs/api-reference/${pathPart.replace(/\.mdx?$/, "").replace(/\/index$/, "")}`;
    }
  }
  if (filename) {
    return `/docs/${filename.replace(/\.mdx?$/, "")}`;
  }
  return "#";
}

function buildSource(filePath: string): string {
  return filePath.includes("content/api/") ? "API Reference" : "Documentation";
}

const SNIPPET_MAX_CHARS = 120;

function buildSnippet(text: string | undefined): string | undefined {
  if (!text) {
    return;
  }
  const lines = text.trim().split("\n");
  const bodyLines = lines[0]?.startsWith("#") ? lines.slice(1) : lines;
  const body = bodyLines.join(" ").trim();
  if (!body) {
    return;
  }
  const stripped = removeMd(body, { useImgAltText: false }).trim();
  if (!stripped) {
    return;
  }
  return stripped.length > SNIPPET_MAX_CHARS
    ? `${stripped.slice(0, SNIPPET_MAX_CHARS)}…`
    : stripped;
}

// --- Transform ---

function transformResults(items: MixedbreadSearchItem[]): SortedResult[] {
  const slugger = new GithubSlugger();
  const results: SortedResult[] = [];

  for (const item of items) {
    const filePath = item.metadata?.file_path ?? "";
    const title =
      item.generated_metadata?.title ??
      item.filename.replace(/\.mdx?$/, "").replace(/-/g, " ");
    const url = buildUrl(filePath, item.filename);
    const source = buildSource(filePath);

    // Page result — carry score and snippet from the MXBai item
    results.push({
      id: `${item.file_id}-${item.chunk_index}-page`,
      type: "page",
      content: title,
      url,
      source,
      score: item.score,
      snippet: buildSnippet(item.text),
    });

    // Heading result (deep-link)
    if (item.text) {
      const headingTitle = extractHeadingTitle(item.text);
      if (headingTitle) {
        slugger.reset();
        results.push({
          id: `${item.file_id}-${item.chunk_index}-heading`,
          type: "heading",
          content: headingTitle,
          url: `${url}#${slugger.slug(headingTitle)}`,
          source,
        });
      }
    }
  }

  // Deduplicate by URL, keeping first occurrence (highest score — Mixedbread returns sorted)
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) {
      return false;
    }
    seen.add(r.url);
    return true;
  });
}

// --- GET Handler ---

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query");

    if (!query?.trim()) {
      return Response.json([]);
    }

    const response = await mxbaiClient.stores.search({
      query,
      store_identifiers: [env.MXBAI_STORE_ID],
      top_k: 10,
      search_options: {
        rerank: true,
        rewrite_query: true,
        score_threshold: 0.5,
        return_metadata: true,
      },
    });

    const results = transformResults(response.data as MixedbreadSearchItem[]);

    return Response.json(results);
  } catch (error) {
    console.error("Search error:", error);
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
