'use client';

import * as React from 'react';
import { useSaveAction } from '@/components/common/useSaveAction';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, X } from 'lucide-react';

const h = React.createElement;

export interface AddGuestDraft {
  displayName: string;
  side: 'groom' | 'bride' | 'mutual' | 'unassigned';
  ageTier: 'adult' | 'child' | 'baby';
  phone: string;
  email: string;
  address: string;
  privateNotes: string;
  isPlaceholder: boolean;
  placeholderFor: string;
  subTags: string[];
}

export interface AddGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (guestData: AddGuestDraft) => void | Promise<void>;
}

export const AddGuestModal: React.FC<AddGuestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const { saving, saveError, runSave } = useSaveAction();
  const [displayName, setDisplayName] = React.useState('');
  const [side, setSide] = React.useState<'groom' | 'bride' | 'mutual' | 'unassigned'>('groom');
  const [ageTier, setAgeTier] = React.useState<'adult' | 'child' | 'baby'>('adult');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [privateNotes, setPrivateNotes] = React.useState('');
  const [isPlaceholder, setIsPlaceholder] = React.useState(false);
  const [placeholderFor, setPlaceholderFor] = React.useState('');
  const [subTagsText, setSubTagsText] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Tên khách mời không được để trống');
      return;
    }

    const subTags = subTagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    void runSave(async () => {
    await onSubmit({
      displayName: displayName.trim(),
      side,
      ageTier,
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      privateNotes: privateNotes.trim(),
      isPlaceholder,
      placeholderFor: isPlaceholder ? (placeholderFor.trim() || displayName.trim()) : '',
      subTags,
    });

    onClose();
    });
  };

  return h(
    'div',
    {
      className: 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'add-guest-modal-title',
    },
    h(
      'div',
      {
        className: 'bg-surface rounded-card border border-border-subtle shadow-modal w-full max-w-lg max-h-[90dvh] overflow-y-auto p-6 space-y-5 animate-in fade-in zoom-in-95',
      },
      saveError && h('p', { role: 'alert', className: 'text-danger' }, saveError),
      // Header
      h(
        'div',
        { className: 'flex items-center justify-between pb-3 border-b border-border-subtle' },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(UserPlus, { className: 'w-5 h-5 text-primary' }),
          h('h2', { id: 'add-guest-modal-title', className: 'text-lg font-bold text-text-main' }, 'Thêm Khách Mời Đơn Lẻ')
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: onClose,
            className: 'text-text-muted hover:text-text-main p-1 rounded-control transition-colors',
            'aria-label': 'Đóng',
          },
          h(X, { className: 'w-5 h-5' })
        )
      ),

      // Error message
      error &&
        h(
          'div',
          { className: 'p-3 bg-danger/10 border border-danger/30 rounded-control text-sm text-danger' },
          error
        ),

      // Form
      h(
        'form',
        { onSubmit: handleSubmit, className: 'space-y-4' },
        // Display Name
        h(TextInput, {
          label: 'Họ và tên khách mời *',
          placeholder: 'Ví dụ: Nguyễn Văn An',
          value: displayName,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            setDisplayName(e.target.value);
            if (error) setError(null);
          },
          required: true,
        }),

        // Side & Age Tier
        h(
          'div',
          { className: 'grid grid-cols-2 gap-3' },
          h(
            'div',
            { className: 'space-y-1.5' },
            h('label', { className: 'block text-sm font-medium text-text-main' }, 'Bên mời'),
            h(
              'select',
              {
                className: 'w-full h-10 px-3 rounded-control border border-border-subtle bg-surface-card text-text-main text-sm focus:outline-none focus:border-primary',
                value: side,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSide(e.target.value as any),
              },
              h('option', { value: 'groom' }, 'Nhà trai'),
              h('option', { value: 'bride' }, 'Nhà gái'),
              h('option', { value: 'mutual' }, 'Bạn chung'),
              h('option', { value: 'unassigned' }, 'Chưa phân chia')
            )
          ),
          h(
            'div',
            { className: 'space-y-1.5' },
            h('label', { className: 'block text-sm font-medium text-text-main' }, 'Độ tuổi'),
            h(
              'select',
              {
                className: 'w-full h-10 px-3 rounded-control border border-border-subtle bg-surface-card text-text-main text-sm focus:outline-none focus:border-primary',
                value: ageTier,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setAgeTier(e.target.value as any),
              },
              h('option', { value: 'adult' }, 'Người lớn (Mặc định cần ghế/suất)'),
              h('option', { value: 'child' }, 'Trẻ em (Suất trẻ em)'),
              h('option', { value: 'baby' }, 'Em bé (Không ghế/suất)')
            )
          )
        ),

        // Phone & Email
        h(
          'div',
          { className: 'grid grid-cols-2 gap-3' },
          h(TextInput, {
            label: 'Số điện thoại',
            placeholder: '0901234567',
            value: phone,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value),
          }),
          h(TextInput, {
            label: 'Email',
            type: 'email',
            placeholder: 'khach@example.com',
            value: email,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
          })
        ),

        // Address
        h(TextInput, {
          label: 'Địa chỉ / Nơi gửi thiệp',
          placeholder: 'Số nhà, đường, quận/huyện',
          value: address,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value),
        }),

        // Sub tags
        h(TextInput, {
          label: 'Thẻ phân loại (ngăn cách bằng dấu phẩy)',
          placeholder: 'Bạn cấp 3, Cùng công ty, Họ nội...',
          value: subTagsText,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSubTagsText(e.target.value),
        }),

        // Placeholder toggle (Chưa rõ tên - PLAN §8.2)
        h(
          'div',
          { className: 'p-3 bg-surface-hover rounded-control border border-border-subtle space-y-2' },
          h(Checkbox, {
            id: 'is-placeholder-checkbox',
            checked: isPlaceholder,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setIsPlaceholder(e.target.checked),
            label: 'Đánh dấu là người đi cùng chưa rõ tên (+1)',
          }),
          isPlaceholder &&
            h(TextInput, {
              label: 'Đi cùng với ai?',
              placeholder: 'Ví dụ: Bạn gái của Tuấn',
              value: placeholderFor,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPlaceholderFor(e.target.value),
            })
        ),

        // Private notes
        h(
          'div',
          { className: 'space-y-1.5' },
          h('label', { className: 'block text-sm font-medium text-text-main' }, 'Ghi chú riêng tư (Chỉ chủ sở hữu thấy)'),
          h('textarea', {
            rows: 2,
            className: 'w-full px-3 py-2 rounded-control border border-border-subtle bg-surface-card text-text-main text-sm focus:outline-none focus:border-primary',
            placeholder: 'Lưu ý về sở thích, chỗ ngồi VIP, thói quen ăn uống...',
            value: privateNotes,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setPrivateNotes(e.target.value),
          })
        ),

        // Actions
        h(
          'div',
          { className: 'flex items-center justify-end gap-3 pt-3 border-t border-border-subtle' },
          h(
            Button,
            { type: 'button', variant: 'secondary', onClick: onClose },
            'Hủy bỏ'
          ),
          h(
            Button,
            { type: 'submit',
            disabled: saving, variant: 'primary' },
            'Thêm khách mời'
          )
        )
      )
    )
  );
};
