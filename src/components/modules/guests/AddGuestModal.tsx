'use client';

import * as React from 'react';
import { useSaveAction } from '@/components/common/useSaveAction';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ModalDialog } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

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
    ModalDialog,
    {
      isOpen,
      onClose,
      title: 'Thêm Khách Mời Đơn Lẻ',
      footer: h(
        'div',
        { className: 'flex items-center justify-end gap-3 w-full' },
        h(
          Button,
          { type: 'button', variant: 'secondary', onClick: onClose },
          'Hủy bỏ'
        ),
        h(
          Button,
          {
            type: 'submit',
            form: 'add-guest-form',
            disabled: saving,
            variant: 'primary',
          },
          'Thêm khách mời'
        )
      ),
    },
    h(
      'div',
      {
        className: 'space-y-3.5',
      },
      saveError && h('p', { role: 'alert', className: 'text-danger text-sm' }, saveError),

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
        { id: 'add-guest-form', onSubmit: handleSubmit, className: 'space-y-3.5' },
        // Display Name
        h(TextInput, {
          label: 'Họ và tên khách mời',
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
          { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' },
          h(Select, {
            label: 'Bên mời',
            'aria-label': 'Bên mời',
            value: side,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSide(e.target.value as any),
            options: [
              { value: 'groom', label: 'Nhà trai' },
              { value: 'bride', label: 'Nhà gái' },
              { value: 'mutual', label: 'Bạn chung' },
              { value: 'unassigned', label: 'Chưa phân chia' },
            ],
          }),
          h(Select, {
            label: 'Độ tuổi',
            'aria-label': 'Độ tuổi',
            value: ageTier,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setAgeTier(e.target.value as any),
            options: [
              { value: 'adult', label: 'Người lớn (Cần ghế)' },
              { value: 'child', label: 'Trẻ em (Suất trẻ em)' },
              { value: 'baby', label: 'Em bé (Không cần ghế)' },
            ],
          })
        ),

        // Phone & Email
        h(
          'div',
          { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
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
          { className: 'py-1 space-y-2' },
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
            'aria-label': 'Ghi chú riêng tư',
            rows: 2,
            className: 'w-full px-3 py-2 rounded-control border border-border-subtle bg-surface-card text-text-main text-sm focus:outline-none focus:border-primary resize-none',
            placeholder: 'Lưu ý về sở thích, chỗ ngồi VIP, thói quen ăn uống...',
            value: privateNotes,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setPrivateNotes(e.target.value),
          })
        )
      )
    )
  );
};
