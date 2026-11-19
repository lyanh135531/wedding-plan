'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useRole } from '@/context/RoleContext';
import {
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Archive,
  Download,
  ExternalLink,
  ShieldAlert,
  FileCheck,
  Video,
  Image as ImageIcon,
  DollarSign,
  Gift,
} from 'lucide-react';

const h = React.createElement;

export interface ChecklistItem {
  key: string;
  title: string;
  isCompleted: boolean;
  summary: string;
  pendingCount: number;
  totalCount: number;
}

export interface ArchivalData {
  isArchived: boolean;
  archivedAt: string | null;
  archivedReason: string | null;
  reopenedAt: string | null;
  items: ChecklistItem[];
  allCompleted: boolean;
}

export interface MediaLink {
  title: string;
  url: string;
  mediaType: string;
}

export const ArchivalDashboard: React.FC = () => {
  const { isOwner } = useRole();
  const [data, setData] = React.useState<ArchivalData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [mediaLinks, setMediaLinks] = React.useState<MediaLink[]>([
    {
      title: 'Album ảnh phóng sự cưới full HD (Google Drive)',
      url: 'https://drive.google.com/drive/folders/sample-wedding-album',
      mediaType: 'photo_album',
    },
    {
      title: 'Video Highlight 4K chính thức (YouTube Unlisted)',
      url: 'https://www.youtube.com/watch?v=sample-highlight-video',
      mediaType: 'video_highlight',
    },
  ]);

  // Modals state
  const [isFreezeModalOpen, setIsFreezeModalOpen] = React.useState(false);
  const [freezeReason, setFreezeReason] = React.useState('');
  const [isUnarchiveModalOpen, setIsUnarchiveModalOpen] = React.useState(false);
  const [unarchiveReason, setUnarchiveReason] = React.useState('');
  const [isMediaModalOpen, setIsMediaModalOpen] = React.useState(false);
  const [newMediaTitle, setNewMediaTitle] = React.useState('');
  const [newMediaUrl, setNewMediaUrl] = React.useState('');
  const [newMediaType, setNewMediaType] = React.useState('photo_album');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const fetchChecklist = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/archival/checklist');
      if (res.ok) {
        const json = await res.json();
        setData(json.data || null);
      }
    } catch (err) {
      console.error('Lỗi tải checklist hậu cưới:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  // Handle freeze
  const handleFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/archival/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archiveReason: freezeReason.trim(),
          confirmed: true,
        }),
      });

      if (res.ok) {
        setIsFreezeModalOpen(false);
        setFreezeReason('');
        setSuccessMsg('Đám cưới đã được khóa chuyển sang chế độ lưu trữ (chỉ đọc).');
        fetchChecklist();
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.message || 'Lỗi khóa lưu trữ');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    }
  };

  // Handle unarchive
  const handleUnarchive = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/archival/unarchive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unarchiveReason: unarchiveReason.trim(),
        }),
      });

      if (res.ok) {
        setIsUnarchiveModalOpen(false);
        setUnarchiveReason('');
        setSuccessMsg('Đám cưới đã được mở lại thành công. Thao tác đã được ghi nhận kiểm toán.');
        fetchChecklist();
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.message || 'Lỗi mở lại đám cưới');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    }
  };

  // Add media link
  const handleAddMedia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMediaTitle.trim() || !newMediaUrl.trim()) return;

    // SSRF Guard
    try {
      const parsed = new URL(newMediaUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setErrorMsg('Đường dẫn phải bắt đầu bằng http:// hoặc https://');
        return;
      }
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.startsWith('192.168.') || host.startsWith('10.')) {
        setErrorMsg('Không được liên kết đến địa chỉ mạng nội bộ.');
        return;
      }
    } catch {
      setErrorMsg('Định dạng URL không hợp lệ.');
      return;
    }

    setMediaLinks([...mediaLinks, { title: newMediaTitle.trim(), url: newMediaUrl.trim(), mediaType: newMediaType }]);
    setIsMediaModalOpen(false);
    setNewMediaTitle('');
    setNewMediaUrl('');
  };

  return h(
    'div',
    { className: 'space-y-6 max-w-7xl mx-auto p-4 sm:p-6' },
    // Archived persistent read-only banner (AT35, FL20)
    data?.isArchived &&
      h(
        'div',
        { className: 'p-4 bg-slate-900 text-white rounded-card shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2 border-slate-700' },
        h(
          'div',
          { className: 'flex items-center gap-3' },
          h(Lock, { className: 'w-6 h-6 text-amber-400 shrink-0' }),
          h(
            'div',
            null,
            h('p', { className: 'font-bold text-base text-white' }, 'ĐÁM CƯỚI ĐÃ ĐƯỢC LƯU TRỮ (CHẾ ĐỘ CHỈ ĐỌC)'),
            h(
              'p',
              { className: 'text-xs text-slate-300 mt-0.5' },
              `Lưu trữ ngày: ${data.archivedAt ? new Date(data.archivedAt).toLocaleString('vi-VN') : 'Không rõ'} • Lý do: ${data.archivedReason || 'Đã hoàn tất sau cưới'}`
            )
          )
        ),
        isOwner &&
          h(
            Button,
            {
              variant: 'secondary',
              size: 'sm',
              leftIcon: h(Unlock, { className: 'w-4 h-4' }),
              onClick: () => setIsUnarchiveModalOpen(true),
              className: 'bg-surface text-slate-900 hover:bg-slate-100',
            },
            'Mở lại đám cưới (Unarchive)'
          )
      ),

    // Header
    h(
      'div',
      { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-4' },
      h(
        'div',
        null,
        h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Hậu Cưới & Khóa Lưu Trữ (Post-Wedding & Archival)'),
        h('p', { className: 'text-sm text-text-muted mt-0.5' }, '7 đầu việc quyết toán sau cưới, lưu trữ kho media và đóng gói hồ sơ lạnh')
      ),
      isOwner &&
        !data?.isArchived &&
        h(
          'div',
          { className: 'flex items-center gap-3' },
          h(
            Button,
            {
              variant: 'primary',
              leftIcon: h(Archive, { className: 'w-4 h-4' }),
              onClick: () => setIsFreezeModalOpen(true),
            },
            'Khóa chuyển lưu trữ'
          )
        )
    ),

    // Notifications
    errorMsg &&
      h(
        'div',
        { className: 'p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-control flex items-center justify-between' },
        h('span', null, errorMsg),
        h('button', { type: 'button', onClick: () => setErrorMsg(null), className: 'font-bold' }, '✕')
      ),
    successMsg &&
      h(
        'div',
        { className: 'p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-control flex items-center justify-between' },
        h('span', null, successMsg),
        h('button', { type: 'button', onClick: () => setSuccessMsg(null), className: 'font-bold' }, '✕')
      ),

    // 7 Obligations Checklist Grid
    h(
      'div',
      { className: 'space-y-4' },
      h(
        'div',
        { className: 'flex items-center justify-between' },
        h('h2', { className: 'text-base font-bold text-text-main' }, '7 Đầu Việc Quyết Toán Sau Cưới (Dữ liệu thực tế)'),
        h(
          'span',
          { className: 'text-xs font-semibold text-text-muted' },
          data?.items ? `Đã hoàn thành: ${data.items.filter((i) => i.isCompleted).length}/7` : ''
        )
      ),
      h(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-3.5' },
        data?.items.map((item, idx) =>
          h(
            'div',
            {
              key: item.key,
              className: `p-4 rounded-card border transition-all ${
                item.isCompleted
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : 'bg-surface border-border-subtle shadow-sm'
              }`,
            },
            h(
              'div',
              { className: 'flex items-start justify-between gap-3' },
              h(
                'div',
                { className: 'flex items-start gap-3 min-w-0' },
                h(
                  'div',
                  { className: 'mt-0.5 shrink-0' },
                  item.isCompleted
                    ? h(CheckCircle2, { className: 'w-5 h-5 text-emerald-600' })
                    : h(Clock, { className: 'w-5 h-5 text-amber-500' })
                ),
                h(
                  'div',
                  null,
                  h('p', { className: 'font-bold text-sm text-text-main' }, `${idx + 1}. ${item.title}`),
                  h('p', { className: 'text-xs text-text-muted mt-1 leading-relaxed' }, item.summary)
                )
              ),
              h(
                'span',
                {
                  className: `text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${
                    item.isCompleted
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`,
                },
                item.isCompleted ? 'Đã xong' : 'Còn tồn'
              )
            )
          )
        )
      )
    ),

    // Media Archival Vault Links Registry
    h(
      'div',
      { className: 'bg-surface border border-border-subtle rounded-card shadow-sm p-6 space-y-4' },
      h(
        'div',
        { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-subtle pb-3' },
        h(
          'div',
          null,
          h('h2', { className: 'text-base font-bold text-text-main' }, 'Kho Lưu Trữ Hình Ảnh & Video Gốc (Media Vault)'),
          h('p', { className: 'text-xs text-text-muted' }, 'Đường dẫn điện toán đám mây lưu trữ ảnh phóng sự cưới, video 4K chất lượng cao')
        ),
        isOwner &&
          !data?.isArchived &&
          h(
            Button,
            {
              variant: 'secondary',
              size: 'sm',
              leftIcon: h(ExternalLink, { className: 'w-3.5 h-3.5' }),
              onClick: () => setIsMediaModalOpen(true),
            },
            '+ Thêm liên kết media'
          )
      ),
      h(
        'div',
        { className: 'divide-y divide-border-subtle' },
        mediaLinks.map((m, idx) =>
          h(
            'div',
            { key: idx, className: 'py-3 flex items-center justify-between gap-4 text-xs' },
            h(
              'div',
              { className: 'flex items-center gap-3 min-w-0' },
              m.mediaType === 'video_highlight'
                ? h(Video, { className: 'w-4 h-4 text-red-500 shrink-0' })
                : h(ImageIcon, { className: 'w-4 h-4 text-blue-500 shrink-0' }),
              h(
                'div',
                { className: 'min-w-0' },
                h('p', { className: 'font-semibold text-text-main truncate' }, m.title),
                h('p', { className: 'text-text-muted truncate mt-0.5' }, m.url)
              )
            ),
            h(
              'a',
              {
                href: m.url,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'inline-flex items-center gap-1 font-bold text-primary hover:underline shrink-0',
              },
              'Mở liên kết',
              h(ExternalLink, { className: 'w-3.5 h-3.5' })
            )
          )
        )
      )
    ),

    // Modal: Freeze Archive
    isFreezeModalOpen &&
      h(
        'div',
        { className: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm' },
        h(
          'form',
          {
            onSubmit: handleFreeze,
            className: 'bg-surface w-full max-w-md rounded-card border border-border-control p-6 space-y-4',
          },
          h(
            'div',
            { className: 'flex items-center gap-2 text-amber-600' },
            h(AlertTriangle, { className: 'w-5 h-5' }),
            h('h3', { className: 'text-base font-bold text-text-main' }, 'Khóa Chuyển Sang Lưu Trữ')
          ),
          h(
            'p',
            { className: 'text-xs text-text-muted leading-relaxed' },
            'Khi khóa lưu trữ, toàn bộ dự án đám cưới sẽ chuyển sang trạng thái CHỈ ĐỌC (Read-only). Mọi thao tác thêm/sửa/xóa trên toàn hệ thống sẽ bị chặn để bảo vệ dữ liệu lịch sử.'
          ),
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Lý do khóa lưu trữ *'),
              h('textarea', {
                rows: 3,
                required: true,
                value: freezeReason,
                onChange: (e: any) => setFreezeReason(e.target.value),
                placeholder: 'Ví dụ: Đám cưới đã kết thúc tốt đẹp, đã quyết toán toàn bộ công nợ và sổ quà...',
                className: 'w-full mt-1 p-2 border border-border-control rounded',
              })
            )
          ),
          h(
            'div',
            { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsFreezeModalOpen(false) }, 'Hủy'),
            h(Button, { variant: 'primary', type: 'submit' }, 'Xác nhận khóa lưu trữ')
          )
        )
      ),

    // Modal: Unarchive
    isUnarchiveModalOpen &&
      h(
        'div',
        { className: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm' },
        h(
          'form',
          {
            onSubmit: handleUnarchive,
            className: 'bg-surface w-full max-w-md rounded-card border border-border-control p-6 space-y-4',
          },
          h(
            'div',
            { className: 'flex items-center gap-2 text-primary' },
            h(Unlock, { className: 'w-5 h-5' }),
            h('h3', { className: 'text-base font-bold text-text-main' }, 'Mở Lại Đám Cưới Đã Lưu Trữ')
          ),
          h(
            'p',
            { className: 'text-xs text-text-muted leading-relaxed' },
            'Hành động này sẽ mở lại quyền chỉnh sửa và bắt buộc ghi nhận lý do vào nhật ký kiểm toán (Audit Trail) để đảm bảo tính minh bạch.'
          ),
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Lý do mở lại đám cưới *'),
              h('textarea', {
                rows: 3,
                required: true,
                value: unarchiveReason,
                onChange: (e: any) => setUnarchiveReason(e.target.value),
                placeholder: 'Ví dụ: Cần cập nhật bổ sung hóa đơn phát sinh muộn từ nhà xe...',
                className: 'w-full mt-1 p-2 border border-border-control rounded',
              })
            )
          ),
          h(
            'div',
            { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsUnarchiveModalOpen(false) }, 'Hủy'),
            h(Button, { variant: 'primary', type: 'submit' }, 'Xác nhận mở lại')
          )
        )
      ),

    // Modal: Add Media
    isMediaModalOpen &&
      h(
        'div',
        { className: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm' },
        h(
          'form',
          {
            onSubmit: handleAddMedia,
            className: 'bg-surface w-full max-w-sm rounded-card border border-border-control p-6 space-y-4',
          },
          h('h3', { className: 'text-base font-bold text-text-main' }, 'Thêm Liên Kết Media Lưu Trữ'),
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Tiêu đề album / video *'),
              h('input', {
                type: 'text',
                required: true,
                value: newMediaTitle,
                onChange: (e: any) => setNewMediaTitle(e.target.value),
                placeholder: 'Ví dụ: Album phóng sự Nhà Gái...',
                className: 'w-full mt-1 p-2 border border-border-control rounded',
              })
            ),
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Đường dẫn (URL) *'),
              h('input', {
                type: 'url',
                required: true,
                value: newMediaUrl,
                onChange: (e: any) => setNewMediaUrl(e.target.value),
                placeholder: 'https://drive.google.com/...',
                className: 'w-full mt-1 p-2 border border-border-control rounded',
              })
            ),
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Loại tư liệu'),
              h(
                'select',
                {
                  value: newMediaType,
                  onChange: (e: any) => setNewMediaType(e.target.value),
                  className: 'w-full mt-1 p-2 border border-border-control rounded',
                },
                h('option', { value: 'photo_album' }, 'Album ảnh'),
                h('option', { value: 'video_highlight' }, 'Video Highlight'),
                h('option', { value: 'raw_footage' }, 'Video thô / Footage'),
                h('option', { value: 'other' }, 'Tư liệu khác')
              )
            )
          ),
          h(
            'div',
            { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsMediaModalOpen(false) }, 'Đóng'),
            h(Button, { variant: 'primary', type: 'submit' }, 'Lưu liên kết')
          )
        )
      )
  );
};
