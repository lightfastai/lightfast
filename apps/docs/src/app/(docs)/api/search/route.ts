import type { NextRequest } from 'next/server';
import Mixedbread from '@mixedbread/sdk';
import GithubSlugger from 'github-slugger';
import removeMd from 'remove-markdown';
import { env } from '~/env';

export const runtime = 'edge';

const mxbaiClient = new Mixedbread({ apiKey: env.MXBAI_API_KEY });

// --- Types ---

interface MixedbreadMetadata {
  file_path?: string;
  synced?: boolean;
  git_branch?: string;
  git_commit?: string;
  uploaded_at?: string;
}

interface MixedbreadGeneratedMetadata {
  title?: string;
  description?: string;
  keywords?: string;
  type?: string;
  file_type?: string;
  language?: string;
  word_count?: number;
}

interface MixedbreadSearchItem {
  file_id: string;
  chunk_index: number;
  filename: string;
  score: number;
  text?: string;
  metadata?: MixedbreadMetadata;
  generated_metadata?: MixedbreadGeneratedMetadata;
}

export interface SortedResult {
  id: string;
  url: string;
  type: 'page' | 'heading' | 'text';
  content: string;
  source: string;
}

// --- Heading Extraction ---

function extractHeadingTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('#')) return '';
  const firstLine = trimmed.split('\n')[0]?.trim();
  if (!firstLine) return '';
  return removeMd(firstLine, { useImgAltText: false });
}

// --- URL Building ---

function buildUrl(filePath: string, filename: string): string {
  if (filePath) {
    if (filePath.includes('content/docs/')) {
      const pathPart = filePath.split('content/docs/')[1] ?? '';
      return '/docs/' + pathPart.replace(/\.mdx?$/, '').replace(/\/index$/, '');
    }
    if (filePath.includes('content/api/')) {
      const pathPart = filePath.split('content/api/')[1] ?? '';
      return '/docs/api/' + pathPart.replace(/\.mdx?$/, '').replace(/\/index$/, '');
    }
  }
  if (filename) {
    return '/docs/' + filename.replace(/\.mdx?$/, '');
  }
  return '#';
}

function buildSource(filePath: string): string {
  return filePath.includes('content/api/') ? 'API Reference' : 'Documentation';
}

// --- Transform ---

function transformResults(items: MixedbreadSearchItem[]): SortedResult[] {
  const slugger = new GithubSlugger();
  const results: SortedResult[] = [];

  for (const item of items) {
    const filePath = item.metadata?.file_path ?? '';
    const title =
      item.generated_metadata?.title ??
      item.filename.replace(/\.mdx?$/, '').replace(/-/g, ' ');
    const url = buildUrl(filePath, item.filename);
    const source = buildSource(filePath);

    // Page result
    results.push({
      id: `${item.file_id}-${item.chunk_index}-page`,
      type: 'page',
      content: title,
      url,
      source,
    });

    // Heading result (deep-link)
    if (item.text) {
      const headingTitle = extractHeadingTitle(item.text);
      if (headingTitle) {
        slugger.reset();
        results.push({
          id: `${item.file_id}-${item.chunk_index}-heading`,
          type: 'heading',
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
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

// --- GET Handler ---

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('query');

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

    const results = transformResults(
      response.data as MixedbreadSearchItem[],
    );

    return Response.json(results);
  } catch (error) {
    console.error('Search error:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
