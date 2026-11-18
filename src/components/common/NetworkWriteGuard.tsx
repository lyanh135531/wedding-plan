'use client';

import { useEffect } from 'react';

export const OFFLINE_WRITE_MESSAGE = 'Đang mất mạng. Dữ liệu nhập vẫn được giữ; hãy kết nối lại trước khi lưu.';

export function createOfflineSafeFetch(
  fetchImpl: typeof fetch,
  isOnline: () => boolean,
  origin: string
): typeof fetch {
  return (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, origin);
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (!isOnline() && url.origin === origin && url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return Promise.reject(new Error(OFFLINE_WRITE_MESSAGE));
    }
    return fetchImpl(input, init);
  };
}

/** One write barrier for all application API fetches and form submissions, including dialogs. */
export function NetworkWriteGuard() {
  useEffect(() => {
    const original = window.fetch;
    const guarded = createOfflineSafeFetch(original.bind(window), () => navigator.onLine, window.location.origin);
    window.fetch = guarded;
    const preventOfflineSubmit = (event: SubmitEvent) => {
      if (!navigator.onLine) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener('submit', preventOfflineSubmit, true);
    return () => {
      if (window.fetch === guarded) window.fetch = original;
      document.removeEventListener('submit', preventOfflineSubmit, true);
    };
  }, []);
  return null;
}
