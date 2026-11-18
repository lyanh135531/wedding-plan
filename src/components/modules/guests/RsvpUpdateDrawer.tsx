'use client';

import * as React from 'react';
import { useSaveAction } from '@/components/common/useSaveAction';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { UserCheck, UserX, HelpCircle, Utensils, AlertTriangle } from 'lucide-react';

const h = React.createElement;

export interface MemberRsvpState {
  guestId: string;
  name: string;
  rsvpStatus: 'accepted' | 'declined' | 'pending_reply' | 'tentative' | 'not_contacted';
  needsSeat: boolean;
  needsMeal: boolean;
  mealTier: 'regular' | 'vegetarian' | 'child_portion' | 'special';
  assignedTable?: string | null;
}

export interface RsvpUpdateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  householdName?: string;
  initialEventTitle?: string;
  initialMembers?: MemberRsvpState[];
  onSave?: (updatedMembers: MemberRsvpState[]) => void | Promise<void>;
}

const DEFAULT_MEMBERS: MemberRsvpState[] = [
    { guestId: 'bac_thanh', name: 'Bác Thành', rsvpStatus: 'accepted', needsSeat: true, needsMeal: true, mealTier: 'regular', assignedTable: 'Bàn A1' },
    { guestId: 'bac_gai', name: 'Bác Gái', rsvpStatus: 'accepted', needsSeat: true, needsMeal: true, mealTier: 'regular', assignedTable: 'Bàn A1' },
    { guestId: 'anh_tuan', name: 'Anh Tuấn', rsvpStatus: 'pending_reply', needsSeat: true, needsMeal: true, mealTier: 'vegetarian', assignedTable: null },
    { guestId: 'be_bi', name: 'Bé Bi', rsvpStatus: 'pending_reply', needsSeat: false, needsMeal: true, mealTier: 'child_portion', assignedTable: null },
  ];

export const RsvpUpdateDrawer: React.FC<RsvpUpdateDrawerProps> = ({
  isOpen,
  onClose,
  householdName = 'Gia đình Bác Thành',
  initialEventTitle = 'Lễ Vu Quy',
  initialMembers = DEFAULT_MEMBERS,
  onSave,
}) => {
  const { saving, saveError, runSave } = useSaveAction();
  const [members, setMembers] = React.useState<MemberRsvpState[]>(initialMembers);
  const [pendingUnseat, setPendingUnseat] = React.useState<{ guestId: string; tableName: string } | null>(null);

  React.useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  if (!isOpen) return null;

  const handleRsvpChange = (guestId: string, newStatus: 'accepted' | 'declined' | 'pending_reply') => {
    const member = members.find((m) => m.guestId === guestId);
    if (!member) return;

    // Table safety check (UXT03): if guest is seated and marked declined
    if (newStatus === 'declined' && member.assignedTable) {
      setPendingUnseat({ guestId, tableName: member.assignedTable });
      return;
    }

    setMembers((prev) =>
      prev.map((m) =>
        m.guestId === guestId ? { ...m, rsvpStatus: newStatus } : m
      )
    );
  };

  const handleConfirmUnseat = () => {
    if (!pendingUnseat) return;
    const { guestId } = pendingUnseat;
    setMembers((prev) =>
      prev.map((m) =>
        m.guestId === guestId
          ? { ...m, rsvpStatus: 'declined', assignedTable: null, needsSeat: false, needsMeal: false }
          : m
      )
    );
    setPendingUnseat(null);
  };

  const handleMealTierChange = (guestId: string, tier: 'regular' | 'vegetarian' | 'child_portion' | 'special') => {
    setMembers((prev) =>
      prev.map((m) => (m.guestId === guestId ? { ...m, mealTier: tier } : m))
    );
  };

  const handleSave = () => {
    void runSave(async () => { await onSave?.(members); onClose(); });
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'rsvp-drawer-title',
    },
    h(
      'div',
      {
        className:
          'w-full max-w-lg bg-surface h-full shadow-2xl flex flex-col justify-between overflow-y-auto p-6 border-l border-border-control',
      },
      saveError && h('p', { role: 'alert', className: 'text-danger' }, saveError),
      // Header
      h(
        'div',
        null,
        h(
          'div',
          { className: 'flex items-center justify-between border-b border-border-subtle pb-4 mb-4' },
          h(
            'div',
            null,
            h('span', { className: 'text-xs text-primary font-semibold uppercase tracking-wider' }, initialEventTitle),
            h('h2', { id: 'rsvp-drawer-title', className: 'text-lg font-bold text-text-main mt-0.5' }, householdName)
          ),
          h(
            'button',
            {
              onClick: onClose,
              className: 'p-1 text-text-muted hover:text-text-main text-lg rounded',
              'aria-label': 'Đóng ngăn kéo cập nhật RSVP',
            },
            '✕'
          )
        ),

        // Helper instruction
        h(
          'p',
          { className: 'text-xs text-text-muted mb-4' },
          'Cập nhật trạng thái phản hồi tham dự độc lập cho từng thành viên trong buổi lễ này.'
        ),

        // Members List
        h(
          'div',
          { className: 'space-y-4' },
          members.map((member) =>
            h(
              'div',
              {
                key: member.guestId,
                className: 'p-4 bg-[#FAF9F5] border border-border-subtle rounded-control text-sm space-y-3',
              },
              h(
                'div',
                { className: 'flex items-center justify-between gap-2' },
                h(
                  'span',
                  { className: 'font-semibold text-text-main text-base' },
                  member.name
                ),
                member.assignedTable &&
                  h(
                    'span',
                    { className: 'text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium' },
                    `Đang ngồi: ${member.assignedTable}`
                  )
              ),

              // RSVP Status Buttons
              h(
                'div',
                { className: 'grid grid-cols-3 gap-2' },
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => handleRsvpChange(member.guestId, 'accepted'),
                    className: `h-9 text-xs rounded border font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      member.rsvpStatus === 'accepted'
                        ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                        : 'bg-white text-text-main border-[#7A8881] hover:bg-[#F7F5F0]'
                    }`,
                  },
                  h(UserCheck, { className: 'w-3.5 h-3.5' }),
                  'Tham dự'
                ),

                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => handleRsvpChange(member.guestId, 'pending_reply'),
                    className: `h-9 text-xs rounded border font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      member.rsvpStatus === 'pending_reply'
                        ? 'bg-[#D97706] text-white border-[#D97706]'
                        : 'bg-white text-text-main border-[#7A8881] hover:bg-[#F7F5F0]'
                    }`,
                  },
                  h(HelpCircle, { className: 'w-3.5 h-3.5' }),
                  'Chưa trả lời'
                ),

                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => handleRsvpChange(member.guestId, 'declined'),
                    className: `h-9 text-xs rounded border font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      member.rsvpStatus === 'declined'
                        ? 'bg-danger text-white border-danger'
                        : 'bg-white text-text-main border-[#7A8881] hover:bg-[#F7F5F0]'
                    }`,
                  },
                  h(UserX, { className: 'w-3.5 h-3.5' }),
                  'Không đến'
                )
              ),

              // Dietary tier (if accepted)
              member.rsvpStatus === 'accepted' &&
                h(
                  'div',
                  { className: 'pt-2 border-t border-border-subtle flex items-center justify-between text-xs' },
                  h(
                    'span',
                    { className: 'text-text-muted flex items-center gap-1' },
                    h(Utensils, { className: 'w-3 h-3 text-text-muted' }),
                    'Chế độ ăn:'
                  ),
                  h(
                    'select',
                    {
                      value: member.mealTier,
                      onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                        handleMealTierChange(member.guestId, e.target.value as any),
                      className: 'h-8 px-2 text-xs bg-white border border-[#7A8881] rounded',
                    },
                    h('option', { value: 'regular' }, 'Khẩu phần chuẩn'),
                    h('option', { value: 'vegetarian' }, 'Ăn chay'),
                    h('option', { value: 'child_portion' }, 'Khẩu phần trẻ em'),
                    h('option', { value: 'special' }, 'Khẩu phần đặc biệt')
                  )
                )
            )
          )
        )
      ),

      // Footer
      h(
        'div',
        { className: 'pt-6 border-t border-border-subtle flex items-center justify-end gap-3 mt-6' },
        h(
          Button,
          {
            variant: 'secondary',
            onClick: onClose,
          },
          'Hủy'
        ),
        h(
          Button,
          {
            variant: 'primary',
            onClick: handleSave,
            disabled: saving,
          },
          'Lưu phản hồi tham dự'
        )
      ),

      // Confirmation modal for unseating when marked declined
      pendingUnseat &&
        h(ConfirmDialog, {
          isOpen: true,
          title: 'Cảnh báo gỡ chỗ ngồi tại bàn',
          description: `Khách đang ngồi tại ${pendingUnseat.tableName}. Thao tác này sẽ gỡ khách khỏi bàn và giảm 1 suất ăn. Bạn có đồng ý?`,
          confirmLabel: 'Đồng ý gỡ bàn',
          cancelLabel: 'Giữ nguyên',
          variant: 'danger',
          onConfirm: handleConfirmUnseat,
          onCancel: () => setPendingUnseat(null),
        })
    )
  );
};
