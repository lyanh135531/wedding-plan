'use client';

import { useEffect, useMemo, useState } from 'react';

export interface UsePaginationOptions {
  defaultPageSize?: number;
  resetKey?: unknown;
}

export interface PaginationResult<T> {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  pagedItems: T[];
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

/**
 * Pure helper returning the clamped current page and sliced items for a page window.
 */
export function paginateSlice<T>(items: readonly T[], currentPage: number, pageSize: number) {
  const safeSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * safeSize;
  return {
    currentPage: safePage,
    totalItems,
    totalPages,
    pagedItems: items.slice(start, start + safeSize),
  };
}

/**
 * Client-side pagination hook that clamps the active page to valid bounds
 * and resets to page 1 when `resetKey` changes.
 */
export function usePagination<T>(
  items: readonly T[],
  options: UsePaginationOptions = {}
): PaginationResult<T> {
  const { defaultPageSize = 25, resetKey } = options;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const sliced = useMemo(
    () => paginateSlice(items, page, pageSize),
    [items, page, pageSize]
  );

  const setPageSize = (nextSize: number) => {
    setPageSizeState(Math.max(1, nextSize));
    setPage(1);
  };

  return {
    currentPage: sliced.currentPage,
    pageSize,
    totalItems: sliced.totalItems,
    totalPages: sliced.totalPages,
    pagedItems: sliced.pagedItems,
    setCurrentPage: setPage,
    setPageSize,
  };
}
