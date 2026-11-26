'use client';

import * as React from 'react';
import { FileText, Mail, Send, Search, Star, Check, X } from 'lucide-react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { TextInput } from '@/components/ui/input';
import { CalendarInput } from '@/components/ui/calendar-input';
import { removeVietnameseDiacritics } from '@/lib/utils';
import type {
  DeliveryMethod,
  GuestOwnerDto,
  InvitationOwnerDto,
  InvitationStatus,
} from '@/schemas/guests';
import {
  DELIVERY_METHOD_OPTIONS,
  INVITATION_STATUS_OPTIONS,
  SIDE_LABELS,
  buildOccupiedGuestCardMap,
  suggestCardName,
  todayIsoInVietnam,
} from './helpers';

export interface InvitationFormPayload {
  card_name: string;
  representative_guest_id: string;
  member_guest_ids: string[];
  delivery_method: DeliveryMethod;
  status: InvitationStatus;
  sent_date: string | null;
  notes: string | null;
}

export interface InvitationEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  invitation: InvitationOwnerDto | null;
  guests: GuestOwnerDto[];
  existingInvitations: InvitationOwnerDto[];
  onSave: (payload: InvitationFormPayload) => Promise<void>;
}

const METHOD_ICONS: Record<DeliveryMethod, typeof FileText> = {
  paper: FileText,
  electronic: Mail,
  in_person: Send,
};

export const InvitationEditorModal: React.FC<InvitationEditorModalProps> = ({
  isOpen,
  onClose,
  invitation,
  guests,
  existingInvitations,
  onSave,
}) => {
  const isEdit = Boolean(invitation);
  const [cardName, setCardName] = React.useState('');
  const [nameTouched, setNameTouched] = React.useState(false);
  const [memberIds, setMemberIds] = React.useState<string[]>([]);
  const [representativeId, setRepresentativeId] = React.useState('');
  const [deliveryMethod, setDeliveryMethod] = React.useState<DeliveryMethod>('paper');
  const [status, setStatus] = React.useState<InvitationStatus>('preparing');
  const [sentDate, setSentDate] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [guestSearch, setGuestSearch] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submitLock = React.useRef(false);

  const guestMap = React.useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);

  const occupiedMap = React.useMemo(
    () => buildOccupiedGuestCardMap(existingInvitations, invitation?.id),
    [existingInvitations, invitation?.id]
  );

  React.useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setGuestSearch('');
    submitLock.current = false;

    if (invitation) {
      const uniqueMembers = Array.from(
        new Set([invitation.representative_guest_id, ...invitation.member_guest_ids].filter(Boolean))
      );
      setCardName(invitation.card_name);
      setNameTouched(true);
      setMemberIds(uniqueMembers);
      setRepresentativeId(invitation.representative_guest_id);
      setDeliveryMethod(invitation.delivery_method);
      setStatus(invitation.status);
      setSentDate(invitation.sent_date ? String(invitation.sent_date).slice(0, 10) : '');
      setNotes(invitation.notes || '');
    } else {
      setCardName('');
      setNameTouched(false);
      setMemberIds([]);
      setRepresentativeId('');
      setDeliveryMethod('paper');
      setStatus('preparing');
      setSentDate('');
      setNotes('');
    }
  }, [isOpen, invitation]);

  // Suggest a sensible card name until user edits cardName manually
  React.useEffect(() => {
    if (!isOpen || isEdit || nameTouched) return;
    setCardName(suggestCardName(memberIds, representativeId, guestMap));
  }, [isOpen, isEdit, nameTouched, memberIds, representativeId, guestMap]);

  const toggleMember = (guestId: string) => {
    if (occupiedMap.has(guestId)) return;
    setError(null);
    setMemberIds((prev) => {
      const exists = prev.includes(guestId);
      const next = exists ? prev.filter((id) => id !== guestId) : [...prev, guestId];
      if (!exists && !representativeId) {
        setRepresentativeId(guestId);
      } else if (exists && representativeId === guestId) {
        setRepresentativeId(next[0] || '');
      }
      return next;
    });
  };

  const handleStatusChange = (nextStatus: InvitationStatus) => {
    setStatus(nextStatus);
    if (nextStatus === 'sent' && !sentDate) {
      setSentDate(todayIsoInVietnam());
    }
  };

  const filteredGuests = React.useMemo(() => {
    const query = removeVietnameseDiacritics(guestSearch.trim());
    const matches = guests.filter((guest) => {
      if (!query) return true;
      return removeVietnameseDiacritics(`${guest.display_name} ${guest.phone || ''}`).includes(query);
    });
    // Sort selected first, then unassigned, then guests already on other cards
    return [...matches].sort((a, b) => {
      const aSelected = memberIds.includes(a.id) ? 0 : 1;
      const bSelected = memberIds.includes(b.id) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      const aOccupied = occupiedMap.has(a.id) ? 1 : 0;
      const bOccupied = occupiedMap.has(b.id) ? 1 : 0;
      if (aOccupied !== bOccupied) return aOccupied - bOccupied;
      return a.display_name.localeCompare(b.display_name, 'vi');
    });
  }, [guests, guestSearch, memberIds, occupiedMap]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLock.current || saving) return;

    const trimmedName = cardName.trim();
    if (!trimmedName) {
      setError('Vui lòng nhập tên trên thiệp.');
      return;
    }
    if (memberIds.length === 0) {
      setError('Vui lòng chọn ít nhất 1 khách nhận thiệp.');
      return;
    }

    const repId = representativeId && memberIds.includes(representativeId)
      ? representativeId
      : memberIds[0];

    submitLock.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        card_name: trimmedName,
        representative_guest_id: repId,
        member_guest_ids: memberIds,
        delivery_method: deliveryMethod,
        status,
        sent_date: sentDate.trim() ? sentDate.trim().slice(0, 10) : null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (failure) {
      setError((failure as Error).message || 'Không thể lưu thiệp mời.');
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={isEdit ? 'Chỉnh sửa thiệp mời' : 'Tạo thiệp mời mới'}
      description="Gộp khách đi cùng thành 1 thiệp để theo dõi gửi thiệp gọn gàng."
      maxWidth="lg"
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Đóng
          </Button>
          <Button type="submit" form="invitation-editor-form" variant="primary" loading={saving}>
            {isEdit ? 'Lưu thay đổi' : 'Tạo thiệp mời'}
          </Button>
        </>
      }
    >
      <form id="invitation-editor-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert variant="danger">{error}</Alert>}

        <TextInput
          label="Tên ghi trên thiệp *"
          placeholder="Ví dụ: Gia đình Anh Tuấn, Nhóm bạn ĐH..."
          value={cardName}
          disabled={saving}
          onChange={(e) => {
            setNameTouched(true);
            setCardName(e.target.value);
            setError(null);
          }}
        />

        {/* Member selector */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-text-main">
              Khách nhận thiệp *{' '}
              <span className="text-xs font-normal text-text-muted">
                ({memberIds.length} người đã chọn)
              </span>
            </span>
            {memberIds.length > 0 && (
              <span className="text-[11px] text-text-muted">
                Bấm ★ để chọn người đại diện nhận thiệp
              </span>
            )}
          </div>

          {memberIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {memberIds.map((id) => {
                const guest = guestMap.get(id);
                if (!guest) return null;
                const isRep = representativeId === id;
                return (
                  <span
                    key={id}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      isRep
                        ? 'bg-primary text-white border-primary'
                        : 'bg-[#FAF8F3] text-text-main border-border-subtle'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setRepresentativeId(id)}
                      title="Đặt làm người đại diện"
                      className="inline-flex items-center gap-1"
                    >
                      <Star
                        className={`w-3 h-3 ${isRep ? 'fill-[#D4BF8F] text-[#D4BF8F]' : 'text-text-muted'}`}
                        aria-hidden="true"
                      />
                      <span className="font-medium">{guest.display_name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMember(id)}
                      aria-label={`Bỏ ${guest.display_name}`}
                      className={`ml-0.5 rounded-full p-0.5 ${
                        isRep ? 'hover:bg-white/20' : 'hover:bg-border-subtle'
                      }`}
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="border border-border-control rounded-control bg-surface overflow-hidden">
            <div className="relative border-b border-border-subtle bg-[#FAF8F4]">
              <Search
                className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                placeholder="Tìm tên khách để thêm vào thiệp..."
                className="w-full h-10 pl-9 pr-8 text-sm bg-transparent text-text-main focus:outline-none"
              />
              {guestSearch && (
                <button
                  type="button"
                  onClick={() => setGuestSearch('')}
                  aria-label="Xóa tìm kiếm khách"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-border-subtle/60">
              {filteredGuests.length === 0 ? (
                <p className="px-3.5 py-4 text-xs text-text-muted text-center">
                  {guests.length === 0
                    ? 'Chưa có khách mời nào trong danh sách.'
                    : 'Không tìm thấy khách mời phù hợp.'}
                </p>
              ) : (
                filteredGuests.map((guest) => {
                  const selected = memberIds.includes(guest.id);
                  const conflictCard = occupiedMap.get(guest.id);
                  const disabled = Boolean(conflictCard);

                  return (
                    <button
                      key={guest.id}
                      type="button"
                      disabled={disabled || saving}
                      onClick={() => toggleMember(guest.id)}
                      className={`w-full px-3.5 py-2 flex items-center justify-between gap-2 text-left text-sm transition-colors ${
                        disabled
                          ? 'opacity-50 cursor-not-allowed bg-page/50'
                          : selected
                          ? 'bg-primary/5 hover:bg-primary/10'
                          : 'hover:bg-[#FAF8F4]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            selected
                              ? 'bg-primary border-primary text-white'
                              : 'border-border-control bg-surface'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />}
                        </span>
                        <span className="font-medium text-text-main truncate">
                          {guest.display_name}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-page text-text-muted shrink-0">
                          {SIDE_LABELS[guest.side] || 'Khách'}
                        </span>
                      </div>
                      {conflictCard && (
                        <span className="text-[11px] text-text-muted truncate max-w-[160px] shrink-0">
                          Đã ở: {conflictCard}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Delivery Method & Status Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-sm font-medium text-text-main block">Hình thức gửi *</span>
            <div className="grid grid-cols-3 gap-1.5">
              {DELIVERY_METHOD_OPTIONS.map((opt) => {
                const Icon = METHOD_ICONS[opt.value];
                const active = deliveryMethod === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={saving}
                    onClick={() => setDeliveryMethod(opt.value)}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-control border text-xs font-medium transition-all ${
                      active
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-surface text-text-muted border-border-control hover:text-text-main hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="truncate max-w-full">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-text-main block">Tiến độ</span>
            <div className="grid grid-cols-3 gap-1.5">
              {INVITATION_STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={saving}
                    onClick={() => handleStatusChange(opt.value)}
                    className={`py-2.5 px-2 rounded-control border text-xs font-medium transition-all ${
                      active
                        ? 'bg-[#173C33] text-[#F6F3E9] border-[#173C33] shadow-sm'
                        : 'bg-surface text-text-muted border-border-control hover:text-text-main hover:bg-[#FAF8F4]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <div className="space-y-1.5 text-sm">
            <label htmlFor="invitation-sent-date" className="font-medium text-text-main block">
              Ngày gửi thiệp
            </label>
            <CalendarInput
              id="invitation-sent-date"
              label="Ngày gửi thiệp"
              value={sentDate}
              disabled={saving}
              onValueChange={setSentDate}
              className="w-full min-h-11 rounded-control border border-border-control bg-surface px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="space-y-1.5 text-sm">
            <label htmlFor="invitation-notes" className="font-medium text-text-main block">
              Ghi chú riêng
            </label>
            <textarea
              id="invitation-notes"
              rows={2}
              value={notes}
              disabled={saving}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Địa chỉ gửi bưu điện, dặn dò..."
              className="w-full rounded-control border border-border-control bg-surface px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
      </form>
    </ModalDialog>
  );
};
