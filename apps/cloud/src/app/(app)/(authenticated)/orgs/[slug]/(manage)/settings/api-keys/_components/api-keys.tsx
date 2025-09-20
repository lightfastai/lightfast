"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/ui/table";
import { Card, CardContent, CardHeader } from "@repo/ui/components/ui/card";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@repo/ui/components/ui/dropdown-menu";
import { 
  Search, 
  X, 
  SortAsc, 
  Copy, 
  MoreHorizontal, 
  Ban, 
  Trash2, 
  Key, 
  AlertCircle, 
  RefreshCw,
  Calendar,
  Clock,
  Plus
} from "lucide-react";
import { useToast } from "@repo/ui/hooks/use-toast";
import { useTRPC } from "~/trpc/react";
import { 
  formatDate, 
  copyToClipboard, 
  getExpiryInfo, 
  getStatusBadgeProps 
} from "./api-keys.utils";
import type { 
  ApiKey, 
  FilterStatus, 
  SortOption 
} from "./api-keys.types";

interface ApiKeysProps {
  onCreateKey: () => void;
  isCreating?: boolean;
}

export function ApiKeys({ onCreateKey, isCreating = false }: ApiKeysProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("created");
  const [includeInactive, setIncludeInactive] = useState(false);

  const { toast } = useToast();
  const trpc = useTRPC();

  // Data fetching
  const {
    data: apiKeys,
    isLoading,
    error,
    refetch,
  } = useQuery({
    ...trpc.apiKey.list.queryOptions({ includeInactive }),
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // Mutations
  const revokeMutation = useMutation(
    trpc.apiKey.revoke.mutationOptions({
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
    })
  );

  const deleteMutation = useMutation(
    trpc.apiKey.delete.mutationOptions({
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
    })
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [localSearch]);

  // Filter and sort logic
  const filteredAndSortedKeys = useMemo(() => {
    if (!apiKeys) return [];

    let filtered = [...apiKeys];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(key =>
        key.name.toLowerCase().includes(query) ||
        key.keyPreview.toLowerCase().includes(query)
      );
    }

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

  // Event handlers
  const handleRevoke = useCallback(async (keyId: string, keyName: string) => {
    await revokeMutation.mutateAsync({ keyId });
  }, [revokeMutation]);

  const handleDelete = useCallback(async (keyId: string, keyName: string) => {
    await deleteMutation.mutateAsync({ keyId });
  }, [deleteMutation]);

  const clearFilters = useCallback(() => {
    setLocalSearch("");
    setSearchQuery("");
    setStatusFilter("all");
    setSortBy("created");
    setIncludeInactive(false);
  }, []);

  const hasActiveFilters = 
    searchQuery !== "" || 
    statusFilter !== "all" || 
    sortBy !== "created" || 
    includeInactive;

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <FiltersSkeleton />
        <div className="space-y-4">
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

  // Error state
  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
        <AlertCircle className="size-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load API keys: {error.message}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-4">
            <RefreshCw className="size-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Empty state
  if (!apiKeys || apiKeys.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <Key className="size-16 text-muted-foreground mb-6" />
          <h3 className="text-xl font-semibold mb-3">No API keys yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            Create your first API key to start using the Lightfast API in your applications.
          </p>
          <Button onClick={onCreateKey} disabled={isCreating}>
            <Plus className="size-4 mr-2" />
            {isCreating ? "Creating..." : "Create API Key"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              placeholder="Search API keys..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-10 pr-10"
            />
            {localSearch && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setLocalSearch("")}
              >
                <X className="size-3" />
              </Button>
            )}
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FilterStatus)}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SortAsc className="size-4" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Created Date</SelectItem>
              <SelectItem value="lastUsed">Last Used</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={setIncludeInactive}
              />
              <label htmlFor="include-inactive" className="text-sm font-medium cursor-pointer">
                Show inactive keys
              </label>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear filters
              </Button>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {filteredAndSortedKeys.length === apiKeys.length ? (
              <span>{apiKeys.length} key{apiKeys.length !== 1 ? "s" : ""}</span>
            ) : (
              <span>
                {filteredAndSortedKeys.length} of {apiKeys.length} key{apiKeys.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* No results after filtering */}
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
          {/* Desktop Table */}
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
                            onClick={() => copyToClipboard(key.keyPreview, "Key preview copied!")}
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                          >
                            <Copy className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge isActive={key.active} isExpired={key.isExpired} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(key.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                      </TableCell>
                      <TableCell>
                        <KeyActionsMenu 
                          apiKey={key}
                          onRevoke={handleRevoke}
                          onDelete={handleDelete}
                          isRevoking={revokeMutation.isPending}
                          isDeleting={deleteMutation.isPending}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredAndSortedKeys.map((key) => (
              <ApiKeyMobileCard
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

// Sub-components
function StatusBadge({ isActive, isExpired }: { isActive: boolean; isExpired?: boolean }) {
  const { label, className } = getStatusBadgeProps(isActive, isExpired);
  return <Badge variant="secondary" className={className}>{label}</Badge>;
}

function KeyActionsMenu({ 
  apiKey, 
  onRevoke, 
  onDelete, 
  isRevoking, 
  isDeleting 
}: {
  apiKey: ApiKey;
  onRevoke: (keyId: string, keyName: string) => void;
  onDelete: (keyId: string, keyName: string) => void;
  isRevoking: boolean;
  isDeleting: boolean;
}) {
  const isActionDisabled = isRevoking || isDeleting;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
          disabled={isActionDisabled}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => copyToClipboard(apiKey.keyPreview, "Key preview copied!")}>
          <Copy className="size-4" />
          Copy Preview
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {apiKey.active && (
          <DropdownMenuItem
            onClick={() => onRevoke(apiKey.id, apiKey.name)}
            className="text-orange-600 focus:text-orange-600 dark:text-orange-400"
            disabled={isRevoking}
          >
            <Ban className="size-4" />
            {isRevoking ? "Revoking..." : "Revoke Key"}
          </DropdownMenuItem>
        )}
        {!apiKey.active && (
          <DropdownMenuItem
            onClick={() => onDelete(apiKey.id, apiKey.name)}
            className="text-red-600 focus:text-red-600 dark:text-red-400"
            disabled={isDeleting}
          >
            <Trash2 className="size-4" />
            {isDeleting ? "Deleting..." : "Delete Key"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ApiKeyMobileCard({ 
  apiKey, 
  onRevoke, 
  onDelete, 
  isRevoking, 
  isDeleting 
}: {
  apiKey: ApiKey;
  onRevoke: (keyId: string, keyName: string) => void;
  onDelete: (keyId: string, keyName: string) => void;
  isRevoking: boolean;
  isDeleting: boolean;
}) {
  const isActionDisabled = isRevoking || isDeleting;
  const expiryInfo = getExpiryInfo(apiKey.expiresAt);

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-semibold text-base truncate">{apiKey.name}</h3>
            <div className="flex items-center gap-2">
              <StatusBadge isActive={apiKey.active} isExpired={apiKey.isExpired} />
            </div>
          </div>
          
          <KeyActionsMenu 
            apiKey={apiKey}
            onRevoke={onRevoke}
            onDelete={onDelete}
            isRevoking={isRevoking}
            isDeleting={isDeleting}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Key Preview
          </label>
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <Key className="size-4 text-muted-foreground shrink-0" />
            <code className="text-sm font-mono flex-1 truncate">
              {apiKey.keyPreview}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(apiKey.keyPreview, "Key preview copied!")}
              className="h-6 w-6 p-0 shrink-0"
            >
              <Copy className="size-3" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Created</span>
            <div className="flex items-center gap-1 text-foreground">
              <Calendar className="size-3" />
              {formatDate(apiKey.createdAt)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last used</span>
            <div className="flex items-center gap-1 text-foreground">
              <Clock className="size-3" />
              {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "Never"}
            </div>
          </div>

          {expiryInfo && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expiry</span>
              <div className={`flex items-center gap-1 text-sm ${expiryInfo.className}`}>
                <Calendar className="size-3" />
                {expiryInfo.text}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FiltersSkeleton() {
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