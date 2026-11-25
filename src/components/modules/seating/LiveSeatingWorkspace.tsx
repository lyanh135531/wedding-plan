'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRole } from '@/context/RoleContext';
import { useEventScope } from '@/context/EventScopeContext';
import { api, jsonBody } from '@/lib/api/request';
import { Button } from '@/components/ui/button';
import { TableCard } from './TableCard';
import { AddEditTableModal, type AddEditTableModalProps } from './AddEditTableModal';
import { SeatingExportModal } from './SeatingExportModal';
import type { TableItem, GuestSeatingItem } from './types';
import type { AttendanceOwnerDto, GuestOwnerDto } from '@/schemas/guests';
import type { TableDto } from '@/schemas/seating';

interface SeatingData { tables: TableDto[]; attendance: AttendanceOwnerDto[]; guests: GuestOwnerDto[]; seats: { guestId: string; tableId: string }[] }

export function LiveSeatingWorkspace() {
  const { isOwner } = useRole();
  const { currentScope, availableEvents } = useEventScope();
  const eventId = availableEvents.some((event) => event.id === currentScope) ? currentScope : availableEvents[0]?.id || '';
  const [tables, setTables] = useState<TableItem[]>([]);
  const [guests, setGuests] = useState<GuestSeatingItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<TableItem | null | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setError(null); setLoading(true);
    try {
      if (!eventId) { setTables([]); setGuests([]); return; }
      const { data } = await api<{ data: SeatingData }>(`/api/v1/seating?eventId=${eventId}`);
      if (request !== generation.current) return;
      setTables(data.tables.map((table) => ({ ...table, tableNumber: table.tableNumber || undefined, seatedGuestIds: data.seats.filter((seat) => seat.tableId === table.id).map((seat) => seat.guestId) })));
      setGuests(data.guests.flatMap((guest) => {
        const attendance = data.attendance.find((row) => row.guest_id === guest.id);
        const tableId = data.seats.find((seat) => seat.guestId === guest.id)?.tableId || null;
        if (attendance?.rsvp_status !== 'accepted' && !tableId) return [];
        return [{ id: guest.id, name: guest.display_name, groupName: 'Khách mời', tableId,
          needsSeat: attendance?.needs_seat, phone: guest.phone, notes: guest.private_notes,
        }];
      }));
    } catch (failure) { if (request === generation.current) setError((failure as Error).message); }
    finally { if (request === generation.current) setLoading(false); }
  }, [eventId]);
  useEffect(() => { void load(); setSelected(null); setEditing(undefined); return () => { generation.current++; }; }, [load]);
  const saveTable: AddEditTableModalProps['onSave'] = async (draft) => {
    if (!eventId) throw new Error('Hãy chọn một buổi lễ.');
    const old = tables.find((table) => table.id === draft.id);
    await api(draft.id ? `/api/v1/tables/${draft.id}` : '/api/v1/tables', {
      method: draft.id ? 'PATCH' : 'POST', body: jsonBody({ ...draft, eventId, version: old?.version }),
    });
    await load();
  };
  const mutate = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await action(); await load(); setSelected(null); }
    catch (failure) { await load(); setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  const seat = (tableId: string, guestId = selected) => {
    if (!guestId || !isOwner) return;
    void mutate(() => api(`/api/v1/tables/${tableId}/seats`, { method: 'POST', body: jsonBody({ guestId, eventId, version: tables.find((table) => table.id === tableId)?.version }) }));
  };
  const [unseatedDragOver, setUnseatedDragOver] = useState(false);
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
  return <section className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><h1 className="text-2xl font-bold">Sơ Đồ Xếp Bàn Tiệc</h1>
      <div className="flex gap-2">{isOwner && <Button disabled={!eventId || busy} onClick={() => setEditing(null)}>Thêm bàn tiệc</Button>}
        <Button variant="secondary" onClick={() => setExporting(true)}>In sơ đồ bàn</Button></div>
    </div>
    <p>Buổi lễ: {availableEvents.find((event) => event.id === eventId)?.name || 'Chưa có buổi lễ'}</p>
    {error && <p role="alert" className="text-danger">{error} <button className="underline min-h-11" onClick={() => void load()}>Tải lại</button></p>}
    {loading && <p role="status">Đang tải sơ đồ bàn…</p>}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" aria-busy={busy}>
      <div
        className={`space-y-2 p-3 rounded-card transition-all ${unseatedDragOver ? 'border-2 border-dashed border-primary bg-primary/5' : ''}`}
        onDragOver={(e) => {
          if (!isOwner || busy) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setUnseatedDragOver(true);
        }}
        onDragLeave={() => setUnseatedDragOver(false)}
        onDrop={handleUnseatedDrop}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Khách đã xác nhận, chưa xếp bàn</h2>
          <span className="text-xs bg-page px-2 py-0.5 rounded-full font-semibold">{guests.filter((g) => !g.tableId).length}</span>
        </div>
        {guests.filter((guest) => !guest.tableId).length === 0 && (
          <p className="text-xs text-text-muted italic py-4 text-center">Tất cả khách đã được xếp bàn.</p>
        )}
        {guests.filter((guest) => !guest.tableId).map((guest) => (
          <div
            key={guest.id}
            role="button"
            tabIndex={0}
            draggable={isOwner && !busy}
            onDragStart={(e) => {
              if (!isOwner || busy) return;
              e.dataTransfer.setData('text/plain', guest.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onClick={() => {
              if (!isOwner || busy) return;
              setSelected(selected === guest.id ? null : guest.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!isOwner || busy) return;
                setSelected(selected === guest.id ? null : guest.id);
              }
            }}
            aria-pressed={selected === guest.id}
            className={`w-full min-h-11 rounded-control border p-3 text-left transition-all ${
              isOwner && !busy ? 'cursor-grab active:cursor-grabbing hover:border-primary' : 'cursor-default'
            } ${selected === guest.id ? 'bg-primary text-white shadow-sm' : 'bg-surface border-border-control'}`}
          >
            <div className="font-medium">{guest.name}</div>
            {guest.needsSeat === false && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${selected === guest.id ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                Không chiếm ghế (em bé)
              </span>
            )}
          </div>
        ))}
        {selected && <p className="text-xs text-primary font-medium">Đã chọn {guests.find((guest) => guest.id === selected)?.name}. Bấm vào bàn để xếp hoặc kéo thả trực tiếp.</p>}
      </div>
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
        {tables.map((table) => <TableCard key={table.id} table={table} guests={guests} selectedGuestId={busy ? null : selected}
          onSeatGuest={isOwner ? (id) => seat(id) : undefined}
          onDropGuest={isOwner ? (tableId, guestId) => seat(tableId, guestId) : undefined}
          onEditTable={isOwner ? (item) => setEditing(item) : undefined}
          onUnseatGuest={isOwner ? (id, guestId) => void mutate(() => api(`/api/v1/tables/${id}/seats/${guestId}`, { method: 'DELETE' })) : undefined}
          onDeleteTable={isOwner ? (id) => { if (window.confirm('Xóa bàn và bỏ các chỗ đã xếp trên bàn này?')) void mutate(() => api(`/api/v1/tables/${id}`, { method: 'DELETE' })); } : undefined} />)}
        {!loading && !tables.length && <p>Chưa có bàn tiệc.</p>}
      </div>
    </div>
    {editing !== undefined && <AddEditTableModal isOpen editingTable={editing} occupiedSeatCount={editing ? guests.filter((guest) => guest.tableId === editing.id && guest.needsSeat !== false).length : 0} onClose={() => setEditing(undefined)} onSave={saveTable} />}
    {exporting && <SeatingExportModal isOpen tables={tables} guests={guests} onClose={() => setExporting(false)} />}
  </section>;
}
