import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Mixedbread from '@mixedbread/sdk';
import { env } from '~/env';

// Initialize Mixedbread client with server-side API key
const mxbaiClient = new Mixedbread({ apiKey: env.MXBAI_API_KEY });

interface SearchRequestBody {
  query?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequestBody = await request.json() as SearchRequestBody;
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const response = await mxbaiClient.stores.search({
      query,
      store_identifiers: [env.MXBAI_STORE_ID],
      top_k: 10,
    });

    return NextResponse.json({ data: response.data });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
