'use client';

import * as React from 'react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { TextInput } from '@/components/ui/input';
import { api, jsonBody } from '@/lib/api/request';
import {
  EVENT_STATUS_META,
  EVENT_TYPE_LABELS,
  fromVietnamDateTimeInput,
  toVietnamDateTimeInput,
  type EventStatus,
  type EventType,
  type WeddingEventDto,
} from './settingsHelpers';

export interface CeremonyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: WeddingEventDto | null;
  onSaved: (message: string) => Promise<void>;
}

const fieldControlClass =
  'w-full min-h-11 rounded-control border border-border-control bg-surface px-3.5 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50';

const textareaClass =
  'w-full rounded-control border border-border-control bg-surface px-3.5 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50';

export const CeremonyEditorModal: React.FC<CeremonyEditorModalProps> = ({
  isOpen,
  onClose,
  event,
  onSaved,
}) => {
  const isEdit = Boolean(event);
  const [title, setTitle] = React.useState('');
  const [eventType, setEventType] = React.useState<EventType>('wedding_party');
  const [status, setStatus] = React.useState<EventStatus>('tentative');
  const [startLocal, setStartLocal] = React.useState('');
  const [endLocal, setEndLocal] = React.useState('');
  const [locationName, setLocationName] = React.useState('');
  const [locationAddress, setLocationAddress] = React.useState('');
  const [mapUrl, setMapUrl] = React.useState('');
  const [contactPerson, setContactPerson] = React.useState('');
  const [contactPhone, setContactPhone] = React.useState('');
  const [publicNotes, setPublicNotes] = React.useState('');
  const [privateNotes, setPrivateNotes] = React.useState('');
  const [confirmDateChange, setConfirmDateChange] = React.useState(false);
  const [dateImpactWarning, setDateImpactWarning] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lock = React.useRef(false);
  const typeId = React.useId();
  const statusId = React.useId();
  const startId = React.useId();
  const endId = React.useId();

  React.useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setDateImpactWarning(null);
    setConfirmDateChange(false);
    lock.current = false;

    if (event) {
      setTitle(event.title || '');
      setEventType(event.eventType || 'wedding_party');
      setStatus(event.status || 'tentative');
      setStartLocal(toVietnamDateTimeInput(event.startTime));
      setEndLocal(toVietnamDateTimeInput(event.endTime));
      setLocationName(event.locationName || '');
      setLocationAddress(event.locationAddress || '');
      setMapUrl(event.mapUrl || '');
      setContactPerson(event.contactPerson || '');
      setContactPhone(event.contactPhone || '');
      setPublicNotes(event.publicNotes || '');
      setPrivateNotes(event.privateNotes || '');
    } else {
      setTitle('');
      setEventType('wedding_party');
      setStatus('tentative');
      setStartLocal('');
      setEndLocal('');
      setLocationName('');
      setLocationAddress('');
      setMapUrl('');
      setContactPerson('');
      setContactPhone('');
      setPublicNotes('');
      setPrivateNotes('');
    }
  }, [isOpen, event]);

  const originalStartIso = event?.startTime ? new Date(event.startTime).toISOString() : null;
  const currentStartIso = fromVietnamDateTimeInput(startLocal);
  const hasStartDateChanged = isEdit && currentStartIso !== originalStartIso;

  const submitCeremony = async (overrideConfirmDateChange?: boolean) => {
    if (lock.current || saving) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Vui lòng nhập tên buổi lễ.');
      return;
    }

    const startTime = fromVietnamDateTimeInput(startLocal);
    const endTime = fromVietnamDateTimeInput(endLocal);
    if (startTime && endTime && endTime < startTime) {
      setError('Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }

    const payload = {
      title: cleanTitle,
      eventType,
      status,
      startTime,
      endTime,
      locationName: locationName.trim() || null,
      locationAddress: locationAddress.trim() || null,
      mapUrl: mapUrl.trim() || null,
      contactPerson: contactPerson.trim() || null,
      contactPhone: contactPhone.trim() || null,
      publicNotes: publicNotes.trim() || null,
      privateNotes: privateNotes.trim() || null,
      isCheckInEnabled: event ? Boolean(event.isCheckInEnabled) : true,
    };

    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      if (event) {
        await api(`/api/v1/events/${encodeURIComponent(event.id)}`, {
          method: 'PATCH',
          body: jsonBody({
            ...payload,
            version: event.version,
            confirmDateChange: overrideConfirmDateChange ?? confirmDateChange,
          }),
        });
        await onSaved(`Đã cập nhật buổi lễ "${cleanTitle}".`);
      } else {
        await api('/api/v1/events', {
          method: 'POST',
          body: jsonBody(payload),
        });
        await onSaved(`Đã thêm buổi lễ "${cleanTitle}".`);
      }
      onClose();
    } catch (failure) {
      const err = failure as Error & { status?: number };
      if (err.status === 409 && isEdit && hasStartDateChanged) {
        setDateImpactWarning(err.message);
      } else {
        setError(err.message || 'Không thể lưu buổi lễ.');
      }
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={isEdit ? 'Chỉnh sửa buổi lễ' : 'Thêm buổi lễ mới'}
      description="Thiết lập thời gian (giờ Việt Nam), địa điểm tổ chức và thông tin liên hệ."
      maxWidth="lg"
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="submit"
            form="ceremony-editor-form"
            variant="primary"
            loading={saving}
          >
            {isEdit ? 'Lưu thay đổi' : 'Tạo buổi lễ'}
          </Button>
        </>
      }
    >
      <form
        id="ceremony-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submitCeremony();
        }}
        className="space-y-4"
      >
        {error && <Alert variant="danger">{error}</Alert>}

        {dateImpactWarning && (
          <Alert variant="warning">
            <div className="space-y-2">
              <p className="font-medium text-text-main">Xác nhận thay đổi ngày buổi lễ</p>
              <p className="text-xs leading-relaxed">{dateImpactWarning}</p>
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={saving}
                onClick={() => {
                  setConfirmDateChange(true);
                  void submitCeremony(true);
                }}
              >
                Xác nhận đổi ngày &amp; Lưu
              </Button>
            </div>
          </Alert>
        )}

        <TextInput
          label="Tên buổi lễ"
          required
          placeholder="Ví dụ: Lễ Vu Quy, Tiệc Cưới Nhà Trai..."
          value={title}
          disabled={saving}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={typeId} className="text-sm font-medium text-text-main">
              Loại buổi lễ
            </label>
            <select
              id={typeId}
              className={fieldControlClass}
              value={eventType}
              disabled={saving}
              onChange={(e) => setEventType(e.target.value as EventType)}
            >
              {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((key) => (
                <option key={key} value={key}>
                  {EVENT_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={statusId} className="text-sm font-medium text-text-main">
              Trạng thái
            </label>
            <select
              id={statusId}
              className={fieldControlClass}
              value={status}
              disabled={saving}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
            >
              {(Object.keys(EVENT_STATUS_META) as EventStatus[]).map((key) => (
                <option key={key} value={key}>
                  {EVENT_STATUS_META[key].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={startId} className="text-sm font-medium text-text-main">
              Bắt đầu (giờ Việt Nam)
            </label>
            <input
              id={startId}
              type="datetime-local"
              className={fieldControlClass}
              value={startLocal}
              disabled={saving}
              onChange={(e) => {
                setStartLocal(e.target.value);
                setDateImpactWarning(null);
                setError(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={endId} className="text-sm font-medium text-text-main">
              Kết thúc
            </label>
            <input
              id={endId}
              type="datetime-local"
              className={fieldControlClass}
              value={endLocal}
              disabled={saving}
              onChange={(e) => {
                setEndLocal(e.target.value);
                setError(null);
              }}
            />
          </div>
        </div>

        {hasStartDateChanged && !dateImpactWarning && (
          <label className="flex items-start gap-2.5 rounded-control bg-[#FAF8F4] border border-border-subtle px-3.5 py-2.5 text-xs text-text-main cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border-control text-primary focus:ring-primary"
              checked={confirmDateChange}
              disabled={saving}
              onChange={(e) => setConfirmDateChange(e.target.checked)}
            />
            <span>
              Xác nhận đổi ngày tổ chức buổi lễ này (hệ thống sẽ rà soát các công việc tính hạn theo ngày lễ).
            </span>
          </label>
        )}

        <div className="pt-2 border-t border-border-subtle space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <TextInput
              label="Địa điểm tổ chức"
              placeholder="Tên nhà hàng / tư gia..."
              value={locationName}
              disabled={saving}
              onChange={(e) => setLocationName(e.target.value)}
            />
            <TextInput
              label="Link bản đồ (Google Maps)"
              type="url"
              placeholder="https://maps.google.com/..."
              value={mapUrl}
              disabled={saving}
              onChange={(e) => setMapUrl(e.target.value)}
            />
          </div>

          <TextInput
            label="Địa chỉ chi tiết"
            placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố"
            value={locationAddress}
            disabled={saving}
            onChange={(e) => setLocationAddress(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <TextInput
              label="Người liên hệ"
              placeholder="Quản lý sảnh tiệc / người phụ trách"
              value={contactPerson}
              disabled={saving}
              onChange={(e) => setContactPerson(e.target.value)}
            />
            <TextInput
              label="Số điện thoại"
              type="tel"
              placeholder="09xx xxx xxx"
              value={contactPhone}
              disabled={saving}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-text-main">Ghi chú chia sẻ</span>
              <textarea
                rows={2}
                className={textareaClass}
                placeholder="Thông tin dress code, gửi xe..."
                value={publicNotes}
                disabled={saving}
                onChange={(e) => setPublicNotes(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-text-main">Ghi chú riêng tư</span>
              <textarea
                rows={2}
                className={textareaClass}
                placeholder="Lưu ý nội bộ của hai vợ chồng..."
                value={privateNotes}
                disabled={saving}
                onChange={(e) => setPrivateNotes(e.target.value)}
              />
            </label>
          </div>
        </div>
      </form>
    </ModalDialog>
  );
};
