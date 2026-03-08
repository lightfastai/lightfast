"use client";

import type { V1SearchResponse } from "@repo/console-types";
import {
  CodeBlock,
  CodeBlockContent,
} from "@repo/ui/components/ai-elements/code-block";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { SearchEmptyState } from "./search-empty-state";
import { SearchResultsList } from "./search-results-list";
import { SearchTabContent } from "./search-tab-content";

interface SearchResultsPanelProps {
  activeTab: string;
  expandedId: string;
  offset: number;
  onActiveTabChange: (tab: string) => void;
  onExpandedIdChange: (id: string) => void;
  searchResults: V1SearchResponse | null;
  storeId: string;
}

export function SearchResultsPanel({
  searchResults,
  activeTab,
  onActiveTabChange,
  expandedId,
  onExpandedIdChange,
  offset,
  storeId,
}: SearchResultsPanelProps) {
  return (
    <Tabs
      className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2"
      onValueChange={(value) => onActiveTabChange(value as "list" | "json")}
      value={activeTab}
    >
      <div className="px-4">
        <TabsList>
          <TabsTrigger className="text-xs" value="list">
            List
          </TabsTrigger>
          <TabsTrigger className="text-xs" value="json">
            JSON
          </TabsTrigger>
        </TabsList>
      </div>

      {/* List Tab */}
      <TabsContent
        className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden"
        value="list"
      >
        <SearchTabContent>
          {searchResults ? (
            <SearchResultsList
              expandedId={expandedId}
              offset={offset}
              onExpandedIdChange={onExpandedIdChange}
              searchResults={searchResults}
              storeId={storeId}
            />
          ) : (
            <SearchEmptyState message="Run a search to see results" />
          )}
        </SearchTabContent>
      </TabsContent>

      {/* JSON Tab */}
      <TabsContent
        className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden"
        value="json"
      >
        <SearchTabContent>
          {searchResults ? (
            <CodeBlock className="scrollbar-thin h-full overflow-auto rounded-sm border">
              <CodeBlockContent
                className="p-3"
                code={JSON.stringify(searchResults, null, 2)}
                language="json"
              />
            </CodeBlock>
          ) : (
            <SearchEmptyState message="Run a search to see the raw JSON response" />
          )}
        </SearchTabContent>
      </TabsContent>
    </Tabs>
  );
}
