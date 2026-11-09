'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  X,
  User,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Tag,
  Utensils,
  GitMerge,
  Edit,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  Shield,
  EyeOff,
  Armchair,
  MailCheck,
} from 'lucide-react';

const h = React.createElement;

export interface GuestDetailAttendance {
  eventId: string;
  eventName: string;
  eventDate?: string;
  rsvpStatus: 'not_contacted' | 'pending_reply' | 'tentative' | 'accepted' | 'declined';
  needsSeat: boolean;
  needsMeal: boolean;
  mealDietaryTier?: 'regular' | 'vegetarian' | 'child_portion' | 'special';
  dietaryNotes?: string | null;
  tableName?: string | null;
  invitationCardName?: string | null;
  invitationStatus?: 'save_the_date' | 'preparing' | 'sent';
  nextFollowupDate?: string | null;
}

export interface GuestDetailData {
  id: string;
  displayName: string;
  side: 'groom' | 'bride' | 'mutual' | 'unassigned';
  groupName?: string | null;
  groupId?: string | null;
  subTags?: string[];
  ageTier: 'adult' | 'child' | 'baby';
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  privateNotes?: string | null;
  isPlaceholder?: boolean;
  placeholderFor?: string | null;
  version?: number;
  attendances?: GuestDetailAttendance[];
}

export interface GuestDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  guest: GuestDetailData | null;
  roleOverride?: 'owner' | 'family_view';
  initialTab?: 'info' | 'events' | 'contact';
  onEdit?: (guest: GuestDetailData) => void;
  onUpdateRsvp?: (guest: GuestDetailData, eventId?: string) => void;
  onTriggerMerge?: (guest: GuestDetailData) => void;
}

const SIDE_LABELS: Record<string, string> = {
  groom: 'Nhà trai',
  bride: 'Nhà gái',
  mutual: 'Bạn chung',
  unassigned: 'Chưa phân bên',
};

const AGE_LABELS: Record<string, string> = {
  adult: 'Người lớn',
  child: 'Trẻ em',
  baby: 'Em bé',
};

const RSVP_META: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral'; icon: any }
> = {
  accepted: { label: 'Đồng ý tham dự', variant: 'success', icon: CheckCircle2 },
  pending_reply: { label: 'Chờ phản hồi', variant: 'warning', icon: Clock },
  tentative: { label: 'Có thể', variant: 'warning', icon: HelpCircle },
  declined: { label: 'Từ chối', variant: 'danger', icon: XCircle },
  not_contacted: { label: 'Chưa liên hệ', variant: 'neutral', icon: HelpCircle },
};

const MEAL_LABELS: Record<string, string> = {
  regular: 'Suất tiêu chuẩn',
  vegetarian: 'Ăn chay',
  child_portion: 'Suất trẻ em',
  special: 'Chế độ ăn riêng',
};

export const GuestDetailDrawer: React.FC<GuestDetailDrawerProps> = ({
  isOpen,
  onClose,
  guest,
  roleOverride,
  initialTab = 'info',
  onEdit,
  onUpdateRsvp,
  onTriggerMerge,
}) => {
  const roleContext = useRole();
  const effectiveRole = roleOverride || (roleContext.isOwner ? 'owner' : 'family_view');
  const isOwner = effectiveRole === 'owner';

  const [activeTab, setActiveTab] = React.useState<'info' | 'events' | 'contact'>(initialTab);

  React.useEffect(() => {
    // If family_view, switch away from contact tab
    if (!isOwner && activeTab === 'contact') {
      setActiveTab('info');
    }
  }, [isOwner, activeTab]);

  if (!isOpen || !guest) return null;

  const tabs = [
    { key: 'info', label: 'Thông tin' },
    { key: 'events', label: 'Theo từng buổi' },
    ...(isOwner ? [{ key: 'contact', label: 'Liên hệ' }] : []),
  ];

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'guest-detail-title',
    },
    h(
      'div',
      {
        className:
          'bg-surface w-full max-w-xl h-full flex flex-col shadow-2xl border-l border-border-control animate-in slide-in-from-right duration-200',
      },
      // Header
      h(
        'div',
        { className: 'p-6 border-b border-border-subtle bg-surface-card flex items-start justify-between' },
        h(
          'div',
          { className: 'space-y-2 pr-4' },
          h(
            'div',
            { className: 'flex items-center gap-2 flex-wrap' },
            h(
              'h2',
              { id: 'guest-detail-title', className: 'text-2xl font-bold text-text-main' },
              guest.displayName
            ),
            guest.isPlaceholder &&
              h(
                'span',
                {
                  className:
                    'px-2 py-0.5 rounded text-xs font-medium bg-surface border border-border-control text-text-muted',
                },
                'Người đi cùng (+1)'
              )
          ),
          h(
            'div',
            { className: 'flex items-center gap-2 flex-wrap text-sm' },
            h(
              'span',
              { className: 'px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary' },
              SIDE_LABELS[guest.side] || guest.side
            ),
            h(
              'span',
              {
                className:
                  'px-2 py-0.5 rounded-full text-xs font-medium bg-border-subtle/60 text-text-muted',
              },
              AGE_LABELS[guest.ageTier] || guest.ageTier
            ),
            guest.groupName &&
              h(
                'span',
                { className: 'text-text-muted text-xs' },
                `Thuộc nhóm: ${guest.groupName}`
              )
          )
        ),
        h(
          'button',
          {
            onClick: onClose,
            'aria-label': 'Đóng hồ sơ',
            className:
              'p-2 rounded-control text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
          },
          h(X, { className: 'w-5 h-5' })
        )
      ),

      // Tab bar
      h(
        'div',
        { className: 'flex border-b border-border-subtle px-6 bg-surface' },
        tabs.map((tab) =>
          h(
            'button',
            {
              key: tab.key,
              type: 'button',
              onClick: () => setActiveTab(tab.key as any),
              className: `py-3 px-4 text-sm font-medium border-b-2 transition-colors min-h-[44px] ${
                activeTab === tab.key
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-text-muted hover:text-text-main'
              }`,
            },
            tab.label
          )
        )
      ),

      // Tab contents
      h(
        'div',
        { className: 'flex-1 overflow-y-auto p-6 space-y-6' },

        // TAB 1: THÔNG TIN (Info)
        activeTab === 'info' &&
          h(
            'div',
            { className: 'space-y-5 text-sm' },
            // Placeholder detail if any
            guest.isPlaceholder &&
              h(
                'div',
                { className: 'p-3 bg-surface-hover rounded-card border border-border-subtle' },
                h('div', { className: 'text-xs text-text-muted font-medium' }, 'Đi cùng với'),
                h(
                  'div',
                  { className: 'font-semibold text-text-main mt-0.5' },
                  guest.placeholderFor || 'Chưa chỉ định'
                )
              ),

            // Main details grid
            h(
              'div',
              { className: 'grid grid-cols-2 gap-4' },
              h(
                'div',
                { className: 'p-3 bg-surface-card rounded-control border border-border-subtle' },
                h('div', { className: 'text-xs text-text-muted' }, 'Bên mời'),
                h('div', { className: 'font-medium text-text-main mt-0.5' }, SIDE_LABELS[guest.side])
              ),
              h(
                'div',
                { className: 'p-3 bg-surface-card rounded-control border border-border-subtle' },
                h('div', { className: 'text-xs text-text-muted' }, 'Độ tuổi'),
                h('div', { className: 'font-medium text-text-main mt-0.5' }, AGE_LABELS[guest.ageTier])
              ),
              h(
                'div',
                { className: 'p-3 bg-surface-card rounded-control border border-border-subtle col-span-2' },
                h('div', { className: 'text-xs text-text-muted' }, 'Nhóm gia đình / quan hệ'),
                h(
                  'div',
                  { className: 'font-medium text-text-main mt-0.5' },
                  guest.groupName || 'Chưa gán nhóm'
                )
              )
            ),

            // Sub tags
            h(
              'div',
              { className: 'space-y-1.5' },
              h('div', { className: 'text-xs text-text-muted font-medium' }, 'Thẻ phân loại phụ'),
              guest.subTags && guest.subTags.length > 0
                ? h(
                    'div',
                    { className: 'flex flex-wrap gap-1.5' },
                    guest.subTags.map((tag) =>
                      h(
                        'span',
                        {
                          key: tag,
                          className:
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-border-subtle/50 text-text-main',
                        },
                        h(Tag, { className: 'w-3 h-3 text-text-muted' }),
                        tag
                      )
                    )
                  )
                : h('p', { className: 'text-xs text-text-muted italic' }, 'Không có thẻ phụ nào')
            ),

            // Private notes (Strict role check: OWNER ONLY)
            isOwner
              ? h(
                  'div',
                  { className: 'p-4 bg-[#FFFDF5] rounded-card border border-[#E9DFB8] space-y-1.5' },
                  h(
                    'div',
                    { className: 'flex items-center gap-1.5 text-xs font-bold text-[#854D0E]' },
                    h(Shield, { className: 'w-4 h-4' }),
                    'Ghi chú riêng tư (Chỉ chủ sở hữu thấy)'
                  ),
                  h(
                    'p',
                    { className: 'text-sm text-text-main whitespace-pre-wrap' },
                    guest.privateNotes || 'Chưa có ghi chú riêng tư nào.'
                  )
                )
              : h(
                  'div',
                  {
                    className:
                      'p-3 bg-surface-card rounded-card border border-border-subtle flex items-center gap-2 text-xs text-text-muted',
                  },
                  h(EyeOff, { className: 'w-4 h-4' }),
                  'Ghi chú riêng tư và liên hệ được bảo mật theo chính sách Người nhà.'
                )
          ),

        // TAB 2: THEO TỪNG BUỔI (Per-event attendance)
        activeTab === 'events' &&
          h(
            'div',
            { className: 'space-y-4' },
            !guest.attendances || guest.attendances.length === 0
              ? h(
                  'div',
                  { className: 'text-center py-8 text-text-muted text-sm space-y-1' },
                  h(Calendar, { className: 'w-8 h-8 mx-auto text-border-control stroke-[1.5]' }),
                  h('p', null, 'Khách mời chưa được mời tham gia buổi nào.')
                )
              : guest.attendances.map((att) => {
                  const meta = RSVP_META[att.rsvpStatus] || RSVP_META.not_contacted;
                  const Icon = meta.icon;
                  return h(
                    'div',
                    {
                      key: att.eventId,
                      className:
                        'p-4 bg-surface-card rounded-card border border-border-subtle space-y-3',
                    },
                    // Event title & status badge
                    h(
                      'div',
                      { className: 'flex items-center justify-between gap-2 flex-wrap' },
                      h(
                        'div',
                        null,
                        h('h4', { className: 'font-bold text-text-main text-base' }, att.eventName),
                        att.eventDate &&
                          h('p', { className: 'text-xs text-text-muted mt-0.5' }, att.eventDate)
                      ),
                      h(
                        'span',
                        {
                          className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            meta.variant === 'success'
                              ? 'bg-success/15 text-success'
                              : meta.variant === 'danger'
                              ? 'bg-danger/15 text-danger'
                              : meta.variant === 'warning'
                              ? 'bg-warning/15 text-[#854D0E]'
                              : 'bg-border-subtle text-text-muted'
                          }`,
                        },
                        h(Icon, { className: 'w-3.5 h-3.5' }),
                        meta.label
                      )
                    ),

                    // Capacity & Requirements
                    h(
                      'div',
                      { className: 'grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border-subtle' },
                      h(
                        'div',
                        { className: 'flex items-center gap-1.5 text-text-main' },
                        h(Armchair, { className: 'w-4 h-4 text-text-muted' }),
                        att.needsSeat ? 'Cần ghế ngồi riêng' : 'Không chiếm ghế'
                      ),
                      h(
                        'div',
                        { className: 'flex items-center gap-1.5 text-text-main' },
                        h(Utensils, { className: 'w-4 h-4 text-text-muted' }),
                        att.needsMeal
                          ? MEAL_LABELS[att.mealDietaryTier || 'regular']
                          : 'Không cần suất ăn'
                      ),
                      h(
                        'div',
                        { className: 'flex items-center gap-1.5 text-text-main' },
                        h(MailCheck, { className: 'w-4 h-4 text-text-muted' }),
                        att.invitationCardName
                          ? `Thiệp: ${att.invitationCardName}`
                          : 'Chưa có nhóm thiệp'
                      ),
                      h(
                        'div',
                        { className: 'flex items-center gap-1.5 text-text-main font-medium' },
                        'Bàn:',
                        att.tableName
                          ? h('span', { className: 'text-primary font-bold' }, att.tableName)
                          : h('span', { className: 'text-text-muted italic' }, 'Chưa xếp')
                      )
                    ),

                    // Quick RSVP trigger for owner
                    isOwner &&
                      onUpdateRsvp &&
                      h(
                        'div',
                        { className: 'pt-2 flex justify-end' },
                        h(
                          Button,
                          {
                            size: 'sm',
                            variant: 'secondary',
                            onClick: () => onUpdateRsvp(guest, att.eventId),
                          },
                          'Cập nhật phản hồi'
                        )
                      )
                  );
                })
          ),

        // TAB 3: LIÊN HỆ (Contact - OWNER ONLY)
        activeTab === 'contact' &&
          isOwner &&
          h(
            'div',
            { className: 'space-y-4 text-sm' },
            h(
              'div',
              { className: 'p-4 bg-surface-card rounded-card border border-border-subtle space-y-3' },
              h(
                'div',
                { className: 'flex items-center gap-3' },
                h(Phone, { className: 'w-4 h-4 text-primary shrink-0' }),
                h(
                  'div',
                  null,
                  h('div', { className: 'text-xs text-text-muted' }, 'Số điện thoại'),
                  h(
                    'div',
                    { className: 'font-semibold text-text-main' },
                    guest.phone || 'Chưa cung cấp'
                  )
                )
              ),
              h(
                'div',
                { className: 'flex items-center gap-3 pt-3 border-t border-border-subtle' },
                h(Mail, { className: 'w-4 h-4 text-primary shrink-0' }),
                h(
                  'div',
                  null,
                  h('div', { className: 'text-xs text-text-muted' }, 'Email'),
                  h(
                    'div',
                    { className: 'font-semibold text-text-main' },
                    guest.email || 'Chưa cung cấp'
                  )
                )
              ),
              h(
                'div',
                { className: 'flex items-center gap-3 pt-3 border-t border-border-subtle' },
                h(MapPin, { className: 'w-4 h-4 text-primary shrink-0' }),
                h(
                  'div',
                  null,
                  h('div', { className: 'text-xs text-text-muted' }, 'Địa chỉ gửi thiệp'),
                  h(
                    'div',
                    { className: 'font-semibold text-text-main' },
                    guest.address || 'Chưa cung cấp'
                  )
                )
              )
            )
          )
      ),

      // Footer / Action Bar
      h(
        'div',
        {
          className:
            'p-4 bg-surface-card border-t border-border-subtle flex items-center justify-between gap-3',
        },
        isOwner
          ? h(
              React.Fragment,
              null,
              h(
                'div',
                { className: 'flex items-center gap-2' },
                onTriggerMerge &&
                  h(
                    Button,
                    {
                      size: 'sm',
                      variant: 'secondary',
                      leftIcon: h(GitMerge, { className: 'w-4 h-4' }),
                      onClick: () => onTriggerMerge(guest),
                    },
                    'Gộp trùng'
                  ),
                onEdit &&
                  h(
                    Button,
                    {
                      size: 'sm',
                      variant: 'secondary',
                      leftIcon: h(Edit, { className: 'w-4 h-4' }),
                      onClick: () => onEdit(guest),
                    },
                    'Chỉnh sửa'
                  )
              ),
              onUpdateRsvp &&
                h(
                  Button,
                  {
                    size: 'sm',
                    variant: 'primary',
                    onClick: () => onUpdateRsvp(guest),
                  },
                  'Cập nhật RSVP'
                )
            )
          : h(
              'div',
              {
                className:
                  'w-full flex items-center justify-center gap-2 text-xs text-text-muted py-2 bg-surface rounded-control border border-border-subtle',
              },
              h(Shield, { className: 'w-4 h-4 text-text-muted' }),
              'Chế độ Người nhà: Hồ sơ khách ở trạng thái chỉ đọc'
            )
      )
    )
  );
};
