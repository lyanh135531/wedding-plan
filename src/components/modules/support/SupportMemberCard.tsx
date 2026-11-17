'use client';

import * as React from 'react';
import { SupportMember, SupportRole } from './types';
import { useRole } from '@/context/RoleContext';
import {
  Phone,
  MessageSquare,
  Clock,
  ShieldAlert,
  UserCheck,
  Shirt,
  Briefcase,
  Edit2,
  Trash2,
  PhoneCall,
  Lock,
} from 'lucide-react';

const h = React.createElement;

export interface SupportMemberCardProps {
  member: SupportMember;
  onEdit?: (member: SupportMember) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export const ROLE_CONFIG: Record<
  SupportRole,
  { label: string; badgeClass: string }
> = {
  co_dau: { label: 'Cô dâu', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  chu_re: { label: 'Chú rể', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  phu_dau: { label: 'Phù dâu', badgeClass: 'bg-pink-50 text-pink-700 border-pink-200' },
  phu_re: { label: 'Phù rể', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  mc: { label: 'MC dẫn chương trình', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' },
  dieu_phoi: { label: 'Điều phối sảnh', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  nguoi_than: { label: 'Người thân đại diện', badgeClass: 'bg-teal-50 text-teal-800 border-teal-200' },
  nha_cung_cap: { label: 'Nhà cung cấp', badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
  khac: { label: 'Khác', badgeClass: 'bg-gray-100 text-gray-700 border-gray-200' },
};

export const SupportMemberCard: React.FC<SupportMemberCardProps> = ({
  member,
  onEdit,
  onDelete,
  className = '',
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default in isolation
  }
  const { canMutate } = roleContext;

  return h(
    'div',
    {
      className: `bg-white rounded-xl border border-gray-200 p-5 shadow-2xs hover:shadow-xs transition space-y-4 flex flex-col justify-between ${className}`,
      'data-testid': `support-member-card-${member.id}`,
    },
    // Top: Name, Roles & Badges
    h(
      'div',
      { className: 'space-y-2' },
      h(
        'div',
        { className: 'flex items-start justify-between gap-2' },
        h(
          'div',
          { className: 'space-y-1' },
          h('h3', { className: 'font-bold text-base text-gray-900 leading-tight' }, member.name),
          // 9 semantic roles badges
          h(
            'div',
            { className: 'flex flex-wrap items-center gap-1.5' },
            member.roles.map((r) => {
              const conf = ROLE_CONFIG[r] || { label: r, badgeClass: 'bg-gray-100 text-gray-700' };
              return h(
                'span',
                {
                  key: r,
                  className: `px-2 py-0.5 rounded text-xs font-semibold border ${conf.badgeClass}`,
                },
                conf.label
              );
            })
          )
        ),
        // Invariant badge: No user account created
        h(
          'div',
          {
            className:
              'flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded shrink-0',
            title: 'Quy tắc: Thành viên đội hỗ trợ không cấp tài khoản đăng nhập hoặc quyền chỉnh sửa',
          },
          h(Lock, { className: 'w-3 h-3 text-gray-400' }),
          'Không cấp tài khoản'
        )
      ),
      // 1-Tap Quick Actions: Call & SMS
      h(
        'div',
        { className: 'pt-2 flex items-center gap-2' },
        h(
          'a',
          {
            href: `tel:${member.phone}`,
            className:
              'flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition shadow-2xs',
          },
          h(Phone, { className: 'w-3.5 h-3.5 text-emerald-600' }),
          member.phone
        ),
        h(
          'a',
          {
            href: `sms:${member.phone}`,
            className:
              'inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-semibold transition shadow-2xs',
            title: 'Gửi tin nhắn SMS',
          },
          h(MessageSquare, { className: 'w-3.5 h-3.5 text-blue-600' }),
          'SMS'
        )
      )
    ),
    // Details block: Arrival Time, Backup, Attire, Duties
    h(
      'div',
      { className: 'space-y-2 text-xs text-gray-600 pt-2 border-t border-gray-100' },
      member.arrivalTime &&
        h(
          'div',
          { className: 'flex items-center gap-2 text-gray-700' },
          h(Clock, { className: 'w-3.5 h-3.5 text-amber-600 shrink-0' }),
          h('span', { className: 'font-semibold' }, 'Giờ có mặt:'),
          h('span', { className: 'font-medium text-amber-800' }, member.arrivalTime)
        ),
      (member.backupName || member.backupPhone) &&
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(UserCheck, { className: 'w-3.5 h-3.5 text-indigo-500 shrink-0' }),
          h('span', { className: 'font-semibold text-gray-700' }, 'Dự phòng:'),
          h('span', {}, member.backupName || 'Chưa rõ'),
          member.backupPhone &&
            h(
              'a',
              {
                href: `tel:${member.backupPhone}`,
                className: 'text-blue-600 hover:underline font-mono text-[11px]',
              },
              `(${member.backupPhone})`
            )
        ),
      member.attireNotes &&
        h(
          'div',
          { className: 'flex items-start gap-2' },
          h(Shirt, { className: 'w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5' }),
          h(
            'div',
            {},
            h('span', { className: 'font-semibold text-gray-700' }, 'Trang phục: '),
            h('span', { className: 'text-gray-600' }, member.attireNotes)
          )
        ),
      member.duties &&
        h(
          'div',
          { className: 'flex items-start gap-2 bg-gray-50/80 p-2.5 rounded-lg border border-gray-100' },
          h(Briefcase, { className: 'w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5' }),
          h(
            'div',
            { className: 'space-y-0.5' },
            h('span', { className: 'font-semibold text-gray-800 block' }, 'Nhiệm vụ & Đầu việc:'),
            h('p', { className: 'text-gray-600 leading-relaxed' }, member.duties)
          )
        )
    ),
    // Bottom: Sharing status & Edit / Delete actions
    h(
      'div',
      {
        className:
          'pt-3 border-t border-gray-100 flex items-center justify-between text-xs',
      },
      h(
        'span',
        {
          className: `text-[11px] font-medium ${
            member.isShared ? 'text-emerald-700' : 'text-gray-400 italic'
          }`,
        },
        member.isShared ? 'Đã chia sẻ cho người nhà xem' : 'Chỉ lưu nội bộ chủ sở hữu'
      ),
      canMutate
        ? h(
            'div',
            { className: 'flex items-center gap-1.5' },
            onEdit &&
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => onEdit(member),
                  className: 'p-1.5 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 transition',
                  title: 'Chỉnh sửa thông tin',
                },
                h(Edit2, { className: 'w-3.5 h-3.5' })
              ),
            onDelete &&
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => onDelete(member.id),
                  className: 'p-1.5 text-red-500 hover:text-red-700 rounded-md hover:bg-red-50 transition',
                  title: 'Xóa thành viên',
                },
                h(Trash2, { className: 'w-3.5 h-3.5' })
              )
          )
        : h('span', { className: 'text-[11px] text-gray-400 italic' }, 'Chỉ xem')
    )
  );
};
