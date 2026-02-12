import type { NextRequest } from 'next/server';
import Mixedbread from '@mixedbread/sdk';
import { env } from '~/env';

export const runtime = 'edge';

const mxbaiClient = new Mixedbread({ apiKey: env.MXBAI_API_KEY });

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

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  snippet?: string;
  score: number;
  source: string;
}

function transformResults(items: MixedbreadSearchItem[]): SearchResult[] {
  const results: SearchResult[] = items.map((item) => {
    const filePath = item.metadata?.file_path ?? '';
    const generatedMetadata = item.generated_metadata;

    const title =
      generatedMetadata?.title ??
      item.filename.replace(/\.mdx?$/, '').replace(/-/g, ' ');

    const description = generatedMetadata?.description;

    let url = '';
    if (filePath) {
      if (filePath.includes('content/docs/')) {
        const pathPart = filePath.split('content/docs/')[1] ?? '';
        url = '/docs/' + pathPart.replace(/\.mdx?$/, '').replace(/\/index$/, '');
      } else if (filePath.includes('content/api/')) {
        const pathPart = filePath.split('content/api/')[1] ?? '';
        url = '/docs/api/' + pathPart.replace(/\.mdx?$/, '').replace(/\/index$/, '');
      }
    }
    if (!url && item.filename) {
      url = '/docs/' + item.filename.replace(/\.mdx?$/, '');
    }

    let snippet: string | undefined;
    if (item.text) {
      const withoutFrontmatter = item.text.replace(/^---[\s\S]*?---\s*/, '');
      snippet = withoutFrontmatter.substring(0, 200).trim();
    }

    const source = filePath.includes('content/api/')
      ? 'API Reference'
      : 'Documentation';

    return {
      id: `${item.file_id}-${item.chunk_index}`,
      title,
      description,
      url,
      snippet,
      score: item.score,
      source,
    };
  });

  // Deduplicate by URL, keeping highest score
  const seenUrls = new Map<string, SearchResult>();
  for (const result of results) {
    const existing = seenUrls.get(result.url);
    if (!existing || result.score > existing.score) {
      seenUrls.set(result.url, result);
    }
  }

  return Array.from(seenUrls.values());
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { query?: string };
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query is required' }, { status: 400 });
    }

    const response = await mxbaiClient.stores.search({
      query,
      store_identifiers: [env.MXBAI_STORE_ID],
      top_k: 10,
    });

    const results = transformResults(
      response.data as MixedbreadSearchItem[],
    );

    return Response.json({ data: results });
  } catch (error) {
    console.error('Search error:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
