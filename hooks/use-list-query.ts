"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient, type QueryParams } from "@/lib/api/client";
import { toast } from "@/components/ui/toast-notification";
import type { DataTablePaginationType } from "@/components/ui/data-table";

/**
 * Server-driven list state for DataTable screens.
 *
 * Owns the page/search/tab/sort/filter state, keeps it mirrored in the
 * URL (replaceState, so no history spam), fetches from `endpoint` with
 * the standard query params (`page`, `limit`, `search`, `sortBy`,
 * `sortOrder`, tab + filters), unwraps both paginated and plain-array
 * responses, and ignores out-of-order responses from stale requests.
 *
 * The returned handlers plug directly into DataTable's callbacks.
 */
export interface UseListQueryOptions<T = unknown> {
  endpoint: string;
  /**
   * Custom payload parser for endpoints that don't return the standard
   * `{ data, pagination }` shape. Receives the unwrapped envelope data.
   */
  select?: (payload: unknown) => ListSelection<T>;
  initialPage?: number;
  initialPageSize?: number;
  initialSearch?: string;
  /** Initial tab id; "all" means no tab param is sent. */
  initialTab?: string;
  /** Query param the active tab maps to. Defaults to "status". */
  tabParam?: string;
  initialSortBy?: string;
  initialSortOrder?: "asc" | "desc";
  /** Filter values keyed by filter id; "all" values are not sent. */
  initialFilters?: Record<string, string>;
  /** Static params merged into every request (e.g. { scope: "vendor" }). */
  extraParams?: QueryParams;
  /** Last-chance transform of the outgoing query params. */
  mapQuery?: (params: QueryParams) => QueryParams;
  /** Mirror state into the URL query string. Defaults to true. */
  syncUrl?: boolean;
  /** Toast shown when loading fails (pass a translated string). */
  errorMessage?: string;
}

export interface ListSelection<T> {
  items: T[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface UseListQueryResult<T> {
  items: T[];
  /** Raw unwrapped payload of the last successful response. */
  rawData: unknown;
  isLoading: boolean;
  pagination: DataTablePaginationType;
  search: string;
  activeTab: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  filters: Record<string, string>;
  refetch: () => void;
  updateUrlParams: (updates: Record<string, string | undefined>) => void;
  handleSearchChange: (value: string) => void;
  handleTabChange: (tabId: string) => void;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (pageSize: number) => void;
  handleSortChange: (column: string, direction: "asc" | "desc") => void;
  handleFilterChange: (filterId: string, value: string) => void;
}

interface PaginatedPayload<T> {
  data: T[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export function useListQuery<T>(
  options: UseListQueryOptions<T>,
): UseListQueryResult<T> {
  const {
    endpoint,
    select,
    initialPage = 1,
    initialPageSize = 10,
    initialSearch = "",
    initialTab = "all",
    tabParam = "status",
    initialSortBy = "createdAt",
    initialSortOrder = "desc",
    initialFilters,
    extraParams,
    mapQuery,
    syncUrl = true,
    errorMessage = "Failed to load data",
  } = options;

  const searchParams = useSearchParams();

  const [items, setItems] = useState<T[]>([]);
  const [rawData, setRawData] = useState<unknown>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<DataTablePaginationType>({
    page: initialPage,
    pageSize: initialPageSize,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState(initialSearch);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortOrder);
  const [filters, setFilters] = useState<Record<string, string>>(
    initialFilters ?? {},
  );
  const [refreshKey, setRefreshKey] = useState(0);

  // Drop responses that arrive after a newer request was issued.
  const requestIdRef = useRef(0);

  // Keep unstable-by-reference options out of the fetch effect's deps.
  // This sync effect is declared first so it runs before the fetch effect.
  const extraParamsRef = useRef(extraParams);
  const mapQueryRef = useRef(mapQuery);
  const errorMessageRef = useRef(errorMessage);
  const selectRef = useRef(select);
  useEffect(() => {
    extraParamsRef.current = extraParams;
    mapQueryRef.current = mapQuery;
    errorMessageRef.current = errorMessage;
    selectRef.current = select;
  });

  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      try {
        let params: QueryParams = {
          page: pagination.page,
          limit: pagination.pageSize,
          search: search.trim() || undefined,
          sortBy,
          sortOrder,
          ...extraParamsRef.current,
        };
        if (activeTab && activeTab !== "all") params[tabParam] = activeTab;
        for (const [key, value] of Object.entries(
          JSON.parse(filtersKey) as Record<string, string>,
        )) {
          if (value && value !== "all") params[key] = value;
        }
        if (mapQueryRef.current) params = mapQueryRef.current(params);

        const payload = await apiClient.get<PaginatedPayload<T> | T[]>(
          endpoint,
          { query: params, signal: controller.signal },
        );
        if (controller.signal.aborted || requestId !== requestIdRef.current)
          return;

        setRawData(payload);

        let nextItems: T[];
        let pager: PaginatedPayload<T>["pagination"];
        if (selectRef.current) {
          const selected = selectRef.current(payload);
          nextItems = selected.items;
          pager = selected.pagination;
        } else if (Array.isArray(payload)) {
          nextItems = payload;
        } else {
          nextItems = payload?.data ?? [];
          pager = payload?.pagination;
        }

        setItems(nextItems);
        if (pager) {
          setPagination((prev) => ({
            page: pager.page || prev.page,
            pageSize: pager.limit || prev.pageSize,
            total: pager.total ?? prev.total,
            totalPages: pager.totalPages || 1,
          }));
        } else if (Array.isArray(payload) && !selectRef.current) {
          setPagination((prev) => ({
            ...prev,
            total: nextItems.length,
            totalPages: 1,
          }));
        }
      } catch (error) {
        // Swallow aborts from the effect cleanup / superseded requests. React
        // re-runs this effect (StrictMode in dev, or when a dep changes) and the
        // cleanup calls `controller.abort()`, which rejects the in-flight fetch
        // with a DOMException ("signal is aborted without reason"). That is
        // expected teardown, not a real failure — don't surface or toast it.
        if (
          controller.signal.aborted ||
          requestId !== requestIdRef.current ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        console.error(`Failed to fetch ${endpoint}:`, error);
        toast.error(errorMessageRef.current);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [
    endpoint,
    pagination.page,
    pagination.pageSize,
    search,
    activeTab,
    tabParam,
    sortBy,
    sortOrder,
    filtersKey,
    refreshKey,
  ]);

  const refetch = useCallback(() => setRefreshKey((key) => key + 1), []);

  const updateUrlParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      if (!syncUrl) return;
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (!value || value === "all" || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        query ? `?${query}` : window.location.pathname,
      );
    },
    [searchParams, syncUrl],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
      updateUrlParams({ search: value, page: undefined });
    },
    [updateUrlParams],
  );

  const handleTabChange = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      setPagination((prev) => ({ ...prev, page: 1 }));
      updateUrlParams({ [tabParam]: tabId, page: undefined });
    },
    [tabParam, updateUrlParams],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setPagination((prev) => ({ ...prev, page }));
      updateUrlParams({ page: String(page) });
    },
    [updateUrlParams],
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      setPagination((prev) => ({ ...prev, page: 1, pageSize }));
      updateUrlParams({ page: undefined });
    },
    [updateUrlParams],
  );

  const handleSortChange = useCallback(
    (column: string, direction: "asc" | "desc") => {
      setSortBy(column);
      setSortOrder(direction);
      setPagination((prev) => ({ ...prev, page: 1 }));
      updateUrlParams({ sortBy: column, sortOrder: direction, page: undefined });
    },
    [updateUrlParams],
  );

  const handleFilterChange = useCallback(
    (filterId: string, value: string) => {
      setFilters((prev) => ({ ...prev, [filterId]: value }));
      setPagination((prev) => ({ ...prev, page: 1 }));
      updateUrlParams({ [filterId]: value, page: undefined });
    },
    [updateUrlParams],
  );

  return useMemo(
    () => ({
      items,
      rawData,
      isLoading,
      pagination,
      search,
      activeTab,
      sortBy,
      sortOrder,
      filters,
      refetch,
      updateUrlParams,
      handleSearchChange,
      handleTabChange,
      handlePageChange,
      handlePageSizeChange,
      handleSortChange,
      handleFilterChange,
    }),
    [
      items,
      rawData,
      isLoading,
      pagination,
      search,
      activeTab,
      sortBy,
      sortOrder,
      filters,
      refetch,
      updateUrlParams,
      handleSearchChange,
      handleTabChange,
      handlePageChange,
      handlePageSizeChange,
      handleSortChange,
      handleFilterChange,
    ],
  );
}
