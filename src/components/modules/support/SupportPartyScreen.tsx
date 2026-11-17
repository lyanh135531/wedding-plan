'use client';

import * as React from 'react';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { useRole } from '@/context/RoleContext';
import {
  SupportMember,
  SupportRole,
  SupportMemberFormData,
} from './types';
import { INITIAL_SUPPORT_MEMBERS } from './fixtures';
import { SupportMemberCard, ROLE_CONFIG } from './SupportMemberCard';
import { AddEditSupportMemberModal } from './AddEditSupportMemberModal';
import {
  Users,
  Search,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Lock,
} from 'lucide-react';

const h = React.createElement;

export interface SupportPartyScreenProps {
  initialState?: PrototypeState;
  initialMembers?: SupportMember[];
  onMembersChange?: (members: SupportMember[]) => void;
  className?: string;
}

export const SupportPartyScreen: React.FC<SupportPartyScreenProps> = ({
  initialState = 'populated',
  initialMembers = INITIAL_SUPPORT_MEMBERS,
  onMembersChange,
  className = '',
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default in isolation
  }
  const { isOwner, isFamily, canMutate } = roleContext;

  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [members, setMembers] = React.useState<SupportMember[]>(initialMembers);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>('all');

  // Modal
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<SupportMember | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const updateMembers = (newMembers: SupportMember[]) => {
    setMembers(newMembers);
    onMembersChange?.(newMembers);
  };

  const handleSaveMember = (formData: SupportMemberFormData) => {
    if (!canMutate) return;
    if (editingMember) {
      const next = members.map((m) =>
        m.id === editingMember.id
          ? {
              ...m,
              ...formData,
              version: (m.version || 1) + 1,
            }
          : m
      );
      updateMembers(next);
      showToast('Đã cập nhật thông tin thành viên');
    } else {
      const newMember: SupportMember = {
        id: `supp_${Date.now()}`,
        ...formData,
        version: 1,
        createdAt: new Date().toISOString(),
      };
      updateMembers([...members, newMember]);
      showToast('Đã thêm thành viên vào đội hỗ trợ');
    }
    setEditingMember(null);
  };

  const handleDeleteMember = (id: string) => {
    if (!canMutate) return;
    if (confirm('Bạn có chắc muốn xóa thành viên này khỏi đội hỗ trợ?')) {
      const next = members.filter((m) => m.id !== id);
      updateMembers(next);
      showToast('Đã xóa thành viên');
    }
  };

  // Filter members:
  // INVARIANT: Family role sees ONLY contacts with isShared === true
  const visibleMembers = members.filter((m) => {
    if (isFamily && !m.isShared) {
      return false;
    }
    if (roleFilter !== 'all' && !m.roles.includes(roleFilter as SupportRole)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name.toLowerCase().includes(q);
      const matchPhone = m.phone.includes(q);
      const matchDuties = (m.duties || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchDuties) return false;
    }
    return true;
  });

  return h(
    StateWrapper,
    {
      state,
      emptyDescription: 'Chưa có thành viên nào trong đội ngũ hỗ trợ.',
      onRetry: () => setState('populated'),
    },
    h(
      'div',
      { className: `space-y-6 ${className}` },
      // Toast message
      toastMessage &&
        h(
          'div',
          {
            className:
              'fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg bg-gray-900 text-white text-xs font-medium shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2',
          },
          h(CheckCircle2, { className: 'w-4 h-4 text-emerald-400' }),
          toastMessage
        ),
      // Invariant Information Banner (PLAN §14.2 & UI/UX SPEC §7.9)
      h(
        'div',
        {
          className:
            'p-4 bg-teal-50/70 border border-teal-200 rounded-xl flex items-start gap-3.5 text-xs text-teal-900 shadow-2xs',
        },
        h(ShieldCheck, { className: 'w-5 h-5 text-teal-600 shrink-0 mt-0.5' }),
        h(
          'div',
          { className: 'space-y-1' },
          h(
            'p',
            { className: 'font-semibold text-sm text-teal-950' },
            'Đội ngũ Hỗ trợ Ngày cưới (Wedding Party Directory)'
          ),
          h(
            'p',
            { className: 'text-teal-800 leading-relaxed' },
            'Danh bạ tổng hợp 9 vai trò then chốt trong ngày cưới. Hỗ trợ gọi điện và nhắn tin SMS 1-chạm tốc độ cao. Tuân thủ quy định bảo mật: Gán vai trò vận hành không gửi lời mời hay tạo tài khoản đăng nhập.'
          )
        )
      ),
      // Search, Role Filter & Add Button
      h(
        'div',
        {
          className:
            'flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-2xs',
        },
        // Search & Role select
        h(
          'div',
          { className: 'flex flex-wrap items-center gap-3 flex-1' },
          h(
            'div',
            { className: 'relative min-w-[200px] flex-1 max-w-xs' },
            h(Search, {
              className:
                'w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none',
            }),
            h('input', {
              type: 'text',
              value: searchQuery,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value),
              placeholder: 'Tìm theo tên, SĐT, nhiệm vụ...',
              className:
                'w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          ),
          h(
            'select',
            {
              value: roleFilter,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                setRoleFilter(e.target.value),
              className:
                'px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-700',
            },
            h('option', { value: 'all' }, 'Tất cả 9 vai trò'),
            Object.entries(ROLE_CONFIG).map(([roleKey, conf]) =>
              h('option', { key: roleKey, value: roleKey }, conf.label)
            )
          )
        ),
        // Add Button (owner only)
        canMutate &&
          h(
            'button',
            {
              type: 'button',
              onClick: () => {
                setEditingMember(null);
                setIsModalOpen(true);
              },
              className:
                'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition shadow-xs shrink-0 self-start sm:self-auto',
            },
            h(Plus, { className: 'w-4 h-4' }),
            'Thêm thành viên hỗ trợ'
          )
      ),
      // Directory Cards Grid: 1 col mobile, 2 col tablet, 3 col desktop
      visibleMembers.length === 0
        ? h(
            'div',
            {
              className:
                'p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300',
            },
            h(Users, { className: 'w-10 h-10 text-gray-400 mx-auto mb-2' }),
            h(
              'h3',
              { className: 'text-sm font-semibold text-gray-700' },
              'Không tìm thấy thành viên phù hợp'
            ),
            h(
              'p',
              { className: 'text-xs text-gray-500 mt-1' },
              'Thử thay đổi vai trò hoặc từ khóa tìm kiếm.'
            )
          )
        : h(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' },
            visibleMembers.map((member) =>
              h(SupportMemberCard, {
                key: member.id,
                member,
                onEdit: (m) => {
                  setEditingMember(m);
                  setIsModalOpen(true);
                },
                onDelete: handleDeleteMember,
              })
            )
          ),
      // Add/Edit Modal
      h(AddEditSupportMemberModal, {
        isOpen: isModalOpen,
        onClose: () => {
          setIsModalOpen(false);
          setEditingMember(null);
        },
        onSubmit: handleSaveMember,
        initialData: editingMember,
      })
    )
  );
};
