"use client";

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/ui/table";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Card, CardContent, CardHeader } from "@repo/ui/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@repo/ui/components/ui/dropdown-menu";
import { Copy, MoreHorizontal, Ban, Trash2, Key, AlertCircle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@repo/ui/hooks/use-toast";

import { useTRPC } from "~/trpc/react";
import { KeyStatusBadge } from "./key-status-badge";
import { ApiKeyCard } from "./api-key-card";
import { ListFilters } from "./list-filters";
import type { FilterStatus, SortOption } from "./list-filters";
import { EmptyState } from "./empty-state";


interface ApiKeyListProps {
  onCreateKey: () => void;
  isCreating?: boolean;
}

export function ApiKeyList({ onCreateKey, isCreating = false }: ApiKeyListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("created");
  const [includeInactive, setIncludeInactive] = useState(false);
  const { toast } = useToast();

  const api = useTRPC();
  
  if (!api?.apiKey?.list) {
    return (
      <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
        <AlertCircle className="size-4" />
        <AlertDescription>
          API not available. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  const {
    data: apiKeys,
    isLoading,
    error,
    refetch,
  } = (api as any).apiKey.list.useQuery(
    { includeInactive },
    {
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds
    }
  );

  const revokeMutation = (api as any).apiKey.revoke.useMutation({
    onSuccess: (data: any) => {
      toast({
        title: "API key revoked",
        description: data.message,
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to revoke API key",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = (api as any).apiKey.delete.useMutation({
    onSuccess: (data: any) => {
      toast({
        title: "API key deleted",
        description: data.message,
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete API key",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Filter and sort the API keys
  const filteredAndSortedKeys = useMemo(() => {
    if (!apiKeys) return [];

    let filtered = [...apiKeys];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(key =>
        key.name.toLowerCase().includes(query) ||
        key.keyPreview.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(key => {
        switch (statusFilter) {
          case "active":
            return key.active && !key.isExpired;
          case "expired":
            return key.isExpired;
          case "revoked":
            return !key.active;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "lastUsed":
          if (!a.lastUsedAt && !b.lastUsedAt) return 0;
          if (!a.lastUsedAt) return 1;
          if (!b.lastUsedAt) return -1;
          return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
        case "created":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [apiKeys, searchQuery, statusFilter, sortBy]);

  const handleRevoke = async (keyId: string, keyName: string) => {
    await revokeMutation.mutateAsync({ keyId });
  };

  const handleDelete = async (keyId: string, keyName: string) => {
    await deleteMutation.mutateAsync({ keyId });
  };

  const copyKeyPreview = async (keyPreview: string) => {
    try {
      await navigator.clipboard.writeText(keyPreview);
      toast({
        title: "Copied to clipboard",
        description: "Key preview copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Failed to copy key preview",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return "Unknown";
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSortBy("created");
    setIncludeInactive(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ListFiltersSkeleton />
        <div className="space-y-4">
          {/* Desktop table skeleton */}
          <div className="hidden md:block">
            <div className="border rounded-lg">
              <div className="p-4">
                <Skeleton className="h-6 w-full mb-4" />
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex justify-between py-3 border-b last:border-b-0">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Mobile cards skeleton */}
          <div className="md:hidden space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-16" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
        <AlertCircle className="size-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load API keys: {error.message}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="ml-4"
          >
            <RefreshCw className="size-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!apiKeys || apiKeys.length === 0) {
    return <EmptyState onCreateKey={onCreateKey} isCreating={isCreating} />;
  }

  return (
    <div className="space-y-6">
      <ListFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        includeInactive={includeInactive}
        onIncludeInactiveChange={setIncludeInactive}
        onClearFilters={clearFilters}
        totalCount={apiKeys.length}
        filteredCount={filteredAndSortedKeys.length}
      />

      {filteredAndSortedKeys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Key className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No matching keys</h3>
            <p className="text-muted-foreground text-sm mb-4">
              No API keys match your current filters. Try adjusting your search or filter criteria.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedKeys.map((key) => (
                    <TableRow key={key.id} className="group">
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {key.keyPreview}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyKeyPreview(key.keyPreview)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                          >
                            <Copy className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <KeyStatusBadge
                          isActive={key.active}
                          isExpired={key.isExpired}
                          expiresAt={key.expiresAt}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(key.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                              disabled={revokeMutation.isPending || deleteMutation.isPending}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => copyKeyPreview(key.keyPreview)}>
                              <Copy className="size-4" />
                              Copy Preview
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {key.active && (
                              <DropdownMenuItem
                                onClick={() => handleRevoke(key.id, key.name)}
                                className="text-orange-600 focus:text-orange-600 dark:text-orange-400"
                                disabled={revokeMutation.isPending}
                              >
                                <Ban className="size-4" />
                                {revokeMutation.isPending ? "Revoking..." : "Revoke Key"}
                              </DropdownMenuItem>
                            )}
                            {!key.active && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(key.id, key.name)}
                                className="text-red-600 focus:text-red-600 dark:text-red-400"
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="size-4" />
                                {deleteMutation.isPending ? "Deleting..." : "Delete Key"}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredAndSortedKeys.map((key) => (
              <ApiKeyCard
                key={key.id}
                apiKey={key}
                onRevoke={handleRevoke}
                onDelete={handleDelete}
                isRevoking={revokeMutation.isPending}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ListFiltersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <Skeleton className="h-10 flex-1 max-w-sm" />
        <Skeleton className="h-10 w-full sm:w-[140px]" />
        <Skeleton className="h-10 w-full sm:w-[140px]" />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}