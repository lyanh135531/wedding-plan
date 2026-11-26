'use client';

import * as React from 'react';
import { Send } from 'lucide-react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { CalendarInput } from '@/components/ui/calendar-input';
import { todayIsoInVietnam } from './helpers';

export interface QuickSentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNames: string[];
  onConfirm: (sentDate: string) => Promise<void>;
}

export const QuickSentModal: React.FC<QuickSentModalProps> = ({
  isOpen,
  onClose,
  targetNames,
  onConfirm,
}) => {
  const [sentDate, setSentDate] = React.useState(() => todayIsoInVietnam());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lock = React.useRef(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setSentDate(todayIsoInVietnam());
    setError(null);
    lock.current = false;
  }, [isOpen]);

  const count = targetNames.length;
  const label = count === 1 ? targetNames[0] : `${count} thiệp đã chọn`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current || saving) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sentDate)) {
      setError('Vui lòng chọn ngày gửi hợp lệ.');
      return;
    }

    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(sentDate);
      onClose();
    } catch (failure) {
      setError((failure as Error).message || 'Không thể đánh dấu đã gửi.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title="Xác nhận đã gửi thiệp"
      description={
        count === 1
          ? `Đánh dấu thiệp "${label}" sang trạng thái Đã gửi.`
          : `Đánh dấu ${count} thiệp sang trạng thái Đã gửi.`
      }
      maxWidth="sm"
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            form="quick-sent-form"
            variant="primary"
            loading={saving}
            leftIcon={<Send className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            Xác nhận đã gửi
          </Button>
        </>
      }
    >
      <form id="quick-sent-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="space-y-1.5 text-sm">
          <label htmlFor="quick-sent-date" className="font-medium text-text-main block">
            Ngày gửi *
          </label>
          <CalendarInput
            id="quick-sent-date"
            label="Ngày gửi"
            value={sentDate}
            disabled={saving}
            required
            onValueChange={setSentDate}
            className="w-full min-h-11 rounded-control border border-border-control bg-surface px-3.5 py-2.5 text-sm"
          />
        </div>

        <p className="text-xs text-text-muted bg-[#FAF8F4] border border-border-subtle rounded-control px-3.5 py-2.5 leading-relaxed">
          Chỉ cập nhật tiến độ gửi thiệp, không tự động thay đổi xác nhận tham dự (RSVP) của khách mời.
        </p>
      </form>
    </ModalDialog>
  );
};
