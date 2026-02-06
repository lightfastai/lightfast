"use client";

import type { V1SearchResponse } from "@repo/console-types";
import {
  CodeBlock,
  CodeBlockContent,
} from "@repo/ui/components/ai-elements/code-block";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@repo/ui/components/ui/tabs";
import { SearchResultsList } from "./search-results-list";
import { SearchEmptyState } from "./search-empty-state";
import { SearchTabContent } from "./search-tab-content";

interface SearchResultsPanelProps {
  searchResults: V1SearchResponse | null;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  expandedId: string;
  onExpandedIdChange: (id: string) => void;
  offset: number;
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
      value={activeTab}
      onValueChange={(value) => onActiveTabChange(value as "list" | "json")}
      className="flex flex-col flex-1 overflow-hidden min-h-0 pt-2"
    >
      <div className="px-4">
        <TabsList>
          <TabsTrigger value="list" className="text-xs">
            List
          </TabsTrigger>
          <TabsTrigger value="json" className="text-xs">
            JSON
          </TabsTrigger>
        </TabsList>
      </div>

      {/* List Tab */}
      <TabsContent
        value="list"
        className="m-0 flex flex-col flex-1 overflow-hidden min-h-0"
      >
        <SearchTabContent>
          {searchResults ? (
            <SearchResultsList
              searchResults={searchResults}
              expandedId={expandedId}
              onExpandedIdChange={onExpandedIdChange}
              offset={offset}
              storeId={storeId}
            />
          ) : (
            <SearchEmptyState message="Run a search to see results" />
          )}
        </SearchTabContent>
      </TabsContent>

      {/* JSON Tab */}
      <TabsContent
        value="json"
        className="m-0 flex flex-col flex-1 overflow-hidden min-h-0"
      >
        <SearchTabContent>
          {searchResults ? (
            <CodeBlock className="h-full overflow-auto border rounded-sm scrollbar-thin">
              <CodeBlockContent
                code={JSON.stringify(searchResults, null, 2)}
                language="json"
                className="p-3"
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
