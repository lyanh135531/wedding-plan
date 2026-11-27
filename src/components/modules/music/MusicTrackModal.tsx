'use client';

import * as React from 'react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { TextInput } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api, jsonBody } from '@/lib/api/request';
import {
  MUSIC_MOMENTS,
  type ParsedMusicTrack,
  formatDurationSeconds,
  getMomentMeta,
  parseDurationInput,
} from './musicHelpers';

export interface MusicTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  track: ParsedMusicTrack | null;
  defaultMoment?: string;
  nextTrackOrder: number;
  onSaved: (message: string) => Promise<void>;
}

const selectClass =
  'w-full min-h-11 rounded-control border border-border-control bg-surface px-3.5 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50';

const textareaClass =
  'w-full rounded-control border border-border-control bg-surface px-3.5 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50';

export const MusicTrackModal: React.FC<MusicTrackModalProps> = ({
  isOpen,
  onClose,
  eventId,
  track,
  defaultMoment,
  nextTrackOrder,
  onSaved,
}) => {
  const isEdit = Boolean(track);
  const [title, setTitle] = React.useState('');
  const [artist, setArtist] = React.useState('');
  const [moment, setMoment] = React.useState('guest_arrival');
  const [durationText, setDurationText] = React.useState('');
  const [externalUrl, setExternalUrl] = React.useState('');
  const [cueNotes, setCueNotes] = React.useState('');
  const [isBlacklisted, setIsBlacklisted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lock = React.useRef(false);
  const momentSelectId = React.useId();

  React.useEffect(() => {
    if (!isOpen) return;
    setError(null);
    lock.current = false;
    if (track) {
      setTitle(track.title);
      setArtist(track.artist || '');
      setMoment(track.moment || 'guest_arrival');
      setDurationText(formatDurationSeconds(track.durationSeconds) || '');
      setExternalUrl(track.externalUrl || '');
      setCueNotes(track.cueNotes || '');
      setIsBlacklisted(track.isBlacklisted);
    } else {
      setTitle('');
      setArtist('');
      setMoment(
        defaultMoment && defaultMoment !== 'all' ? defaultMoment : 'guest_arrival'
      );
      setDurationText('');
      setExternalUrl('');
      setCueNotes('');
      setIsBlacklisted(false);
    }
  }, [isOpen, track, defaultMoment]);

  const momentMeta = getMomentMeta(moment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current || saving) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Vui lòng nhập tên bài hát.');
      return;
    }

    const parsedDuration = parseDurationInput(durationText);
    if (parsedDuration === undefined) {
      setError('Thời lượng không hợp lệ. Nhập theo dạng phút:giây (VD: 3:45) hoặc số giây.');
      return;
    }

    const payload = {
      title: cleanTitle,
      artist: artist.trim() || null,
      moment,
      externalUrl: externalUrl.trim() || null,
      durationSeconds: parsedDuration,
      cueNotes: cueNotes.trim() || null,
      isBlacklisted,
      trackOrder: track ? track.trackOrder : nextTrackOrder,
      isShared: track ? track.isShared : false,
    };

    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      if (track) {
        await api(`/api/v1/preparation/music/${encodeURIComponent(track.id)}`, {
          method: 'PATCH',
          body: jsonBody({
            ...payload,
            version: track.version,
          }),
        });
        await onSaved(`Đã cập nhật bài hát "${cleanTitle}".`);
      } else {
        await api('/api/v1/preparation/music', {
          method: 'POST',
          body: jsonBody({
            eventId,
            ...payload,
          }),
        });
        await onSaved(
          isBlacklisted
            ? `Đã thêm "${cleanTitle}" vào danh sách Không phát.`
            : `Đã thêm bài hát "${cleanTitle}".`
        );
      }
      onClose();
    } catch (failure) {
      setError((failure as Error).message || 'Không thể lưu bài hát.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={isEdit ? 'Chỉnh sửa bài hát' : 'Thêm bài hát vào danh sách'}
      description="Chọn khoảnh khắc nghi lễ, link nghe thử và ghi chú thời điểm vào nhạc cho DJ / âm thanh."
      maxWidth="md"
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="submit"
            form="music-track-form"
            variant="primary"
            loading={saving}
          >
            {isEdit ? 'Lưu thay đổi' : 'Thêm bài hát'}
          </Button>
        </>
      }
    >
      <form id="music-track-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <TextInput
          label="Tên bài hát"
          required
          placeholder="Ví dụ: A Thousand Years, Ánh Nắng Của Anh..."
          value={title}
          disabled={saving}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <TextInput
            label="Ca sĩ / Nghệ sĩ trình bày"
            placeholder="Ví dụ: Christina Perri, Đức Phúc..."
            value={artist}
            disabled={saving}
            onChange={(e) => setArtist(e.target.value)}
          />
          <TextInput
            label="Thời lượng (phút:giây)"
            placeholder="Ví dụ: 3:45"
            value={durationText}
            disabled={saving}
            onChange={(e) => {
              setDurationText(e.target.value);
              setError(null);
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={momentSelectId} className="text-sm font-medium text-text-main">
            Khoảnh khắc nghi lễ
          </label>
          <select
            id={momentSelectId}
            className={selectClass}
            value={moment}
            disabled={saving}
            onChange={(e) => setMoment(e.target.value)}
          >
            {MUSIC_MOMENTS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          {momentMeta.description && (
            <span className="text-xs text-text-muted">{momentMeta.description}</span>
          )}
        </div>

        <TextInput
          label="Link nghe thử (Spotify / YouTube / SoundCloud)"
          type="url"
          placeholder="https://open.spotify.com/track/..."
          value={externalUrl}
          disabled={saving}
          onChange={(e) => {
            setExternalUrl(e.target.value);
            setError(null);
          }}
        />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-text-main">Hướng dẫn phát nhạc (Cue notes)</span>
          <textarea
            rows={2}
            className={textareaClass}
            placeholder="Ví dụ: Vào điệp khúc lúc 0:52 khi cô dâu bước lên sân khấu, âm lượng 75%."
            value={cueNotes}
            disabled={saving}
            onChange={(e) => setCueNotes(e.target.value)}
          />
        </label>

        <div className="rounded-xl border border-danger/20 bg-danger-bg/50 px-3.5 py-2">
          <Switch
            label="Đánh dấu Không phát (Do Not Play)"
            description="Lưu ý cho DJ / ban nhạc tuyệt đối không mở bài hát này trong buổi lễ."
            checked={isBlacklisted}
            disabled={saving}
            onChange={setIsBlacklisted}
          />
        </div>
      </form>
    </ModalDialog>
  );
};
