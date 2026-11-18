'use client';

import * as React from 'react';
import { useSaveAction } from '@/components/common/useSaveAction';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Users } from 'lucide-react';

const h = React.createElement;

export interface FamilyMemberDraft {
  id: string;
  name: string;
  ageTier: 'adult' | 'child' | 'baby';
  phone?: string;
  isRepresentative: boolean;
}

export interface AddFamilyModalProps {
  isOpen: boolean;
  initialGroupName?: string;
  initialMembers?: FamilyMemberDraft[];
  onClose: () => void;
  onSubmit: (familyData: {
    groupName: string;
    side: 'groom' | 'bride' | 'mutual';
    members: FamilyMemberDraft[];
  }) => void | Promise<void>;
}

export const AddFamilyModal: React.FC<AddFamilyModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialGroupName = 'Gia đình Bác Thành',
  initialMembers,
}) => {
  const { saving, saveError, runSave } = useSaveAction();
  const [groupName, setGroupName] = React.useState(initialGroupName);
  const [side, setSide] = React.useState<'groom' | 'bride' | 'mutual'>('groom');
  const [members, setMembers] = React.useState<FamilyMemberDraft[]>(initialMembers || [
    { id: '1', name: 'Bác Thành', ageTier: 'adult', phone: '0901234567', isRepresentative: true },
    { id: '2', name: 'Bác Gái', ageTier: 'adult', isRepresentative: false },
    { id: '3', name: 'Anh Tuấn', ageTier: 'adult', isRepresentative: false },
    { id: '4', name: 'Bé Bi', ageTier: 'baby', isRepresentative: false },
  ]);

  if (!isOpen) return null;

  const handleAddMember = () => {
    const newId = String(Date.now());
    setMembers((prev) => [
      ...prev,
      { id: newId, name: '', ageTier: 'adult', isRepresentative: false },
    ]);
  };

  const handleRemoveMember = (id: string) => {
    if (members.length <= 1) return;
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleMemberChange = (id: string, field: keyof FamilyMemberDraft, value: any) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          return { ...m, [field]: value };
        }
        if (field === 'isRepresentative' && value === true) {
          return { ...m, isRepresentative: false };
        }
        return m;
      })
    );
  };

  const adultCount = members.filter((m) => m.ageTier === 'adult').length;
  const childCount = members.filter((m) => m.ageTier === 'child').length;
  const babyCount = members.filter((m) => m.ageTier === 'baby').length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || members.length === 0) return;
    void runSave(async () => {
    await onSubmit({
      groupName,
      side,
      members,
    });
    onClose();
    });
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'add-family-title',
    },
    h(
      'div',
      {
        className:
          'bg-surface w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-card border border-border-control shadow-2xl p-6 text-text-main my-8',
      },
      saveError && h('p', { role: 'alert', className: 'text-danger' }, saveError),
      // Header
      h(
        'div',
        { className: 'flex items-center justify-between border-b border-border-subtle pb-4 mb-4' },
        h(
          'div',
          { className: 'flex items-center gap-2.5' },
          h(Users, { className: 'w-5 h-5 text-primary' }),
          h('h2', { id: 'add-family-title', className: 'text-lg font-bold' }, 'Thêm gia đình / Nhóm nhận thiệp')
        ),
        h(
          'button',
          {
            onClick: onClose,
            className: 'text-text-muted hover:text-text-main p-1 rounded',
            'aria-label': 'Đóng hộp thoại',
          },
          '✕'
        )
      ),

      // Form
      h(
        'form',
        { onSubmit: handleSubmit, className: 'space-y-4' },
        // Household Name
        h(TextInput, {
          label: 'Tên thiệp / Tên gia đình',
          value: groupName,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setGroupName(e.target.value),
          placeholder: 'Ví dụ: Gia đình Bác Thành',
          required: true,
        }),

        // Side selector
        h(
          'div',
          null,
          h('label', { className: 'block text-xs font-medium text-text-muted mb-1' }, 'Bên mời:'),
          h(
            'select',
            {
              value: side,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                setSide(e.target.value as any),
              className:
                'w-full h-10 px-3 text-sm bg-white border border-[#7A8881] rounded-control focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
            },
            h('option', { value: 'groom' }, 'Nhà trai'),
            h('option', { value: 'bride' }, 'Nhà gái'),
            h('option', { value: 'mutual' }, 'Bạn chung')
          )
        ),

        // Member list header
        h(
          'div',
          { className: 'pt-2' },
          h(
            'div',
            { className: 'flex items-center justify-between mb-2' },
            h('span', { className: 'text-xs font-semibold uppercase text-text-muted tracking-wider' }, 'Danh sách thành viên:'),
            h(
              Button,
              {
                type: 'button',
                variant: 'ghost',
                onClick: handleAddMember,
                leftIcon: h(Plus, { className: 'w-3.5 h-3.5' }),
                className: 'text-xs text-primary h-8 py-1 px-2',
              },
              'Thêm người'
            )
          ),

          // Member items
          h(
            'div',
            { className: 'space-y-2.5 max-h-[220px] overflow-y-auto pr-1' },
            members.map((member, index) =>
              h(
                'div',
                {
                  key: member.id,
                  className: 'p-3 bg-[#FAF9F5] border border-border-subtle rounded-control space-y-2',
                },
                h(
                  'div',
                  { className: 'flex items-center gap-2' },
                  h('input', {
                    type: 'text',
                    value: member.name,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                      handleMemberChange(member.id, 'name', e.target.value),
                    placeholder: `Tên người thứ ${index + 1}...`,
                    className:
                      'flex-1 h-9 px-2.5 text-sm bg-white border border-[#7A8881] rounded focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
                    required: true,
                  }),

                  h(
                    'select',
                    {
                      value: member.ageTier,
                      onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                        handleMemberChange(member.id, 'ageTier', e.target.value),
                      className: 'h-9 px-2 text-xs bg-white border border-[#7A8881] rounded',
                    },
                    h('option', { value: 'adult' }, 'Người lớn'),
                    h('option', { value: 'child' }, 'Trẻ em'),
                    h('option', { value: 'baby' }, 'Em bé')
                  ),

                  members.length > 1 &&
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => handleRemoveMember(member.id),
                        className: 'p-2 text-danger hover:bg-danger-bg rounded',
                        title: 'Xóa thành viên',
                      },
                      h(Trash2, { className: 'w-4 h-4' })
                    )
                ),

                h(
                  'div',
                  { className: 'flex items-center justify-between text-xs pt-1' },
                  h(Checkbox, {
                    checked: member.isRepresentative,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                      handleMemberChange(member.id, 'isRepresentative', e.target.checked),
                    label: 'Người nhận thiệp đại diện',
                  }),
                  member.isRepresentative &&
                    h('input', {
                      type: 'tel',
                      value: member.phone || '',
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        handleMemberChange(member.id, 'phone', e.target.value),
                      placeholder: 'Số ĐT liên hệ...',
                      className: 'h-7 px-2 text-xs border border-[#7A8881] rounded w-36 bg-white',
                    })
                )
              )
            )
          )
        ),

        // Summary banner (UXT02)
        h(
          'div',
          { className: 'p-3 bg-primary/10 border border-primary/20 rounded-control text-xs text-text-main flex items-center justify-between' },
          h('span', null, 'Tóm tắt tạo mới:'),
          h(
            'span',
            { className: 'font-semibold text-primary' },
            `1 thiệp, ${members.length} người (${adultCount} người lớn, ${childCount} trẻ em, ${babyCount} em bé)`
          )
        ),

        // Footer buttons
        h(
          'div',
          { className: 'flex items-center justify-end gap-3 pt-3 border-t border-border-subtle' },
          h(
            Button,
            {
              type: 'button',
              variant: 'secondary',
              onClick: onClose,
            },
            'Hủy bỏ'
          ),
          h(
            Button,
            {
              type: 'submit',
            disabled: saving,
              variant: 'primary',
            },
            `Lưu gia đình (${members.length} khách)`
          )
        )
      )
    )
  );
};
