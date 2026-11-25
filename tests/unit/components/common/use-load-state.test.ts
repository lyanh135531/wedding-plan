import { describe, it, expect } from 'vitest';
import { resolveLoadStart } from '@/components/common/useLoadState';

describe('useLoadState / resolveLoadStart', () => {
  it('shows full loading state on initial load before any scope has succeeded', () => {
    expect(resolveLoadStart(null, 'event-1')).toEqual({
      isBackgroundRefresh: false,
      visibility: { loading: true, refreshing: false },
    });
  });

  it('treats reloads within the same loaded scope as silent background refreshes', () => {
    expect(resolveLoadStart('event-1', 'event-1')).toEqual({
      isBackgroundRefresh: true,
      visibility: { loading: false, refreshing: true },
    });
  });

  it('shows full loading state again when switching to a different scope key', () => {
    expect(resolveLoadStart('event-1', 'event-2')).toEqual({
      isBackgroundRefresh: false,
      visibility: { loading: true, refreshing: false },
    });
  });
});
