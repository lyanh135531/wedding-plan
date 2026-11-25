'use client';

import * as React from 'react';
import { useSaveAction } from '@/components/common/useSaveAction';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Phone, Plus, Trash2, Users } from 'lucide-react';
import { ModalDialog } from '@/components/ui/dialog';

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

/**
 * Modal for creating one household invitation card along with multiple individual guest records.
 */
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
  const [members, setMembers] = React.useState<FamilyMemberDraft[]>(
    initialMembers || [
      { id: '1', name: 'Bác Thành', ageTier: 'adult', phone: '0901234567', isRepresentative: true },
      { id: '2', name: 'Bác Gái', ageTier: 'adult', isRepresentative: false },
      { id: '3', name: 'Anh Tuấn', ageTier: 'adult', isRepresentative: false },
      { id: '4', name: 'Bé Bi', ageTier: 'baby', isRepresentative: false },
    ]
  );

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

  const handleMemberChange = <K extends keyof FamilyMemberDraft>(
    id: string,
    field: K,
    value: FamilyMemberDraft[K]
  ) => {
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
    ModalDialog,
    {
      isOpen,
      onClose,
      title: 'Thêm gia đình / Nhóm nhận thiệp',
      description:
        'Tạo chung 1 thiệp mời cho cả gia đình, vẫn theo dõi tham dự và bàn tiệc riêng từng thành viên.',
      maxWidth: 'lg',
      footer: h(
        'div',
        { className: 'flex items-center justify-end gap-3 w-full' },
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
            form: 'add-family-form',
            disabled: saving,
            loading: saving,
            loadingText: 'Đang lưu...',
            variant: 'primary',
          },
          `Lưu gia đình (${members.length} khách)`
        )
      ),
    },
    saveError && h('p', { role: 'alert', className: 'text-sm text-danger mb-3' }, saveError),
    h(
      'form',
      { id: 'add-family-form', onSubmit: handleSubmit, className: 'space-y-5' },
      // Household Name & Wedding Side side-by-side
      h(
        'div',
        { className: 'grid grid-cols-1 sm:grid-cols-12 gap-3.5' },
        h(
          'div',
          { className: 'sm:col-span-7' },
          h(TextInput, {
            label: 'Tên thiệp / Tên gia đình',
            value: groupName,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setGroupName(e.target.value),
            placeholder: 'Ví dụ: Gia đình Bác Thành',
            required: true,
          })
        ),
        h(
          'div',
          { className: 'sm:col-span-5' },
          h(Select, {
            label: 'Bên mời',
            value: side,
            'aria-label': 'Bên mời',
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              setSide(e.target.value as 'groom' | 'bride' | 'mutual'),
            options: [
              { value: 'groom', label: 'Nhà trai' },
              { value: 'bride', label: 'Nhà gái' },
              { value: 'mutual', label: 'Bạn chung' },
            ],
          })
        )
      ),

      // Member list section
      h(
        'div',
        { className: 'space-y-3' },
        h(
          'div',
          { className: 'flex items-center justify-between gap-3 pt-1' },
          h(
            'div',
            { className: 'flex items-center gap-2 min-w-0' },
            h(Users, { className: 'w-4 h-4 text-primary shrink-0', 'aria-hidden': 'true' }),
            h(
              'span',
              { className: 'text-xs font-semibold uppercase text-text-muted tracking-wider' },
              'Danh sách thành viên:'
            ),
            h(
              'span',
              {
                className:
                  'px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold tabular-nums shrink-0',
              },
              `${members.length} người`
            )
          ),
          h(
            Button,
            {
              type: 'button',
              variant: 'secondary',
              size: 'sm',
              onClick: handleAddMember,
              leftIcon: h(Plus, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' }),
              className:
                'min-h-[36px] h-9 px-3.5 text-xs rounded-full border-primary/25 text-primary bg-primary/[0.04] hover:bg-primary/10 hover:border-primary/40 shadow-none shrink-0',
            },
            'Thêm người'
          )
        ),

        // Member cards
        h(
          'div',
          { className: 'space-y-2.5' },
          members.map((member, index) => {
            const canDelete = members.length > 1;
            return h(
              'div',
              {
                key: member.id,
                className: `rounded-xl border p-3.5 transition-colors space-y-2.5 ${
                  member.isRepresentative
                    ? 'bg-[#F4F7F2] border-primary/30 shadow-[0_1px_4px_rgba(23,60,51,0.05)]'
                    : 'bg-[#FAF8F3]/90 border-border-subtle hover:border-border-control'
                }`,
              },
              // Primary controls row: index + name + age + delete (flush single row on desktop)
              h(
                'div',
                {
                  className: canDelete
                    ? 'grid grid-cols-[28px_minmax(0,1fr)_44px] sm:grid-cols-[28px_minmax(0,1fr)_144px_44px] items-center gap-2.5'
                    : 'grid grid-cols-[28px_minmax(0,1fr)] sm:grid-cols-[28px_minmax(0,1fr)_144px] items-center gap-2.5',
                },
                h(
                  'span',
                  {
                    className: `w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold tabular-nums shrink-0 ${
                      member.isRepresentative
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-surface border border-border-subtle text-text-muted'
                    }`,
                  },
                  `${index + 1}`
                ),
                h('input', {
                  type: 'text',
                  value: member.name,
                  'aria-label': `Họ và tên thành viên ${index + 1}`,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                    handleMemberChange(member.id, 'name', e.target.value),
                  placeholder: `Tên người thứ ${index + 1}...`,
                  className: `${
                    canDelete ? 'col-span-2 sm:col-span-1' : ''
                  } w-full min-w-0 h-11 px-3 text-sm bg-surface border border-border-control rounded-control text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5`,
                  required: true,
                }),
                h(
                  'select',
                  {
                    value: member.ageTier,
                    'aria-label': `Độ tuổi thành viên ${index + 1}`,
                    onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                      handleMemberChange(
                        member.id,
                        'ageTier',
                        e.target.value as FamilyMemberDraft['ageTier']
                      ),
                    className: `${
                      canDelete ? 'col-span-2 sm:col-span-1' : 'col-span-2 sm:col-span-1'
                    } w-full min-w-0 h-11 pl-3 pr-8 text-sm bg-surface border border-border-control rounded-control text-text-main`,
                  },
                  h('option', { value: 'adult' }, 'Người lớn'),
                  h('option', { value: 'child' }, 'Trẻ em'),
                  h('option', { value: 'baby' }, 'Em bé')
                ),
                canDelete &&
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => handleRemoveMember(member.id),
                      className:
                        'h-11 w-11 inline-flex items-center justify-center rounded-control text-text-muted hover:text-danger hover:bg-danger-bg/60 transition-colors justify-self-center',
                      title: 'Xóa thành viên',
                      'aria-label': `Xóa thành viên ${index + 1}`,
                    },
                    h(Trash2, { className: 'w-4 h-4', 'aria-hidden': 'true' })
                  )
              ),

              // Secondary row: representative toggle & phone input
              h(
                'div',
                {
                  className:
                    'pt-2 border-t border-border-subtle/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5',
                },
                h(Checkbox, {
                  checked: member.isRepresentative,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                    handleMemberChange(member.id, 'isRepresentative', e.target.checked),
                  label: 'Người nhận thiệp đại diện',
                  className: 'min-h-[36px] py-0.5 text-xs',
                }),
                member.isRepresentative &&
                  h(
                    'div',
                    { className: 'relative w-full sm:w-52 shrink-0' },
                    h(Phone, {
                      className:
                        'w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none',
                      'aria-hidden': 'true',
                    }),
                    h('input', {
                      type: 'tel',
                      value: member.phone || '',
                      'aria-label': 'Số điện thoại đại diện',
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        handleMemberChange(member.id, 'phone', e.target.value),
                      placeholder: 'Số ĐT liên hệ...',
                      className:
                        'w-full h-11 pl-8 pr-3 text-xs bg-surface border border-border-control rounded-control text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5',
                    })
                  )
              )
            );
          })
        )
      ),

      // Summary banner (UXT02)
      h(
        'div',
        {
          className:
            'px-4 py-3 rounded-xl bg-gradient-to-r from-[#F4F7F2] to-[#FAF7EF] border border-[#DCE4D8] text-xs text-text-main flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5',
        },
        h(
          'span',
          { className: 'inline-flex items-center gap-1.5 text-text-muted font-medium' },
          h(Mail, { className: 'w-3.5 h-3.5 text-primary', 'aria-hidden': 'true' }),
          'Tóm tắt tạo mới:'
        ),
        h(
          'span',
          { className: 'font-semibold text-primary tabular-nums' },
          `1 thiệp, ${members.length} người (${adultCount} người lớn, ${childCount} trẻ em, ${babyCount} em bé)`
        )
      )
    )
  );
};
