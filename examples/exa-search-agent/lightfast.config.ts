import { createLightfast } from "lightfast";
import { createAgent } from "lightfast/agent";
import { createTool } from "lightfast/tool";
import Exa from "exa-js";
import { z } from "zod";

// This demonstrates a complex npm dependency (exa-js) in a Lightfast agent
// The ExaJS library is ~45MB and includes many Node.js dependencies

const searchTool = createTool({
  name: "exaSearch",
  description: "Search the web using Exa's neural search API",
  schema: z.object({
    query: z.string().describe("The search query"),
    numResults: z.number().min(1).max(20).default(10).describe("Number of results to return"),
    includeDomains: z.array(z.string()).optional().describe("Domains to include in search"),
    excludeDomains: z.array(z.string()).optional().describe("Domains to exclude from search"),
    startCrawlDate: z.string().optional().describe("Start date for content (YYYY-MM-DD)"),
    endCrawlDate: z.string().optional().describe("End date for content (YYYY-MM-DD)"),
    type: z.enum(["neural", "keyword"]).default("neural").describe("Search type")
  }),
  execute: async ({ 
    query, 
    numResults = 10, 
    includeDomains, 
    excludeDomains, 
    startCrawlDate, 
    endCrawlDate, 
    type = "neural" 
  }, { env }) => {
    console.log(`[EXA-SEARCH] Executing search: "${query}"`);
    
    // Initialize Exa client - this requires the complex ExaJS dependency
    const exa = new Exa(env.EXA_API_KEY);
    
    try {
      const searchOptions: any = {
        numResults,
        type,
        contents: {
          text: true,
          summary: true,
          highlights: true
        }
      };
      
      // Add optional filters
      if (includeDomains && includeDomains.length > 0) {
        searchOptions.includeDomains = includeDomains;
      }
      
      if (excludeDomains && excludeDomains.length > 0) {
        searchOptions.excludeDomains = excludeDomains;
      }
      
      if (startCrawlDate) {
        searchOptions.startCrawlDate = startCrawlDate;
      }
      
      if (endCrawlDate) {
        searchOptions.endCrawlDate = endCrawlDate;
      }
      
      console.log(`[EXA-SEARCH] Search options:`, searchOptions);
      
      // Execute the search using ExaJS
      const results = await exa.search(query, searchOptions);
      
      console.log(`[EXA-SEARCH] Found ${results.results.length} results`);
      
      // Transform results for better readability
      const transformedResults = results.results.map((result, index) => ({
        rank: index + 1,
        title: result.title,
        url: result.url,
        summary: result.summary,
        text: result.text?.substring(0, 500) + (result.text?.length > 500 ? '...' : ''),
        highlights: result.highlights,
        publishedDate: result.publishedDate,
        score: result.score
      }));
      
      return {
        query,
        searchType: type,
        totalResults: transformedResults.length,
        results: transformedResults,
        metadata: {
          searchId: results.autopromptString,
          executedAt: new Date().toISOString(),
          processingTime: `${Date.now() - Date.now()}ms`
        }
      };
      
    } catch (error) {
      console.error(`[EXA-SEARCH] Search failed:`, error);
      
      return {
        query,
        error: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown search error',
        results: [],
        totalResults: 0
      };
    }
  }
});

// Create a research agent that uses the complex ExaJS dependency
const researchAgent = createAgent({
  name: "Research Assistant",
  description: "AI-powered research assistant using Exa's neural search to find and analyze information",
  system: `You are a highly capable research assistant powered by Exa's neural search technology.

Your capabilities:
- Search the web using advanced neural search algorithms
- Find recent, high-quality sources on any topic
- Analyze and synthesize information from multiple sources
- Provide comprehensive research summaries with citations

When a user asks you to research something:
1. Use the exaSearch tool to find relevant, recent sources
2. Analyze the results critically
3. Provide a comprehensive summary with proper citations
4. Suggest follow-up searches if needed

Always cite your sources with URLs and publication dates when available.`,
  
  model: "claude-3-5-sonnet-20241022",
  
  tools: {
    search: searchTool
  }
});

// Create Lightfast configuration
export default createLightfast({
  agents: {
    researcher: researchAgent
  },
  
  metadata: {
    name: "ExaJS Research Agent",
    description: "Demonstration of complex npm dependency (ExaJS) in Lightfast Node.js runtime",
    version: "1.0.0",
    dependencies: {
      "exa-js": "^1.0.19",
      "zod": "^3.22.4"
    }
  }
});

// Export for Node.js bundling test
export { researchAgent, searchTool };