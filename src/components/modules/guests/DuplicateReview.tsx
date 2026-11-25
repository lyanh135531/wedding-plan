'use client';

import React, { useState } from 'react';
import { api, jsonBody } from '@/lib/api/request';
import { Button } from '@/components/ui/button';
import { MergeGuestsModal, DuplicatePairSummary } from './MergeGuestsModal';
import { GuestOwnerDto } from '@/schemas/guests';
import { GitMerge, Loader2, X } from 'lucide-react';

export interface DuplicateReviewState {
  pairs: DuplicatePairSummary[] | null;
  selected: DuplicatePairSummary | null;
  busy: boolean;
  error: string;
  checkDuplicates: () => Promise<void>;
  selectPair: (pair: DuplicatePairSummary | null) => void;
  dismissResults: () => void;
}

/**
 * Shared state hook for checking duplicate guest candidates and managing merge modal selection.
 */
export function useDuplicateReview(): DuplicateReviewState {
  const [pairs, setPairs] = useState<DuplicatePairSummary[] | null>(null);
  const [selected, setSelected] = useState<DuplicatePairSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const checkDuplicates = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await api<{
        data: { guest_a: GuestOwnerDto; guest_b: GuestOwnerDto; match_reasons: string[] }[];
      }>('/api/v1/duplicate-candidates');
      const mapGuest = (g: GuestOwnerDto) => ({
        id: g.id,
        displayName: g.display_name,
        side: g.side,
        phone: g.phone,
        email: g.email,
        address: g.address,
        subTags: g.sub_tags,
      });
      setPairs(response.data.map((p) => ({ ...p, guest_a: mapGuest(p.guest_a), guest_b: mapGuest(p.guest_b) })));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return {
    pairs,
    selected,
    busy,
    error,
    checkDuplicates,
    selectPair: setSelected,
    dismissResults: () => {
      setPairs(null);
      setError('');
    },
  };
}

/**
 * Compact trigger button for duplicate candidate scanning.
 */
export function DuplicateReviewTrigger({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-border-subtle bg-surface text-xs font-medium text-text-main hover:bg-page hover:border-border-control transition-colors disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" aria-hidden="true" />
      ) : (
        <GitMerge className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
      )}
      <span>Rà soát khách có thể trùng</span>
    </button>
  );
}

/**
 * Dismissible inline banner showing duplicate check results and opening MergeGuestsModal.
 */
export function DuplicateReviewResults({
  state,
  reload,
}: {
  state: DuplicateReviewState;
  reload: () => Promise<void>;
}) {
  const { pairs, selected, error, selectPair, dismissResults } = state;

  if (!error && pairs === null && !selected) return null;

  return (
    <div className="space-y-2">
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-control bg-danger-bg border border-danger/20 text-xs text-danger"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={dismissResults}
            aria-label="Đóng thông báo lỗi"
            className="p-1 rounded hover:bg-black/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {pairs?.length === 0 && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-control bg-page border border-border-subtle text-xs text-text-muted">
          <span>Không tìm thấy hồ sơ có thể trùng.</span>
          <button
            type="button"
            onClick={dismissResults}
            aria-label="Đóng thông báo"
            className="p-1 rounded hover:bg-black/5 text-text-muted hover:text-text-main"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {pairs && pairs.length > 0 && (
        <div className="rounded-control bg-warning-bg/60 border border-warning/25 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-warning">
              Phát hiện {pairs.length} cặp hồ sơ có thể trùng
            </span>
            <button
              type="button"
              onClick={dismissResults}
              aria-label="Ẩn danh sách trùng"
              className="p-1 rounded hover:bg-black/5 text-text-muted hover:text-text-main"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {pairs.map((p) => (
              <div
                key={`${p.guest_a.id}:${p.guest_b.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-control bg-surface border border-border-subtle text-xs"
              >
                <span className="font-medium text-text-main">
                  {p.guest_a.displayName} <span className="text-text-muted mx-1">/</span> {p.guest_b.displayName}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 min-h-[32px] px-3 text-xs"
                  onClick={() => selectPair(p)}
                >
                  So sánh & Gộp
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <MergeGuestsModal
          isOpen
          candidatePair={selected}
          onClose={() => selectPair(null)}
          onMergeSubmit={(body) => api('/api/v1/merge', { method: 'POST', body: jsonBody(body) })}
          onMergeSuccess={() => {
            selectPair(null);
            dismissResults();
            void reload();
          }}
        />
      )}
    </div>
  );
}

/**
 * Self-contained duplicate review widget preserving the original simple API.
 */
export function DuplicateReview({ reload }: { reload: () => Promise<void> }) {
  const state = useDuplicateReview();
  return (
    <div className="space-y-2">
      <DuplicateReviewTrigger busy={state.busy} onClick={() => void state.checkDuplicates()} />
      <DuplicateReviewResults state={state} reload={reload} />
    </div>
  );
}
