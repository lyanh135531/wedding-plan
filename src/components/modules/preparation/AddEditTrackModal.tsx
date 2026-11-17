'use client';

import * as React from 'react';
import { MusicTrack, CeremonyMoment } from './types';
import { CEREMONY_MOMENTS } from './MusicPlaylistTab';
import { X, Music, AlertCircle } from 'lucide-react';

const h = React.createElement;

export interface AddEditTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<MusicTrack, 'id' | 'orderIndex' | 'version'>) => void;
  initialData?: MusicTrack | null;
}

export const AddEditTrackModal: React.FC<AddEditTrackModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [title, setTitle] = React.useState(() => initialData?.title || '');
  const [artist, setArtist] = React.useState(() => initialData?.artist || '');
  const [moment, setMoment] = React.useState<CeremonyMoment>(
    () => initialData?.moment || 'guest_arrival'
  );
  const [duration, setDuration] = React.useState(() => initialData?.duration || '');
  const [cueNotes, setCueNotes] = React.useState(() => initialData?.cueNotes || '');
  const [isBlacklisted, setIsBlacklisted] = React.useState(
    () => initialData?.isBlacklisted || false
  );
  const [externalUrl, setExternalUrl] = React.useState(
    () => initialData?.externalUrl || ''
  );
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setArtist(initialData.artist || '');
      setMoment(initialData.moment || 'guest_arrival');
      setDuration(initialData.duration || '');
      setCueNotes(initialData.cueNotes || '');
      setIsBlacklisted(initialData.isBlacklisted || false);
      setExternalUrl(initialData.externalUrl || '');
    } else {
      setTitle('');
      setArtist('');
      setMoment('guest_arrival');
      setDuration('');
      setCueNotes('');
      setIsBlacklisted(false);
      setExternalUrl('');
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tên bài hát');
      return;
    }

    onSubmit({
      title: title.trim(),
      artist: artist.trim() || undefined,
      moment,
      duration: duration.trim() || undefined,
      cueNotes: cueNotes.trim() || undefined,
      isBlacklisted,
      externalUrl: externalUrl.trim() || undefined,
    });
    onClose();
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150',
      'data-testid': 'add-edit-track-modal',
    },
    h(
      'div',
      {
        className:
          'bg-white rounded-xl shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]',
      },
      // Header
      h(
        'div',
        {
          className:
            'flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50',
        },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(Music, { className: 'w-5 h-5 text-primary' }),
          h(
            'h2',
            { className: 'text-base font-semibold text-gray-900' },
            initialData ? 'Chỉnh sửa bài hát' : 'Thêm bài hát vào danh sách'
          )
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: onClose,
            className: 'p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition',
          },
          h(X, { className: 'w-4 h-4' })
        )
      ),
      // Form Body
      h(
        'form',
        { onSubmit: handleSubmit, className: 'p-6 overflow-y-auto space-y-4 flex-1 text-sm' },
        error &&
          h(
            'div',
            {
              className:
                'p-3 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200',
            },
            h(AlertCircle, { className: 'w-4 h-4 shrink-0' }),
            error
          ),
        // Title
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Tên bài hát *'),
          h('input', {
            type: 'text',
            required: true,
            value: title,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value),
            placeholder: 'Ví dụ: A Thousand Years, Can’t Help Falling In Love...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // Artist & Duration
        h(
          'div',
          { className: 'grid grid-cols-2 gap-4' },
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Ca sĩ / Nghệ sĩ trình bày'),
            h('input', {
              type: 'text',
              value: artist,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setArtist(e.target.value),
              placeholder: 'Ví dụ: Christina Perri',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          ),
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Thời lượng (ví dụ: 3:45)'),
            h('input', {
              type: 'text',
              value: duration,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDuration(e.target.value),
              placeholder: '3:45',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono',
            })
          )
        ),
        // Ceremony Moment
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Khoảnh khắc nghi lễ sử dụng'),
          h(
            'select',
            {
              value: moment,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                setMoment(e.target.value as CeremonyMoment),
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white',
            },
            CEREMONY_MOMENTS.map((m) =>
              h('option', { key: m.key, value: m.key }, `${m.label} — ${m.desc}`)
            )
          )
        ),
        // Cue timing notes
        h(
          'div',
          { className: 'space-y-1' },
          h(
            'label',
            { className: 'block text-xs font-semibold text-gray-700' },
            'Ghi chú vào nhạc (Cue notes cho DJ / Kỹ thuật âm thanh)'
          ),
          h('textarea', {
            rows: 2,
            value: cueNotes,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setCueNotes(e.target.value),
            placeholder: 'Ví dụ: Đẩy âm lượng lên khi cửa mở, hoặc vào điệp khúc lúc trao nhẫn...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // External Streaming URL
        h(
          'div',
          { className: 'space-y-1' },
          h(
            'label',
            { className: 'block text-xs font-semibold text-gray-700' },
            'Link nghe trực tuyến (Spotify / YouTube / SoundCloud)'
          ),
          h('input', {
            type: 'url',
            value: externalUrl,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setExternalUrl(e.target.value),
            placeholder: 'https://open.spotify.com/track/... hoặc https://youtube.com/...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          }),
          h(
            'p',
            { className: 'text-[11px] text-gray-500' },
            'Chỉ lưu đường dẫn nghe thử bên ngoài, tuyệt đối không tải file nhạc lên hệ thống.'
          )
        ),
        // Blacklist warning toggle
        h(
          'div',
          { className: 'p-3 bg-red-50/70 border border-red-200 rounded-lg' },
          h(
            'label',
            { className: 'flex items-center gap-2 cursor-pointer' },
            h('input', {
              type: 'checkbox',
              checked: isBlacklisted,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setIsBlacklisted(e.target.checked),
              className: 'rounded text-red-600 focus:ring-red-500 w-4 h-4',
            }),
            h(
              'span',
              { className: 'text-xs font-bold text-red-900' },
              'Đánh dấu CỜ KHÔNG PHÁT (Do Not Play / Bài hát cấm kỵ ngày cưới)'
            )
          )
        ),
        // Footer buttons
        h(
          'div',
          { className: 'pt-4 border-t border-gray-100 flex items-center justify-end gap-3' },
          h(
            'button',
            {
              type: 'button',
              onClick: onClose,
              className:
                'px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition',
            },
            'Hủy'
          ),
          h(
            'button',
            {
              type: 'submit',
              className:
                'px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition shadow-xs',
            },
            initialData ? 'Lưu thay đổi' : 'Thêm bài hát'
          )
        )
      )
    )
  );
};
