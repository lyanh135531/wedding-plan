'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRole } from '@/context/RoleContext';
import { useEventScope } from '@/context/EventScopeContext';
import { api, jsonBody } from '@/lib/api/request';
import { removeVietnameseDiacritics } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TableCard } from './TableCard';
import { AddEditTableModal, type AddEditTableModalProps } from './AddEditTableModal';
import { SeatingExportModal } from './SeatingExportModal';
import type { TableItem, GuestSeatingItem } from './types';
import type { AttendanceOwnerDto, GuestOwnerDto, GuestSide } from '@/schemas/guests';
import type { TableDto } from '@/schemas/seating';
import { Armchair, GripVertical, Plus, Printer, Search, Users, X } from 'lucide-react';

interface SeatingData {
  tables: TableDto[];
  attendance: AttendanceOwnerDto[];
  guests: GuestOwnerDto[];
  seats: { guestId: string; tableId: string }[];
}

export type UnseatedSideFilter = 'all' | GuestSide;
export type TableFilterOption = 'all' | 'available' | 'full' | 'round' | 'rectangular';

const SIDE_LABELS: Record<GuestSide, string> = {
  groom: 'Nhà trai',
  bride: 'Nhà gái',
  mutual: 'Bạn chung',
  unassigned: 'Chưa phân',
};

/**
 * Computes summary counts for the seating overview strip.
 */
export function computeSeatingStats(tables: TableItem[], guests: GuestSeatingItem[]) {
  const seatedGuests = guests.filter((g) => Boolean(g.tableId));
  const unseatedGuests = guests.filter((g) => !g.tableId);
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const occupiedSeats = guests.filter((g) => Boolean(g.tableId) && g.needsSeat !== false).length;
  return {
    totalGuests: guests.length,
    seatedCount: seatedGuests.length,
    unseatedCount: unseatedGuests.length,
    totalTables: tables.length,
    occupiedSeats,
    totalCapacity,
  };
}

/**
 * Filters unseated guests by diacritic-insensitive name search and wedding side.
 */
export function filterUnseatedGuests(
  guests: GuestSeatingItem[],
  search: string,
  sideFilter: UnseatedSideFilter
) {
  const normQuery = removeVietnameseDiacritics(search.trim());
  return guests.filter((guest) => {
    if (guest.tableId) return false;
    if (sideFilter !== 'all' && guest.side !== sideFilter) return false;
    if (normQuery && !removeVietnameseDiacritics(guest.name).includes(normQuery)) {
      return false;
    }
    return true;
  });
}

/**
 * Filters table cards by table name/number and availability/shape filter.
 */
export function filterSeatingTables(
  tables: TableItem[],
  guests: GuestSeatingItem[],
  search: string,
  filter: TableFilterOption
) {
  const normQuery = removeVietnameseDiacritics(search.trim());
  return tables.filter((table) => {
    if (normQuery) {
      const target = `${table.name} ${table.tableNumber || ''}`;
      if (!removeVietnameseDiacritics(target).includes(normQuery)) return false;
    }
    if (filter === 'round') return table.shape === 'round';
    if (filter === 'rectangular') return table.shape === 'rectangular';
    if (filter === 'available' || filter === 'full') {
      const seatCount = table.seatedGuestIds.filter(
        (id) => guests.find((g) => g.id === id)?.needsSeat !== false
      ).length;
      const isFull = seatCount >= table.capacity;
      return filter === 'full' ? isFull : !isFull;
    }
    return true;
  });
}

export function LiveSeatingWorkspace() {
  const { isOwner } = useRole();
  const { currentScope, availableEvents } = useEventScope();
  const eventId = availableEvents.some((event) => event.id === currentScope)
    ? currentScope
    : availableEvents[0]?.id || '';
  const activeEvent = availableEvents.find((event) => event.id === eventId);

  const [tables, setTables] = useState<TableItem[]>([]);
  const [guests, setGuests] = useState<GuestSeatingItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<TableItem | null | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [guestSearch, setGuestSearch] = useState('');
  const [guestSideFilter, setGuestSideFilter] = useState<UnseatedSideFilter>('all');
  const [tableSearch, setTableSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<TableFilterOption>('all');
  const [unseatedDragOver, setUnseatedDragOver] = useState(false);

  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setError(null);
    setLoading(true);
    try {
      if (!eventId) {
        setTables([]);
        setGuests([]);
        return;
      }
      const { data } = await api<{ data: SeatingData }>(`/api/v1/seating?eventId=${eventId}`);
      if (request !== generation.current) return;
      setTables(
        data.tables.map((table) => ({
          ...table,
          tableNumber: table.tableNumber || undefined,
          seatedGuestIds: data.seats
            .filter((seat) => seat.tableId === table.id)
            .map((seat) => seat.guestId),
        }))
      );
      setGuests(
        data.guests.flatMap((guest) => {
          const attendance = data.attendance.find((row) => row.guest_id === guest.id);
          const tableId = data.seats.find((seat) => seat.guestId === guest.id)?.tableId || null;
          if (attendance?.rsvp_status !== 'accepted' && !tableId) return [];
          return [
            {
              id: guest.id,
              name: guest.display_name,
              groupName: SIDE_LABELS[guest.side] || 'Khách mời',
              side: guest.side,
              tableId,
              needsSeat: attendance?.needs_seat,
              phone: guest.phone,
              notes: guest.private_notes,
            },
          ];
        })
      );
    } catch (failure) {
      if (request === generation.current) setError((failure as Error).message);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
    setSelected(null);
    setEditing(undefined);
    return () => {
      generation.current++;
    };
  }, [load]);

  const saveTable: AddEditTableModalProps['onSave'] = async (draft) => {
    if (!eventId) throw new Error('Hãy chọn một buổi lễ.');
    const old = tables.find((table) => table.id === draft.id);
    await api(draft.id ? `/api/v1/tables/${draft.id}` : '/api/v1/tables', {
      method: draft.id ? 'PATCH' : 'POST',
      body: jsonBody({ ...draft, eventId, version: old?.version }),
    });
    await load();
  };

  const mutate = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      setSelected(null);
    } catch (failure) {
      await load();
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const seat = (tableId: string, guestId = selected) => {
    if (!guestId || !isOwner) return;
    void mutate(() =>
      api(`/api/v1/tables/${tableId}/seats`, {
        method: 'POST',
        body: jsonBody({
          guestId,
          eventId,
          version: tables.find((table) => table.id === tableId)?.version,
        }),
      })
    );
  };

  const handleUnseatedDrop = (e: React.DragEvent) => {
    if (!isOwner || busy) return;
    e.preventDefault();
    setUnseatedDragOver(false);
    const guestId = e.dataTransfer.getData('text/plain');
    const guest = guests.find((g) => g.id === guestId);
    if (guest?.tableId) {
      void mutate(() => api(`/api/v1/tables/${guest.tableId}/seats/${guestId}`, { method: 'DELETE' }));
    }
  };

  const stats = useMemo(() => computeSeatingStats(tables, guests), [tables, guests]);
  const unseatedFiltered = useMemo(
    () => filterUnseatedGuests(guests, guestSearch, guestSideFilter),
    [guests, guestSearch, guestSideFilter]
  );
  const displayedTables = useMemo(
    () => filterSeatingTables(tables, guests, tableSearch, tableFilter),
    [tables, guests, tableSearch, tableFilter]
  );

  const selectedGuest = guests.find((guest) => guest.id === selected);

  return (
    <section className="space-y-4">
      {/* Editorial Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1.5">Sắp xếp chỗ ngồi</p>
          <h1 className="text-[26px] sm:text-[32px] font-medium leading-tight">Sơ Đồ Xếp Bàn Tiệc</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOwner && (
            <Button
              leftIcon={<Plus className="w-4 h-4" />}
              disabled={!eventId || busy}
              onClick={() => setEditing(null)}
            >
              Thêm bàn tiệc
            </Button>
          )}
          <Button
            variant="secondary"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={() => setExporting(true)}
          >
            In sơ đồ bàn
          </Button>
        </div>
      </div>

      {/* Unified Overview & Table Filter Bar */}
      <div className="surface-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-border-subtle/70">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span>
              Buổi lễ:{' '}
              <strong className="font-medium text-text-main">
                {activeEvent?.name || 'Chưa có buổi lễ'}
              </strong>
            </span>
            {!loading && !error && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium tabular-nums">
                  <Users className="w-3 h-3" aria-hidden="true" />
                  Đã xếp {stats.seatedCount}/{stats.totalGuests}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-warning-bg text-warning font-medium tabular-nums">
                  Còn {stats.unseatedCount} chưa xếp
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-page border border-border-subtle text-text-main font-medium tabular-nums">
                  <Armchair className="w-3 h-3 text-primary" aria-hidden="true" />
                  {stats.totalTables} bàn ({stats.occupiedSeats}/{stats.totalCapacity} ghế)
                </span>
              </div>
            )}
          </div>

          {isOwner && (
            <p className="text-xs text-text-muted">
              {selectedGuest ? (
                <span className="text-primary font-medium">
                  Đang chọn <strong>{selectedGuest.name}</strong> — bấm vào bàn để xếp
                </span>
              ) : (
                'Kéo khách sang bàn hoặc chạm chọn khách rồi bấm bàn'
              )}
            </p>
          )}
        </div>

        {/* Table Search & Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label="Tìm bàn tiệc"
              placeholder="Tìm bàn theo tên hoặc số bàn..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-9 text-sm bg-surface border border-border-control rounded-control focus:outline-none focus:border-primary"
            />
            {tableSearch && (
              <button
                type="button"
                onClick={() => setTableSearch('')}
                aria-label="Xóa tìm kiếm bàn"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-text-main"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <select
            aria-label="Lọc bàn tiệc"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value as TableFilterOption)}
            className="h-11 sm:w-48 text-sm bg-surface border border-border-control rounded-control"
          >
            <option value="all">Tất cả bàn tiệc</option>
            <option value="available">Còn chỗ trống</option>
            <option value="full">Đã đầy chỗ</option>
            <option value="round">Chỉ bàn tròn</option>
            <option value="rectangular">Chỉ bàn chữ nhật</option>
          </select>

          {selected && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="h-11 px-3 text-xs font-medium text-text-muted hover:text-text-main rounded-control border border-border-subtle bg-page whitespace-nowrap"
            >
              Bỏ chọn khách
            </button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-card bg-danger-bg border border-danger/20 text-sm text-danger"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="underline font-medium min-h-8 px-2"
          >
            Tải lại
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div role="status" className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-pulse">
          <span className="sr-only">Đang tải sơ đồ bàn…</span>
          <div className="surface-card p-4 h-72" />
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface-card h-48" />
            <div className="surface-card h-48" />
          </div>
        </div>
      )}

      {/* Main Split Workspace (items-start prevents stretching tables to match left sidebar!) */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start" aria-busy={busy}>
          {/* Left Sticky Unseated Guest Panel */}
          <aside
            className={`surface-card p-4 flex flex-col gap-3 lg:sticky lg:top-20 transition-all ${
              unseatedDragOver ? 'border-primary ring-2 ring-primary/30 bg-primary/[0.03]' : ''
            }`}
            onDragOver={(e) => {
              if (!isOwner || busy) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setUnseatedDragOver(true);
            }}
            onDragLeave={() => setUnseatedDragOver(false)}
            onDrop={handleUnseatedDrop}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border-subtle/80">
              <h2 className="text-sm font-semibold text-text-main">Khách đã xác nhận, chưa xếp bàn</h2>
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold tabular-nums">
                {stats.unseatedCount}
              </span>
            </div>

            {/* Guest Search */}
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="Tìm khách chưa xếp bàn"
                placeholder="Tìm tên khách..."
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                className="w-full h-11 pl-8 pr-8 text-xs bg-surface border border-border-control rounded-control focus:outline-none focus:border-primary"
              />
              {guestSearch && (
                <button
                  type="button"
                  onClick={() => setGuestSearch('')}
                  aria-label="Xóa tìm kiếm khách"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-main"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Compact Side Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'Tất cả'],
                  ['groom', 'Nhà trai'],
                  ['bride', 'Nhà gái'],
                  ['mutual', 'Bạn chung'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGuestSideFilter(key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                    guestSideFilter === key
                      ? 'bg-primary text-white border-primary'
                      : 'bg-page text-text-muted border-border-subtle hover:text-text-main'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Bounded Scrollable Unseated Guest List */}
            <div className="space-y-1.5 max-h-[420px] lg:max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
              {stats.unseatedCount === 0 ? (
                <p className="text-xs text-text-muted italic py-6 text-center">
                  Tất cả khách đã được xếp vào bàn.
                </p>
              ) : unseatedFiltered.length === 0 ? (
                <p className="text-xs text-text-muted italic py-6 text-center">
                  Không tìm thấy khách phù hợp.
                </p>
              ) : (
                unseatedFiltered.map((guest) => {
                  const isSelected = selected === guest.id;
                  return (
                    <div
                      key={guest.id}
                      role="button"
                      tabIndex={0}
                      aria-label={guest.name}
                      aria-pressed={isSelected}
                      draggable={isOwner && !busy}
                      onDragStart={(e) => {
                        if (!isOwner || busy) return;
                        e.dataTransfer.setData('text/plain', guest.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => {
                        if (!isOwner || busy) return;
                        setSelected(isSelected ? null : guest.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (!isOwner || busy) return;
                          setSelected(isSelected ? null : guest.id);
                        }
                      }}
                      className={`w-full rounded-control px-3 py-2 border text-left transition-all flex items-center justify-between gap-2 ${
                        isOwner && !busy ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                      } ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-page/60 border-border-subtle hover:border-primary/45 hover:bg-page'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isOwner && (
                          <GripVertical
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSelected ? 'text-white/75' : 'text-text-muted/60'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                        <span className="text-sm font-medium truncate">{guest.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {guest.needsSeat === false && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-info-bg text-info'
                            }`}
                          >
                            Em bé
                          </span>
                        )}
                        {guest.side && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-surface border border-border-subtle text-text-muted'
                            }`}
                          >
                            {SIDE_LABELS[guest.side]}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Tables Grid (items-start so each card hugs its own height) */}
          <div className="lg:col-span-2">
            {displayedTables.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {displayedTables.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    guests={guests}
                    selectedGuestId={busy ? null : selected}
                    onSeatGuest={isOwner ? (id) => seat(id) : undefined}
                    onDropGuest={isOwner ? (tableId, guestId) => seat(tableId, guestId) : undefined}
                    onEditTable={isOwner ? (item) => setEditing(item) : undefined}
                    onUnseatGuest={
                      isOwner
                        ? (id, guestId) =>
                            void mutate(() =>
                              api(`/api/v1/tables/${id}/seats/${guestId}`, { method: 'DELETE' })
                            )
                        : undefined
                    }
                    onDeleteTable={
                      isOwner
                        ? (id) => {
                            if (window.confirm('Xóa bàn và bỏ các chỗ đã xếp trên bàn này?')) {
                              void mutate(() => api(`/api/v1/tables/${id}`, { method: 'DELETE' }));
                            }
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                type={tables.length > 0 ? 'no_filter_match' : 'no_data'}
                title={tables.length > 0 ? 'Không tìm thấy bàn phù hợp' : 'Bắt đầu sắp xếp sơ đồ bàn tiệc'}
                description={
                  tables.length > 0
                    ? 'Thử xóa từ khóa hoặc chuyển bộ lọc bàn để xem toàn bộ sơ đồ.'
                    : 'Tạo bàn tiệc đầu tiên để kéo thả khách mời và theo dõi sức chứa từng bàn.'
                }
                icon={<Armchair className="w-7 h-7 text-accent" strokeWidth={1.4} />}
                action={
                  tables.length > 0
                    ? {
                        label: 'Xem tất cả bàn',
                        onClick: () => {
                          setTableSearch('');
                          setTableFilter('all');
                        },
                      }
                    : isOwner
                    ? { label: 'Thêm bàn tiệc đầu tiên', onClick: () => setEditing(null) }
                    : undefined
                }
              />
            )}
          </div>
        </div>
      )}

      {editing !== undefined && (
        <AddEditTableModal
          isOpen
          editingTable={editing}
          occupiedSeatCount={
            editing
              ? guests.filter((guest) => guest.tableId === editing.id && guest.needsSeat !== false)
                  .length
              : 0
          }
          onClose={() => setEditing(undefined)}
          onSave={saveTable}
        />
      )}
      {exporting && (
        <SeatingExportModal
          isOpen
          tables={tables}
          guests={guests}
          onClose={() => setExporting(false)}
        />
      )}
    </section>
  );
}
