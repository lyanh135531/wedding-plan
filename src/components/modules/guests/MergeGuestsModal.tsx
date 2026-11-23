'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/dialog';
import {
  GitMerge,
  X,
  AlertTriangle,
  Check,
  ArrowRight,
  ShieldAlert,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
} from 'lucide-react';
import { MergeGuestsInput } from '@/schemas/guests';

const h = React.createElement;

export interface GuestProfileSummary {
  id: string;
  displayName: string;
  side: string;
  groupName?: string | null;
  ageTier?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  privateNotes?: string | null;
  subTags?: string[];
  attendances?: Array<{
    eventId: string;
    eventName?: string;
    rsvpStatus: 'not_contacted' | 'pending_reply' | 'tentative' | 'accepted' | 'declined';
    needsSeat?: boolean;
    needsMeal?: boolean;
    mealDietaryTier?: 'regular' | 'vegetarian' | 'child_portion' | 'special';
    tableName?: string | null;
  }>;
}

export interface DuplicatePairSummary {
  guest_a: GuestProfileSummary;
  guest_b: GuestProfileSummary;
  similarity_score?: number;
  match_reasons?: string[];
}

export interface MergeGuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidatePair?: DuplicatePairSummary | null;
  onMergeSuccess?: (result: any) => void;
  onMergeSubmit?: (input: MergeGuestsInput) => Promise<any>;
}

export const MergeGuestsModal: React.FC<MergeGuestsModalProps> = ({
  isOpen,
  onClose,
  candidatePair,
  onMergeSuccess,
  onMergeSubmit,
}) => {
  const [retainedSide, setRetainedSide] = React.useState<'A' | 'B'>('A');
  const [phoneChoice, setPhoneChoice] = React.useState<'A' | 'B' | 'custom'>('A');
  const [customPhone, setCustomPhone] = React.useState('');
  const [emailChoice, setEmailChoice] = React.useState<'A' | 'B' | 'custom'>('A');
  const [customEmail, setCustomEmail] = React.useState('');
  const [addressChoice, setAddressChoice] = React.useState<'A' | 'B' | 'custom'>('A');
  const [customAddress, setCustomAddress] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Initialize form state when candidatePair changes
  React.useEffect(() => {
    if (candidatePair) {
      setRetainedSide('A');
      setPhoneChoice(candidatePair.guest_a.phone ? 'A' : candidatePair.guest_b.phone ? 'B' : 'A');
      setCustomPhone('');
      setEmailChoice(candidatePair.guest_a.email ? 'A' : candidatePair.guest_b.email ? 'B' : 'A');
      setCustomEmail('');
      setAddressChoice(
        candidatePair.guest_a.address ? 'A' : candidatePair.guest_b.address ? 'B' : 'A'
      );
      setCustomAddress('');
      setErrorMessage(null);
    }
  }, [candidatePair]);

  if (!isOpen || !candidatePair) return null;

  const guestA = candidatePair.guest_a;
  const guestB = candidatePair.guest_b;

  const retainedGuest = retainedSide === 'A' ? guestA : guestB;
  const mergedGuest = retainedSide === 'A' ? guestB : guestA;

  const getResolvedPhone = () => {
    if (phoneChoice === 'A') return guestA.phone || null;
    if (phoneChoice === 'B') return guestB.phone || null;
    return customPhone.trim() || null;
  };

  const getResolvedEmail = () => {
    if (emailChoice === 'A') return guestA.email || null;
    if (emailChoice === 'B') return guestB.email || null;
    return customEmail.trim() || null;
  };

  const getResolvedAddress = () => {
    if (addressChoice === 'A') return guestA.address || null;
    if (addressChoice === 'B') return guestB.address || null;
    return customAddress.trim() || null;
  };

  const handleExecuteMerge = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    const payload: MergeGuestsInput = {
      retained_guest_id: retainedGuest.id,
      merged_guest_id: mergedGuest.id,
      resolved_phone: getResolvedPhone(),
      resolved_email: getResolvedEmail(),
      resolved_address: getResolvedAddress(),
      attendance_conflict_resolutions: [],
    };

    try {
      if (onMergeSubmit) {
        const res = await onMergeSubmit(payload);
        onMergeSuccess?.(res);
      } else {
        const response = await fetch('/api/v1/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Gộp hồ sơ thất bại');
        }
        onMergeSuccess?.(data.data);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi không xác định khi gộp khách');
    } finally {
      setIsSubmitting(false);
    }
  };

  return h(
    ModalDialog,
    {
      isOpen,
      onClose,
      title: 'So Sánh & Gộp Trùng Hồ Sơ Khách',
      description: 'Chọn hồ sơ chính được giữ lại và chọn thông tin liên hệ ưu tiên.',
      maxWidth: 'xl',
      footer: h(
        'div',
        { className: 'flex items-center justify-end gap-3 w-full' },
        h(
          Button,
          {
            type: 'button',
            variant: 'secondary',
            onClick: onClose,
            disabled: isSubmitting,
          },
          'Hủy'
        ),
        h(
          Button,
          {
            type: 'button',
            variant: 'primary',
            loading: isSubmitting,
            loadingText: 'Đang gộp...',
            onClick: handleExecuteMerge,
          },
          `Xác nhận gộp vào ${retainedGuest.displayName}`
        )
      ),
    },
    h(
      'div',
      {
        className: 'space-y-5',
      },

      // Reasons & Match alert
      candidatePair.match_reasons && candidatePair.match_reasons.length > 0 &&
        h(
          'div',
          {
            className:
              'p-3 rounded-control bg-[#FFF8E1] border border-[#F6D878] text-xs text-[#854D0E] flex items-start gap-2',
          },
          h(AlertTriangle, { className: 'w-4 h-4 shrink-0 mt-0.5' }),
          h(
            'div',
            null,
            h('span', { className: 'font-semibold' }, 'Lý do gợi ý trùng: '),
            candidatePair.match_reasons.join(', ')
          )
        ),

      // Step 1: Select Retained Profile
      h(
        'div',
        { className: 'space-y-3' },
        h(
          'h3',
          { className: 'text-sm font-bold text-text-main' },
          '1. Chọn hồ sơ chính (Hồ sơ còn lại sẽ được xóa mềm và lưu lịch sử)'
        ),
        h(
          'div',
          { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
          // Card A
          h(
            'div',
            {
              onClick: () => setRetainedSide('A'),
              className: `p-4 rounded-card border-2 cursor-pointer transition-all ${
                retainedSide === 'A'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border-subtle bg-surface-card hover:border-border-control'
              }`,
            },
            h(
              'div',
              { className: 'flex items-center justify-between mb-2' },
              h('span', { className: 'text-xs font-bold uppercase text-primary' }, 'Hồ sơ A'),
              retainedSide === 'A'
                ? h(
                    'span',
                    {
                      className:
                        'px-2 py-0.5 rounded text-xs font-bold bg-primary text-white flex items-center gap-1',
                    },
                    h(Check, { className: 'w-3 h-3' }),
                    'Giữ lại'
                  )
                : h('span', { className: 'text-xs text-text-muted' }, 'Sẽ bị gộp')
            ),
            h('h4', { className: 'font-bold text-text-main text-base' }, guestA.displayName),
            h(
              'div',
              { className: 'mt-2 space-y-1 text-xs text-text-muted' },
              h('div', null, `Bên: ${guestA.side}`),
              h('div', null, `SĐT: ${guestA.phone || '(Trống)'}`),
              h('div', null, `Email: ${guestA.email || '(Trống)'}`),
              guestA.groupName && h('div', null, `Nhóm: ${guestA.groupName}`)
            )
          ),

          // Card B
          h(
            'div',
            {
              onClick: () => setRetainedSide('B'),
              className: `p-4 rounded-card border-2 cursor-pointer transition-all ${
                retainedSide === 'B'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border-subtle bg-surface-card hover:border-border-control'
              }`,
            },
            h(
              'div',
              { className: 'flex items-center justify-between mb-2' },
              h('span', { className: 'text-xs font-bold uppercase text-primary' }, 'Hồ sơ B'),
              retainedSide === 'B'
                ? h(
                    'span',
                    {
                      className:
                        'px-2 py-0.5 rounded text-xs font-bold bg-primary text-white flex items-center gap-1',
                    },
                    h(Check, { className: 'w-3 h-3' }),
                    'Giữ lại'
                  )
                : h('span', { className: 'text-xs text-text-muted' }, 'Sẽ bị gộp')
            ),
            h('h4', { className: 'font-bold text-text-main text-base' }, guestB.displayName),
            h(
              'div',
              { className: 'mt-2 space-y-1 text-xs text-text-muted' },
              h('div', null, `Bên: ${guestB.side}`),
              h('div', null, `SĐT: ${guestB.phone || '(Trống)'}`),
              h('div', null, `Email: ${guestB.email || '(Trống)'}`),
              guestB.groupName && h('div', null, `Nhóm: ${guestB.groupName}`)
            )
          )
        )
      ),

      // Step 2: Field-Level Resolution
      h(
        'div',
        { className: 'space-y-4 pt-3 border-t border-border-subtle' },
        h(
          'h3',
          { className: 'text-sm font-bold text-text-main' },
          '2. Giải quyết xung đột dữ liệu liên hệ'
        ),

        // Phone resolution
        h(
          'div',
          { className: 'space-y-1.5' },
          h('label', { className: 'block text-xs font-semibold text-text-muted' }, 'Số điện thoại'),
          h(
            'div',
            { className: 'grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs' },
            h(
              'button',
              {
                type: 'button',
                onClick: () => setPhoneChoice('A'),
                className: `p-2.5 rounded-control border text-left min-h-[44px] transition-colors ${
                  phoneChoice === 'A'
                    ? 'border-primary bg-primary/10 font-bold text-primary'
                    : 'border-border-control hover:bg-surface-hover'
                }`,
              },
              `A: ${guestA.phone || '(Trống)'}`
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => setPhoneChoice('B'),
                className: `p-2.5 rounded-control border text-left min-h-[44px] transition-colors ${
                  phoneChoice === 'B'
                    ? 'border-primary bg-primary/10 font-bold text-primary'
                    : 'border-border-control hover:bg-surface-hover'
                }`,
              },
              `B: ${guestB.phone || '(Trống)'}`
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => setPhoneChoice('custom'),
                className: `p-2.5 rounded-control border text-left min-h-[44px] transition-colors ${
                  phoneChoice === 'custom'
                    ? 'border-primary bg-primary/10 font-bold text-primary'
                    : 'border-border-control hover:bg-surface-hover'
                }`,
              },
              'Nhập số khác'
            )
          ),
          phoneChoice === 'custom' &&
            h(TextInput, {
              label: 'Số điện thoại khác',
              placeholder: 'Ví dụ: 0901234567',
              value: customPhone,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCustomPhone(e.target.value),
            })
        ),

        // Email resolution
        h(
          'div',
          { className: 'space-y-1.5' },
          h('label', { className: 'block text-xs font-semibold text-text-muted' }, 'Email'),
          h(
            'div',
            { className: 'grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs' },
            h(
              'button',
              {
                type: 'button',
                onClick: () => setEmailChoice('A'),
                className: `p-2.5 rounded-control border text-left min-h-[44px] transition-colors ${
                  emailChoice === 'A'
                    ? 'border-primary bg-primary/10 font-bold text-primary'
                    : 'border-border-control hover:bg-surface-hover'
                }`,
              },
              `A: ${guestA.email || '(Trống)'}`
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => setEmailChoice('B'),
                className: `p-2.5 rounded-control border text-left min-h-[44px] transition-colors ${
                  emailChoice === 'B'
                    ? 'border-primary bg-primary/10 font-bold text-primary'
                    : 'border-border-control hover:bg-surface-hover'
                }`,
              },
              `B: ${guestB.email || '(Trống)'}`
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => setEmailChoice('custom'),
                className: `p-2.5 rounded-control border text-left min-h-[44px] transition-colors ${
                  emailChoice === 'custom'
                    ? 'border-primary bg-primary/10 font-bold text-primary'
                    : 'border-border-control hover:bg-surface-hover'
                }`,
              },
              'Nhập email khác'
            )
          ),
          emailChoice === 'custom' &&
            h(TextInput, {
              label: 'Email khác',
              placeholder: 'email@example.com',
              value: customEmail,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCustomEmail(e.target.value),
            })
        ),

        // Automatic combination notes
        h(
          'div',
          {
            className:
              'p-3 rounded-card bg-surface-card border border-border-subtle text-xs text-text-muted space-y-1',
          },
          h(
            'div',
            { className: 'font-semibold text-text-main flex items-center gap-1.5' },
            h(ShieldAlert, { className: 'w-4 h-4 text-primary' }),
            'Quy tắc tự động bảo toàn dữ liệu (AT09):'
          ),
          h('ul', { className: 'list-disc pl-5 space-y-0.5' },
            h('li', null, 'Toàn bộ thẻ phụ (sub-tags) của cả 2 hồ sơ sẽ được gộp chung.'),
            h('li', null, 'Ghi chú riêng tư của hồ sơ bị gộp sẽ được nối vào hồ sơ chính kèm nhãn xuất xứ.'),
            h('li', null, 'Quan hệ thiệp mời, bàn tiệc và lịch sử liên hệ được chuyển giao an toàn.')
          )
        )
      ),

      // Error message if any
      errorMessage &&
        h(
          'div',
          {
            className:
              'p-3 rounded-control bg-danger/10 border border-danger/30 text-danger text-sm font-medium',
          },
          errorMessage
        ),

    )
  );
};
