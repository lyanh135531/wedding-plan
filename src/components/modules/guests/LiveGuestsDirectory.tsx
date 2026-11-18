'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, allPages, jsonBody } from '@/lib/api/request';
import { useRole } from '@/context/RoleContext';
import { useEventScope } from '@/context/EventScopeContext';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { AddGuestModal, type AddGuestDraft } from './AddGuestModal';
import { AddFamilyModal, type AddFamilyModalProps } from './AddFamilyModal';
import { RsvpUpdateDrawer, type MemberRsvpState } from './RsvpUpdateDrawer';
import { GuestDetailDrawer, type GuestDetailData } from './GuestDetailDrawer';
import type { GuestOwnerDto, GuestFamilyDto, AttendanceOwnerDto, InvitationOwnerDto } from '@/schemas/guests';
import { removeVietnameseDiacritics } from '@/lib/utils';

type Guest = GuestOwnerDto | GuestFamilyDto;
const RSVP: Record<string, string> = { accepted: 'Sẽ tham dự', declined: 'Không tham dự', tentative: 'Cân nhắc', pending_reply: 'Chưa phản hồi', not_contacted: 'Chưa liên hệ' };

export function LiveGuestsDirectory() {
  const { isOwner } = useRole();
  const { currentScope, availableEvents } = useEventScope();
  const eventId = availableEvents.some((event) => event.id === currentScope) ? currentScope : availableEvents[0]?.id || '';
  const event = availableEvents.find((item) => item.id === eventId);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceOwnerDto[]>([]);
  const [invitations, setInvitations] = useState<InvitationOwnerDto[]>([]);
  const [seatedNames, setSeatedNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [addGuest, setAddGuest] = useState(false);
  const [addFamily, setAddFamily] = useState(false);
  const [rsvpGuest, setRsvpGuest] = useState<string | null>(null);
  const [detail, setDetail] = useState<GuestDetailData | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const [people, attendees, cards] = await Promise.all([
        allPages<Guest>('/api/v1/guests'),
        eventId ? api<{ data: { attendance: AttendanceOwnerDto[]; tables: { id: string; name: string }[]; seats: { guestId: string; tableId: string }[] } }>(`/api/v1/seating?eventId=${eventId}`) : Promise.resolve({ data: { attendance: [], tables: [], seats: [] } }),
        eventId ? api<{ data: InvitationOwnerDto[] }>(`/api/v1/invitations?eventId=${eventId}`) : Promise.resolve({ data: [] }),
      ]);
      if (request !== generation.current) return;
      setGuests(people); setAttendance(attendees.data.attendance); setInvitations(cards.data);
      setSeatedNames(Object.fromEntries(attendees.data.seats.map((seat) => [seat.guestId, attendees.data.tables.find((table) => table.id === seat.tableId)?.name || 'Bàn đã xếp'])));
    } catch (failure) {
      if (request === generation.current) setError((failure as Error).message);
    } finally { if (request === generation.current) setLoading(false); }
  }, [eventId]);
  useEffect(() => { void load(); setRsvpGuest(null); setDetail(null); return () => { generation.current++; }; }, [load]);

  const createGuest = async (draft: AddGuestDraft) => {
    await api('/api/v1/guests', { method: 'POST', body: jsonBody({
      display_name: draft.displayName, side: draft.side, age_tier: draft.ageTier,
      phone: draft.phone || null, email: draft.email || null, address: draft.address || null,
      private_notes: draft.privateNotes || null, is_placeholder: draft.isPlaceholder,
      placeholder_for: draft.placeholderFor || null, sub_tags: draft.subTags,
    }) });
    await load();
  };
  const createFamily: AddFamilyModalProps['onSubmit'] = async (draft) => {
    if (!eventId) throw new Error('Hãy chọn một buổi lễ trước khi tạo thiệp gia đình.');
    await api('/api/v1/guests/household', { method: 'POST', body: jsonBody({ ...draft, eventId,
      members: draft.members.map((member) => ({ ...member, displayName: member.name, phone: member.phone || null })),
    }) });
    await load();
  };
  const invite = async (guest: Guest) => {
    if (!eventId || busy) return;
    setBusy(true); setError(null);
    try {
      await api('/api/v1/invitations', { method: 'POST', body: jsonBody({ event_id: eventId,
        card_name: guest.display_name, representative_guest_id: guest.id, member_guest_ids: [guest.id],
      }) });
      await load();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  const saveRsvp = async (members: MemberRsvpState[]) => {
    const member = members[0];
    const previous = attendance.find((row) => row.guest_id === member.guestId);
    if (!previous) throw new Error('Chưa có bản ghi tham dự. Hãy mời khách vào buổi lễ trước.');
    await api('/api/v1/attendance', { method: 'PATCH', body: jsonBody({
      ...previous, guest_id: member.guestId, event_id: eventId,
      rsvp_status: member.rsvpStatus, needs_seat: member.needsSeat, needs_meal: member.needsMeal,
      meal_dietary_tier: member.mealTier, accommodation_needed: previous.accommodation_needed ?? false,
      transport_needed: previous.transport_needed ?? false,
    }) });
    await load();
  };
  const openDetail = (guest: Guest) => {
    setDetail({ id: guest.id, displayName: guest.display_name, side: guest.side, ageTier: guest.age_tier,
      ...('phone' in guest ? { phone: guest.phone, email: guest.email, address: guest.address, privateNotes: guest.private_notes } : {}),
      subTags: guest.sub_tags, version: guest.version,
      attendances: attendance.filter((row) => row.guest_id === guest.id).map((row) => ({
        eventId, eventName: event?.name || '', rsvpStatus: row.rsvp_status,
        needsSeat: row.needs_seat, needsMeal: row.needs_meal, mealDietaryTier: row.meal_dietary_tier,
      })),
    });
  };
  const active = guests.find((guest) => guest.id === rsvpGuest);
  const activeAttendance = attendance.find((row) => row.guest_id === rsvpGuest);
  const normalize = (value: string) => removeVietnameseDiacritics(value).toLowerCase();
  const shown = guests.filter((guest) => normalize(guest.display_name).includes(normalize(search)));

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Danh Sách Khách Mời</h1>
      {isOwner && <div className="flex flex-wrap gap-2">
        <Button onClick={() => setAddGuest(true)}>Thêm khách mời</Button>
        <Button variant="secondary" disabled={!eventId} onClick={() => setAddFamily(true)}>Thêm gia đình</Button>
      </div>}
    </div>
    <p>Phản hồi và thiệp cho buổi: <strong>{event?.name || 'Chưa có buổi lễ'}</strong>. Chọn buổi khác ở thanh phạm vi.</p>
    <TextInput label="Tìm khách mời" value={search} onChange={(e) => setSearch(e.target.value)} />
    {error && <div role="alert" className="text-danger">{error} <button onClick={() => void load()} className="underline min-h-11">Tải lại</button></div>}
    {loading && <p role="status">Đang tải khách mời…</p>}
    {!loading && !error && shown.length === 0 && <p>Chưa có khách mời phù hợp.</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {shown.map((guest) => {
        const row = attendance.find((item) => item.guest_id === guest.id);
        const card = invitations.find((item) => item.member_guest_ids.includes(guest.id));
        return <article key={guest.id} data-testid={`guest-${guest.id}`} className="rounded-card border border-border-subtle bg-surface p-4 space-y-3">
          <button className="text-lg font-semibold text-primary min-h-11 text-left" onClick={() => openDetail(guest)}>{guest.display_name}</button>
          <p>{row ? RSVP[row.rsvp_status] : 'Chưa mời dự buổi này'}</p>
          {card && <p>Thiệp: {card.card_name}</p>}
          {row && <p>{row.needs_seat ? 'Cần ghế' : 'Không cần ghế'} · {row.needs_meal ? 'Cần suất ăn' : 'Không cần suất ăn'}</p>}
          {isOwner && <Button variant="secondary" disabled={!eventId || busy} onClick={() => row ? setRsvpGuest(guest.id) : void invite(guest)}>
            {row ? 'Cập nhật RSVP' : 'Mời dự buổi'}
          </Button>}
        </article>;
      })}
    </div>
    {addGuest && <AddGuestModal isOpen onClose={() => setAddGuest(false)} onSubmit={createGuest} />}
    {addFamily && <AddFamilyModal isOpen initialGroupName="" initialMembers={[{ id: '1', name: '', ageTier: 'adult', isRepresentative: true }]} onClose={() => setAddFamily(false)} onSubmit={createFamily} />}
    {active && activeAttendance && <RsvpUpdateDrawer key={`${eventId}:${active.id}`} isOpen onClose={() => setRsvpGuest(null)}
      householdName={active.display_name} initialEventTitle={event?.name} onSave={saveRsvp}
      initialMembers={[{ guestId: active.id, name: active.display_name,
        rsvpStatus: activeAttendance.rsvp_status,
        needsSeat: activeAttendance.needs_seat, needsMeal: activeAttendance.needs_meal,
        mealTier: activeAttendance.meal_dietary_tier,
        assignedTable: seatedNames[active.id] || null,
      }]} />}
    <GuestDetailDrawer isOpen={!!detail} onClose={() => setDetail(null)} guest={detail}
      onUpdateRsvp={isOwner ? (guest) => { setDetail(null); setRsvpGuest(guest.id); } : undefined} />
  </section>;
}
