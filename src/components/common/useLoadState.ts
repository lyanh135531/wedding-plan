'use client';

import { useCallback, useRef, useState } from 'react';

export interface LoadVisibility {
  loading: boolean;
  refreshing: boolean;
}

/**
 * Determines whether a data load for `nextScope` should display full initial
 * loading state or run as a background refresh that preserves mounted DOM and scroll.
 */
export function resolveLoadStart(
  loadedScope: string | null,
  nextScope: string
): {
  isBackgroundRefresh: boolean;
  visibility: LoadVisibility;
} {
  const isBackgroundRefresh = loadedScope !== null && loadedScope === nextScope;
  return {
    isBackgroundRefresh,
    visibility: {
      loading: !isBackgroundRefresh,
      refreshing: isBackgroundRefresh,
    },
  };
}

/**
 * Separates initial/scope-switch loading from same-scope background refreshes
 * so rendered lists, cards, and scroll positions remain intact after mutations.
 */
export function useLoadState(initialLoading = true, initialScope: string | null = null) {
  const [loading, setLoading] = useState(initialLoading);
  const [refreshing, setRefreshing] = useState(false);
  const loadedScopeRef = useRef<string | null>(initialScope);

  const beginLoad = useCallback((scopeKey = 'default') => {
    const { isBackgroundRefresh, visibility } = resolveLoadStart(
      loadedScopeRef.current,
      scopeKey
    );
    if (!isBackgroundRefresh) {
      loadedScopeRef.current = null;
    }
    setLoading(visibility.loading);
    setRefreshing(visibility.refreshing);
    return isBackgroundRefresh;
  }, []);

  const markLoaded = useCallback((scopeKey = 'default') => {
    loadedScopeRef.current = scopeKey;
    setLoading(false);
    setRefreshing(false);
  }, []);

  const finishLoad = useCallback(() => {
    setLoading(false);
    setRefreshing(false);
  }, []);

  return { loading, refreshing, loadedScopeRef, beginLoad, markLoaded, finishLoad };
}
