'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Ban,
  Clock,
  Disc3,
  Edit3,
  ExternalLink,
  Music,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEventScope } from '@/context/EventScopeContext';
import { useRole } from '@/context/RoleContext';
import { api, jsonBody } from '@/lib/api/request';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useLoadState } from '@/components/common/useLoadState';
import type { PreparationItemDto } from '@/schemas/preparation';
import { MusicTrackModal } from './MusicTrackModal';
import {
  MUSIC_MOMENTS,
  type MusicViewFilter,
  type ParsedMusicTrack,
  computeMusicStats,
  detectStreamingSource,
  filterMusicTracks,
  formatDurationSeconds,
  formatTotalPlaylistDuration,
  getMomentMeta,
  parseMusicTrack,
} from './musicHelpers';

export function LiveMusicWorkspace() {
  const { isOwner } = useRole();
  const { currentScope, availableEvents, setScope } = useEventScope();
  const activeEvents = React.useMemo(
    () => availableEvents.filter((ev) => !ev.isCancelled),
    [availableEvents]
  );

  const eventId = React.useMemo(() => {
    if (activeEvents.some((ev) => ev.id === currentScope)) return currentScope;
    return activeEvents.find((ev) => ev.isRepresentative)?.id || activeEvents[0]?.id || '';
  }, [activeEvents, currentScope]);

  const activeEvent = activeEvents.find((ev) => ev.id === eventId);

  const [tracks, setTracks] = React.useState<ParsedMusicTrack[]>([]);
  const { loading, refreshing, beginLoad, markLoaded, finishLoad } = useLoadState();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Filters
  const [momentFilter, setMomentFilter] = React.useState<string>('all');
  const [viewFilter, setViewFilter] = React.useState<MusicViewFilter>('all');
  const [search, setSearch] = React.useState('');

  // Mutations / Modals
  const [modalTarget, setModalTarget] = React.useState<ParsedMusicTrack | null | undefined>(
    undefined
  );
  const [deleteTarget, setDeleteTarget] = React.useState<ParsedMusicTrack | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [reordering, setReordering] = React.useState(false);

  const generation = React.useRef(0);

  const load = React.useCallback(async () => {
    if (!eventId) {
      finishLoad();
      return;
    }
    const requestId = ++generation.current;
    beginLoad(eventId);
    setError(null);
    try {
      const res = await api<{ data: PreparationItemDto[] }>(
        `/api/v1/preparation/music?eventId=${encodeURIComponent(eventId)}`
      );
      if (requestId !== generation.current) return;
      setTracks(res.data.map(parseMusicTrack));
      markLoaded(eventId);
    } catch (failure) {
      if (requestId === generation.current) {
        setError((failure as Error).message || 'Không thể tải danh sách nhạc.');
        finishLoad();
      }
    }
  }, [eventId, beginLoad, markLoaded, finishLoad]);

  React.useEffect(() => {
    void load();
    setModalTarget(undefined);
    setDeleteTarget(null);
    return () => {
      generation.current++;
    };
  }, [load]);

  const stats = React.useMemo(() => computeMusicStats(tracks), [tracks]);

  const filteredTracks = React.useMemo(
    () => filterMusicTracks(tracks, { search, momentFilter, viewFilter }),
    [tracks, search, momentFilter, viewFilter]
  );

  const handleSaved = async (message: string) => {
    setNotice(message);
    await load();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await api(
        `/api/v1/preparation/music/${encodeURIComponent(deleteTarget.id)}?version=${deleteTarget.version}`,
        { method: 'DELETE' }
      );
      const removedTitle = deleteTarget.title;
      setDeleteTarget(null);
      await handleSaved(`Đã xóa "${removedTitle}" khỏi danh sách nhạc.`);
    } catch (failure) {
      setError((failure as Error).message || 'Không thể xóa bài hát.');
    } finally {
      setDeleting(false);
    }
  };

  const handleMoveFiltered = async (filteredIndex: number, direction: 'up' | 'down') => {
    if (!isOwner || reordering || !eventId) return;
    const neighborFilteredIndex = direction === 'up' ? filteredIndex - 1 : filteredIndex + 1;
    if (neighborFilteredIndex < 0 || neighborFilteredIndex >= filteredTracks.length) return;

    const currentItem = filteredTracks[filteredIndex];
    const targetItem = filteredTracks[neighborFilteredIndex];
    const indexA = tracks.findIndex((t) => t.id === currentItem.id);
    const indexB = tracks.findIndex((t) => t.id === targetItem.id);
    if (indexA === -1 || indexB === -1) return;

    const reorderedAll = [...tracks];
    const swap = reorderedAll[indexA];
    reorderedAll[indexA] = reorderedAll[indexB];
    reorderedAll[indexB] = swap;

    // Optimistic update while persisting trackIds in exact full playlist order
    setTracks(reorderedAll.map((item, idx) => ({ ...item, trackOrder: idx })));
    setReordering(true);
    setError(null);
    try {
      const res = await api<{ data: PreparationItemDto[] }>('/api/v1/preparation/music/reorder', {
        method: 'POST',
        body: jsonBody({
          eventId,
          trackIds: reorderedAll.map((item) => item.id),
        }),
      });
      setTracks(res.data.map(parseMusicTrack));
    } catch (failure) {
      setError((failure as Error).message || 'Không thể sắp xếp lại thứ tự bài hát.');
      await load();
    } finally {
      setReordering(false);
    }
  };

  const hasActiveFilters = Boolean(
    search.trim() || momentFilter !== 'all' || viewFilter !== 'all'
  );

  const clearFilters = () => {
    setSearch('');
    setMomentFilter('all');
    setViewFilter('all');
  };

  if (activeEvents.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <EmptyState
          icon={<Music className="w-7 h-7 text-[#BFA16E]" strokeWidth={1.5} aria-hidden="true" />}
          title="Chưa có buổi lễ nào"
          description="Vui lòng tạo ít nhất một buổi lễ trong Cài đặt chung trước khi chọn nhạc nghi lễ."
          action={{
            label: 'Mở Cài đặt chung',
            onClick: () => {
              window.location.assign('/settings');
            },
          }}
        />
      </div>
    );
  }

  const coveragePercent = Math.round(
    (stats.coveredMomentsCount / stats.totalMomentsCount) * 100
  );
  const nextTrackOrder =
    tracks.length > 0 ? Math.max(...tracks.map((t) => t.trackOrder)) + 1 : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-5" aria-busy={refreshing || reordering}>
      {/* Luxury Forest Emerald Hero & KPI Overview */}
      <section className="relative overflow-hidden rounded-2xl bg-[#173C33] text-white px-5 py-5 sm:px-7 sm:py-6 shadow-[0_14px_34px_-16px_rgba(23,60,51,0.38)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full bg-[#D4BF8F]/15 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-white/5 blur-2xl"
        />

        <div className="relative space-y-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-[#D4BF8F]/30 px-3 py-0.5 text-[11px] font-medium tracking-wide text-[#EFE1BE]">
                  <Disc3 className="w-3 h-3 text-[#D4BF8F]" aria-hidden="true" />
                  Kịch bản âm nhạc lễ cưới
                </span>

                {activeEvents.length > 1 ? (
                  <label className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-0.5 text-[11px] text-white/90">
                    <span className="text-white/65">Buổi lễ:</span>
                    <select
                      aria-label="Chọn buổi lễ quản lý nhạc"
                      value={eventId}
                      onChange={(e) => setScope(e.target.value)}
                      className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                    >
                      {activeEvents.map((ev) => (
                        <option key={ev.id} value={ev.id} className="text-text-main bg-surface">
                          {ev.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : activeEvent ? (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-0.5 text-[11px] text-white/85">
                    {activeEvent.name}
                  </span>
                ) : null}
              </div>

              <h2 className="font-serif text-2xl sm:text-[30px] font-medium tracking-tight text-white leading-tight">
                Chọn Nhạc Lễ Cưới
              </h2>
              <p className="text-xs sm:text-sm text-white/75 max-w-2xl">
                Sắp xếp giai điệu cho từng khoảnh khắc trọng đại, đính kèm link nghe thử và ghi chú vào nhạc cho ban âm thanh.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/preparation"
                className="inline-flex items-center gap-1.5 rounded-control border border-white/20 bg-white/10 hover:bg-white/15 px-3.5 py-2.5 text-xs font-medium text-white/95 transition-colors"
              >
                <Package className="w-3.5 h-3.5 text-[#D4BF8F]" aria-hidden="true" />
                Đồ dùng &amp; Chụp ảnh
              </Link>

              {isOwner && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setModalTarget(null)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-control bg-[#D4BF8F] text-[#173C33] hover:bg-[#DFCE9F] disabled:opacity-50 px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Thêm bài hát
                </button>
              )}
            </div>
          </div>

          {/* 4 Glass KPI Tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5">
              <span className="text-[11px] text-white/70 block">Bài hát đã chọn</span>
              <span className="text-lg sm:text-xl font-semibold text-white tabular-nums block mt-0.5">
                {loading && tracks.length === 0 ? '—' : `${stats.totalActive} bài`}
              </span>
              <span className="text-[11px] text-white/65 block mt-0.5">
                Sẵn sàng gửi ekip âm thanh
              </span>
            </div>

            <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/70">Phủ khoảnh khắc</span>
                <span className="font-semibold text-[#EFE1BE] tabular-nums">
                  {stats.coveredMomentsCount}/{stats.totalMomentsCount}
                </span>
              </div>
              <span className="text-lg sm:text-xl font-semibold text-[#EFE1BE] tabular-nums block">
                {loading && tracks.length === 0 ? '—' : `${coveragePercent}%`}
              </span>
              <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#D4BF8F] transition-all duration-300"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5">
              <span className="text-[11px] text-white/70 block">Tổng thời lượng</span>
              <span className="text-lg sm:text-xl font-semibold text-white tabular-nums block mt-0.5">
                {loading && tracks.length === 0
                  ? '—'
                  : formatTotalPlaylistDuration(stats.totalDurationSeconds)}
              </span>
              <span className="text-[11px] text-white/65 block mt-0.5">
                Tính trên các bài có thời lượng
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setViewFilter((prev) => (prev === 'blacklisted' ? 'all' : 'blacklisted'))
              }
              className={`text-left rounded-xl border px-3.5 py-2.5 transition-colors ${
                viewFilter === 'blacklisted'
                  ? 'bg-danger/30 border-[#FCA5A5]'
                  : 'bg-white/10 border-white/15 hover:bg-white/15'
              }`}
            >
              <span className="text-[11px] text-white/70 block">Cờ Không phát</span>
              <span className="text-lg sm:text-xl font-semibold text-white tabular-nums block mt-0.5">
                {loading && tracks.length === 0 ? '—' : `${stats.totalBlacklisted} bài`}
              </span>
              <span className="text-[11px] text-white/65 block mt-0.5">
                {stats.totalBlacklisted > 0
                  ? 'Nhấn để lọc danh sách chặn'
                  : 'Chưa có bài hát bị chặn'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {error && (
        <Alert variant="danger" action={{ label: 'Thử lại', onClick: () => void load() }}>
          {error}
        </Alert>
      )}

      {notice && (
        <Alert variant="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {/* Filter & 7-Moment Pill Strip */}
      <section className="surface-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Lọc theo khoảnh khắc nghi lễ">
          <button
            type="button"
            role="tab"
            aria-selected={momentFilter === 'all'}
            onClick={() => setMomentFilter('all')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              momentFilter === 'all'
                ? 'bg-[#173C33] text-white shadow-xs'
                : 'bg-[#FAF8F4] text-text-main border border-border-subtle hover:border-border-control'
            }`}
          >
            <span>Tất cả khoảnh khắc</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums ${
                momentFilter === 'all' ? 'bg-white/20 text-white' : 'bg-surface text-text-muted'
              }`}
            >
              {tracks.length}
            </span>
          </button>

          {MUSIC_MOMENTS.map((moment) => {
            const count = stats.activeCountByMoment[moment.key] || 0;
            const active = momentFilter === moment.key;
            return (
              <button
                key={moment.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMomentFilter(moment.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#173C33] text-white shadow-xs'
                    : 'bg-[#FAF8F4] text-text-main border border-border-subtle hover:border-border-control'
                }`}
              >
                <span>{moment.shortLabel}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums ${
                    active
                      ? 'bg-white/20 text-white'
                      : count > 0
                      ? 'bg-success-bg text-success'
                      : 'bg-surface text-text-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-border-subtle/70">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên bài hát, ca sĩ hoặc ghi chú phát nhạc..."
              aria-label="Tìm kiếm bài hát"
              className="w-full min-h-10 pl-9 pr-3 py-1.5 rounded-control border border-border-control bg-surface text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-control border border-border-subtle bg-[#FAF8F4] p-0.5 text-xs">
              {(
                [
                  { value: 'all', label: 'Tất cả' },
                  { value: 'active', label: 'Đang chọn' },
                  { value: 'blacklisted', label: 'Không phát' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setViewFilter(opt.value)}
                  className={`px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
                    viewFilter === opt.value
                      ? 'bg-surface text-primary-luxury shadow-2xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-control px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-text-main hover:bg-page transition-colors"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Track List */}
      {loading && tracks.length === 0 ? (
        <div
          role="status"
          aria-label="Đang tải danh sách nhạc"
          className="space-y-3 animate-pulse"
        >
          <span className="sr-only">Đang tải danh sách nhạc...</span>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-card bg-surface border border-border-subtle"
            />
          ))}
        </div>
      ) : filteredTracks.length === 0 ? (
        <EmptyState
          type={hasActiveFilters ? 'no_filter_match' : 'no_data'}
          icon={<Music className="w-7 h-7 text-[#BFA16E]" strokeWidth={1.5} aria-hidden="true" />}
          title={
            hasActiveFilters
              ? 'Không có bài hát phù hợp bộ lọc'
              : 'Chưa có bài hát nào cho buổi lễ này'
          }
          description={
            hasActiveFilters
              ? 'Thử chọn khoảnh khắc khác hoặc xóa từ khóa tìm kiếm.'
              : 'Hãy thêm bài hát mở màn, lúc trao nhẫn hoặc các bản nhạc không phát để chuẩn bị cùng ekip âm thanh.'
          }
          action={
            hasActiveFilters
              ? { label: 'Xem tất cả bài hát', onClick: clearFilters, variant: 'secondary' }
              : isOwner
              ? { label: 'Thêm bài hát đầu tiên', onClick: () => setModalTarget(null) }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filteredTracks.map((track, idx) => {
            const momentMeta = getMomentMeta(track.moment);
            const durationFormatted = formatDurationSeconds(track.durationSeconds);
            const sourceLabel = detectStreamingSource(track.externalUrl);
            const canReorderUp = isOwner && filteredTracks.length > 1 && idx > 0;
            const canReorderDown =
              isOwner && filteredTracks.length > 1 && idx < filteredTracks.length - 1;

            return (
              <article
                key={track.id}
                className={`surface-card p-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3.5 ${
                  track.isBlacklisted
                    ? 'border-danger/30 bg-danger-bg/40'
                    : 'hover:border-border-control'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Track Order + Move Up/Down */}
                  <div className="flex flex-col items-center shrink-0 pt-0.5">
                    <span
                      className={`w-8 h-8 rounded-full text-xs font-semibold tabular-nums flex items-center justify-center border ${
                        track.isBlacklisted
                          ? 'bg-danger-bg border-danger/30 text-danger'
                          : 'bg-[#FAF8F4] border-[#DCD4C0] text-[#173C33]'
                      }`}
                    >
                      {track.isBlacklisted ? (
                        <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        idx + 1
                      )}
                    </span>

                    {isOwner && filteredTracks.length > 1 && (
                      <div className="flex items-center gap-0.5 mt-1">
                        <button
                          type="button"
                          disabled={!canReorderUp || reordering}
                          onClick={() => void handleMoveFiltered(idx, 'up')}
                          aria-label={`Di chuyển ${track.title} lên`}
                          title="Chuyển lên trên"
                          className="p-0.5 text-text-muted hover:text-primary disabled:opacity-25 transition-colors"
                        >
                          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={!canReorderDown || reordering}
                          onClick={() => void handleMoveFiltered(idx, 'down')}
                          aria-label={`Di chuyển ${track.title} xuống`}
                          title="Chuyển xuống dưới"
                          className="p-0.5 text-text-muted hover:text-primary disabled:opacity-25 transition-colors"
                        >
                          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Song Info */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`font-serif text-base sm:text-lg font-medium leading-snug ${
                          track.isBlacklisted
                            ? 'text-danger line-through'
                            : 'text-primary-luxury'
                        }`}
                      >
                        {track.title}
                      </h3>

                      {track.artist && (
                        <span className="text-xs text-text-muted">• {track.artist}</span>
                      )}

                      {durationFormatted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF8F4] border border-border-subtle px-2 py-0.5 text-[11px] font-mono text-text-muted tabular-nums">
                          <Clock className="w-3 h-3 text-accent" aria-hidden="true" />
                          {durationFormatted}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-medium">
                        {momentMeta.label}
                      </span>

                      {track.isBlacklisted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg border border-danger/25 text-danger px-2.5 py-0.5 text-[11px] font-semibold">
                          <Ban className="w-3 h-3" aria-hidden="true" />
                          Không phát (Do Not Play)
                        </span>
                      )}
                    </div>

                    {track.cueNotes && (
                      <div className="inline-flex items-start gap-1.5 rounded-control bg-[#FAF8F4] border border-border-subtle/80 px-2.5 py-1.5 text-xs text-text-main max-w-full">
                        <Sparkles
                          className="w-3.5 h-3.5 text-[#B68B2D] shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span className="leading-relaxed">{track.cueNotes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Controls */}
                <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                  {track.externalUrl && (
                    <a
                      href={track.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-control border border-[#D4BF8F]/60 bg-[#FAF8F4] hover:bg-[#F3EFE4] px-3 py-1.5 text-xs font-medium text-[#173C33] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#9A7222]" aria-hidden="true" />
                      {sourceLabel === 'Nghe thử' ? 'Nghe thử' : `Mở ${sourceLabel}`}
                    </a>
                  )}

                  {isOwner && (
                    <>
                      <button
                        type="button"
                        onClick={() => setModalTarget(track)}
                        className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-page hover:border-border-control transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(track)}
                        aria-label={`Xóa ${track.title}`}
                        className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-bg hover:border-danger/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Bottom Helpful Link back to Overview */}
      {tracks.length > 0 && (
        <div className="flex justify-end">
          <Link
            href="/timeline"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            Xem lịch trình ngày cưới để khớp giờ vào nhạc
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Create / Edit Modal */}
      {eventId && (
        <MusicTrackModal
          isOpen={modalTarget !== undefined}
          onClose={() => setModalTarget(undefined)}
          eventId={eventId}
          track={modalTarget ?? null}
          defaultMoment={momentFilter}
          nextTrackOrder={nextTrackOrder}
          onSaved={handleSaved}
        />
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Xóa bài hát khỏi danh sách"
        description={
          deleteTarget
            ? `Bạn chắc chắn muốn xóa bài hát "${deleteTarget.title}" khỏi danh sách nhạc buổi lễ này?`
            : ''
        }
        confirmLabel="Xóa bài hát"
        cancelLabel="Giữ lại"
        variant="danger"
        isLoading={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
