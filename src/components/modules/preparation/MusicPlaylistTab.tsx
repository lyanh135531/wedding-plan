'use client';

import * as React from 'react';
import { MusicTrack, CeremonyMoment } from './types';
import { useRole } from '@/context/RoleContext';
import {
  Music,
  ArrowUp,
  ArrowDown,
  AlertOctagon,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';

const h = React.createElement;

export interface MusicPlaylistTabProps {
  tracks: MusicTrack[];
  onUpdateTracks: (tracks: MusicTrack[]) => void;
  onAddNew: () => void;
  onEditTrack: (track: MusicTrack) => void;
  onDeleteTrack: (id: string) => void;
  className?: string;
}

export const CEREMONY_MOMENTS: { key: CeremonyMoment; label: string; desc: string }[] = [
  { key: 'guest_arrival', label: '1. Đón khách', desc: 'Nhạc nhẹ nhàng, acoustic, chào đón khách' },
  { key: 'grand_entrance', label: '2. Khai tiệc & Vào sảnh', desc: 'Nhạc trang trọng hoặc sôi động khi cô dâu chú rể bước vào' },
  { key: 'ceremony', label: '3. Nghi lễ & Trao nhẫn', desc: 'Giai điệu thiêng liêng, cao trào lúc trao nhẫn' },
  { key: 'champagne_cake', label: '4. Cắt bánh & Rót rượu', desc: 'Giai điệu ngọt ngào, hân hoan' },
  { key: 'table_visits', label: '5. Chúc rượu tại bàn', desc: 'Nhạc nền vừa phải để khách trò chuyện vui vẻ' },
  { key: 'bouquet_toss', label: '6. Tung hoa cưới', desc: 'Sôi nổi, hồi hộp cho các bạn độc thân' },
  { key: 'send_off', label: '7. Tiễn khách', desc: 'Giai điệu ấm áp, lưu luyến' },
];

export const MusicPlaylistTab: React.FC<MusicPlaylistTabProps> = ({
  tracks,
  onUpdateTracks,
  onAddNew,
  onEditTrack,
  onDeleteTrack,
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

  const [selectedMoment, setSelectedMoment] = React.useState<string>('all');

  // Sorted tracks by orderIndex
  const sortedTracks = [...tracks].sort((a, b) => a.orderIndex - b.orderIndex);

  const filteredTracks =
    selectedMoment === 'all'
      ? sortedTracks
      : sortedTracks.filter((t) => t.moment === selectedMoment);

  const moveTrack = (index: number, direction: 'up' | 'down') => {
    if (!canMutate) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedTracks.length) return;

    const reordered = [...sortedTracks];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // Re-assign order indices
    const updated = reordered.map((t, idx) => ({
      ...t,
      orderIndex: idx + 1,
      version: (t.version || 1) + 1,
    }));
    onUpdateTracks(updated);
  };

  const getMomentLabel = (key: CeremonyMoment) => {
    const found = CEREMONY_MOMENTS.find((m) => m.key === key);
    return found ? found.label : key;
  };

  return h(
    'div',
    { className: `space-y-6 ${className}` },
    // Notice Banner (Strictly external streaming link, zero audio upload per spec §7.9)
    h(
      'div',
      {
        className:
          'p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-800',
      },
      h(Info, { className: 'w-4 h-4 text-blue-600 shrink-0 mt-0.5' }),
      h(
        'div',
        {},
        h(
          'span',
          { className: 'font-semibold' },
          'Quy chuẩn phát nhạc (UI/UX SPEC §7.9 & PLAN §15): '
        ),
        'Danh sách phát phục vụ điều phối và ghi chú thời điểm vào nhạc (cue notes) cho âm thanh/DJ. Hệ thống liên kết link nghe trực tuyến bên ngoài (Spotify/YouTube/SoundCloud) để nghe thử; không lưu hoặc tải file audio lên máy chủ.'
      )
    ),
    // Controls Bar & Filter
    h(
      'div',
      {
        className:
          'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-2xs',
      },
      h(
        'div',
        { className: 'flex items-center gap-2 flex-wrap' },
        h(
          'span',
          { className: 'text-xs font-semibold text-gray-700' },
          'Phân đoạn nghi lễ:'
        ),
        h(
          'select',
          {
            value: selectedMoment,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedMoment(e.target.value),
            className:
              'px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-700',
          },
          h('option', { value: 'all' }, 'Tất cả 7 khoảnh khắc'),
          CEREMONY_MOMENTS.map((m) =>
            h('option', { key: m.key, value: m.key }, m.label)
          )
        )
      ),
      canMutate &&
        h(
          'button',
          {
            type: 'button',
            onClick: onAddNew,
            className:
              'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition shadow-xs self-start sm:self-auto',
          },
          h(Plus, { className: 'w-4 h-4' }),
          'Thêm bài hát vào danh sách'
        )
    ),
    // Playlist Items Table/List
    filteredTracks.length === 0
      ? h(
          'div',
          {
            className:
              'p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300',
          },
          h(Music, { className: 'w-10 h-10 text-gray-400 mx-auto mb-2' }),
          h(
            'h3',
            { className: 'text-sm font-semibold text-gray-700' },
            'Chưa có bài hát nào trong phân đoạn này'
          ),
          h(
            'p',
            { className: 'text-xs text-gray-500 mt-1' },
            'Hãy thêm bài hát kèm ghi chú vào nhạc để ban nhạc/âm thanh phối hợp chuẩn xác.'
          )
        )
      : h(
          'div',
          { className: 'space-y-3' },
          filteredTracks.map((track) => {
            const globalIndex = sortedTracks.findIndex((t) => t.id === track.id);
            const isFirst = globalIndex === 0;
            const isLast = globalIndex === sortedTracks.length - 1;

            return h(
              'div',
              {
                key: track.id,
                className: `p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  track.isBlacklisted
                    ? 'bg-red-50/70 border-red-200'
                    : 'bg-white border-gray-200 hover:border-gray-300 shadow-2xs'
                }`,
                'data-testid': `music-track-${track.id}`,
              },
              // Left: Order + Info
              h(
                'div',
                { className: 'flex items-start gap-3.5 flex-1' },
                // Order badge & Reorder controls
                h(
                  'div',
                  { className: 'flex flex-col items-center justify-center shrink-0' },
                  h(
                    'span',
                    {
                      className:
                        'w-7 h-7 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center border border-gray-200',
                    },
                    track.orderIndex
                  ),
                  canMutate &&
                    selectedMoment === 'all' &&
                    h(
                      'div',
                      { className: 'flex items-center gap-0.5 mt-1' },
                      h(
                        'button',
                        {
                          type: 'button',
                          disabled: isFirst,
                          onClick: () => moveTrack(globalIndex, 'up'),
                          className:
                            'p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400',
                          title: 'Chuyển lên trên',
                        },
                        h(ArrowUp, { className: 'w-3.5 h-3.5' })
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          disabled: isLast,
                          onClick: () => moveTrack(globalIndex, 'down'),
                          className:
                            'p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400',
                          title: 'Chuyển xuống dưới',
                        },
                        h(ArrowDown, { className: 'w-3.5 h-3.5' })
                      )
                    )
                ),
                // Title & Details
                h(
                  'div',
                  { className: 'space-y-1.5 flex-1' },
                  h(
                    'div',
                    { className: 'flex items-center gap-2 flex-wrap' },
                    h(
                      'h4',
                      {
                        className: `font-semibold text-sm ${
                          track.isBlacklisted
                            ? 'text-red-900 line-through'
                            : 'text-gray-900'
                        }`,
                      },
                      track.title
                    ),
                    track.artist &&
                      h(
                        'span',
                        { className: 'text-xs text-gray-500' },
                        `• ${track.artist}`
                      ),
                    track.duration &&
                      h(
                        'span',
                        { className: 'text-[11px] text-gray-400 font-mono' },
                        `(${track.duration})`
                      ),
                    // Blacklist badge
                    track.isBlacklisted &&
                      h(
                        'span',
                        {
                          className:
                            'px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300 flex items-center gap-1',
                        },
                        h(AlertOctagon, { className: 'w-3 h-3 text-red-600' }),
                        'CỜ KHÔNG PHÁT / DO NOT PLAY'
                      )
                  ),
                  // Moment tag
                  h(
                    'div',
                    { className: 'flex items-center gap-2' },
                    h(
                      'span',
                      {
                        className:
                          'px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary',
                      },
                      getMomentLabel(track.moment)
                    )
                  ),
                  // Cue timing notes
                  track.cueNotes &&
                    h(
                      'div',
                      {
                        className:
                          'p-2 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-700 font-mono flex items-start gap-1.5',
                      },
                      h(Sparkles, { className: 'w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5' }),
                      h('span', {}, track.cueNotes)
                    )
                )
              ),
              // Right: Link & Actions
              h(
                'div',
                { className: 'flex items-center gap-2 self-end md:self-center shrink-0' },
                track.externalUrl &&
                  h(
                    'a',
                    {
                      href: track.externalUrl,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      className:
                        'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition font-medium',
                    },
                    h(ExternalLink, { className: 'w-3.5 h-3.5' }),
                    'Nghe thử'
                  ),
                canMutate &&
                  h(
                    'div',
                    { className: 'flex items-center gap-1 pl-2 border-l border-gray-200' },
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => onEditTrack(track),
                        className:
                          'p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition',
                        title: 'Sửa thông tin bài hát',
                      },
                      h(Edit2, { className: 'w-3.5 h-3.5' })
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => onDeleteTrack(track.id),
                        className:
                          'p-1.5 text-red-400 hover:text-red-700 rounded-lg hover:bg-red-50 transition',
                        title: 'Xóa bài hát',
                      },
                      h(Trash2, { className: 'w-3.5 h-3.5' })
                    )
                  )
              )
            );
          })
        )
  );
};
