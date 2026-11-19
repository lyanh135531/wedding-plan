'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ExternalLink, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import {
  QuoteToCostPreviewResponse,
  ConvertQuoteToCostInput,
  ConvertQuoteToCostResponse,
} from '@/schemas/vendors';
import { vendorsApi } from '@/lib/vendors/api-client';
import { formatVND } from '@/lib/utils';

export interface QuoteToCostPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  quoteId: string;
  onSuccess: (result: ConvertQuoteToCostResponse) => void;
}

export const QuoteToCostPreviewModal: React.FC<QuoteToCostPreviewModalProps> = ({
  isOpen,
  onClose,
  vendorId,
  quoteId,
  onSuccess,
}) => {
  const router = useRouter();

  const [loadingPreview, setLoadingPreview] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [previewData, setPreviewData] =
    React.useState<QuoteToCostPreviewResponse | null>(null);

  // Form states
  const [costName, setCostName] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [eventId, setEventId] = React.useState('');
  const [notes, setNotes] = React.useState('');

  // Fetch preview data on modal open
  React.useEffect(() => {
    if (!isOpen || !vendorId || !quoteId) return;

    let isMounted = true;
    setLoadingPreview(true);
    setErrorMsg(null);

    const loadPreview = async () => {
      try {
        const res = await vendorsApi.getQuoteToCostPreview(vendorId, quoteId);
        if (!isMounted) return;
        setPreviewData(res.data);
        setCostName(res.data.suggested_cost_item_name);
        if (res.data.available_categories.length > 0) {
          setCategoryId(res.data.available_categories[0].id);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setPreviewData(null);
        setErrorMsg(err.message || 'Không thể tải báo giá. Đóng và mở lại để thử lại.');
      } finally {
        if (isMounted) setLoadingPreview(false);
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [isOpen, vendorId, quoteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewData || previewData.is_already_converted) return;

    if (!categoryId) {
      setErrorMsg('Vui lòng chọn hạng mục ngân sách');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      // AT23: 3-tier Idempotency Guard: Generate client UUIDv4 idempotency key
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const payload: ConvertQuoteToCostInput = {
        category_id: categoryId,
        name: costName.trim() || undefined,
        event_id: eventId || null,
        status: 'contracted',
        notes: notes.trim() || null,
      };

      const res = await vendorsApi.convertQuoteToCost(
        vendorId,
        quoteId,
        payload,
        idempotencyKey
      );

      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tạo khoản chi. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenExistingCost = () => {
    if (previewData?.existing_cost_item?.id) {
      router.push(`/costs/${previewData.existing_cost_item.id}`);
    } else {
      router.push('/budget');
    }
    onClose();
  };

  return React.createElement(
    ModalDialog,
    {
      isOpen,
      onClose,
      title: 'Tạo Khoản Chi Từ Báo Giá (FL14)',
      description:
        'Xem trước thông tin và liên kết gói báo giá vào phân hệ Ngân sách cưới.',
      maxWidth: 'md',
    },
    loadingPreview
      ? React.createElement(
          'div',
          { className: 'py-12 flex flex-col items-center justify-center space-y-3' },
          React.createElement(Loader2, { className: 'w-8 h-8 animate-spin text-primary', 'aria-hidden': 'true' }),
          React.createElement(
            'p',
            { className: 'text-sm text-text-muted' },
            'Đang kiểm tra tính hợp lệ & trạng thái chuyển đổi...'
          )
        )
      : previewData?.is_already_converted
      ? // CASE 1: ALREADY CONVERTED (Strict AT23 Idempotency)
        React.createElement(
          'div',
          { className: 'py-4 space-y-4' },
          React.createElement(
            'div',
            {
              className:
                'p-4 bg-success-bg border border-success/30 rounded-control flex items-start gap-3',
            },
            React.createElement(CheckCircle2, {
              className: 'w-5 h-5 text-success shrink-0 mt-0.5',
              'aria-hidden': 'true',
            }),
            React.createElement(
              'div',
              { className: 'space-y-1 text-sm' },
              React.createElement(
                'p',
                { className: 'font-semibold text-success' },
                'Báo giá này đã được chuyển thành khoản chi trước đó'
              ),
              React.createElement(
                'p',
                { className: 'text-text-main text-xs' },
                previewData.existing_cost_item
                  ? `Khoản chi liên kết: "${previewData.existing_cost_item.name}" (${
                      previewData.existing_cost_item.contracted_amount
                        ? formatVND(BigInt(previewData.existing_cost_item.contracted_amount))
                        : 'Chưa có giá'
                    })`
                  : 'Khoản chi đã tồn tại trong ngân sách của bạn.'
              )
            )
          ),
          React.createElement(
            'p',
            { className: 'text-xs text-text-muted leading-relaxed' },
            'Theo quy tắc toàn vẹn AT23, hệ thống ngăn chặn việc tạo trùng lặp chi phí từ cùng một báo giá. Bạn có thể mở trực tiếp khoản chi này trong phân hệ Ngân sách.'
          ),
          React.createElement(
            'div',
            { className: 'pt-4 flex items-center justify-end gap-3 border-t border-border-subtle' },
            React.createElement(
              Button,
              { variant: 'secondary', onClick: onClose },
              'Đóng'
            ),
            React.createElement(
              Button,
              {
                variant: 'primary',
                onClick: handleOpenExistingCost,
                rightIcon: React.createElement(ExternalLink, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
              },
              'Mở khoản chi'
            )
          )
        )
      : // CASE 2: NOT CONVERTED YET -> SHOW FORM (FL14, AT23)
        React.createElement(
          'form',
          { onSubmit: handleSubmit, className: 'space-y-4 pt-2' },
          errorMsg &&
            React.createElement(
              'div',
              {
                className:
                  'p-3 bg-danger-bg text-danger border border-danger/30 rounded-control text-sm',
                role: 'alert',
              },
              errorMsg
            ),

          // Overview banner
          React.createElement(
            'div',
            {
              className:
                'p-3.5 bg-page border border-border-control/60 rounded-control space-y-1.5 text-xs',
            },
            React.createElement(
              'div',
              { className: 'flex justify-between items-center' },
              React.createElement('span', { className: 'text-text-muted' }, 'Đối tác:'),
              React.createElement(
                'strong',
                { className: 'text-text-main' },
                previewData?.vendor_name
              )
            ),
            React.createElement(
              'div',
              { className: 'flex justify-between items-center' },
              React.createElement('span', { className: 'text-text-muted' }, 'Gói báo giá:'),
              React.createElement(
                'span',
                { className: 'font-medium text-text-main' },
                `${previewData?.quote_name} (v${previewData?.version_number})`
              )
            ),
            React.createElement(
              'div',
              { className: 'flex justify-between items-center pt-1 border-t border-border-subtle' },
              React.createElement('span', { className: 'text-text-muted font-medium' }, 'Số tiền dự toán:'),
              previewData?.is_price_missing || !previewData?.suggested_amount
                ? React.createElement(
                    'span',
                    { className: 'font-bold text-warning text-sm' },
                    'Chưa báo (AT24)'
                  )
                : React.createElement(
                    'span',
                    { className: 'font-bold text-primary text-sm' },
                    formatVND(BigInt(previewData.suggested_amount))
                  )
            )
          ),

          // Cost Name input
          React.createElement(TextInput, {
            label: 'Tên khoản chi trong ngân sách *',
            value: costName,
            onChange: (e) => setCostName(e.target.value),
            required: true,
          }),

          // Category Select (Required)
          React.createElement(
            'div',
            { className: 'space-y-1' },
            React.createElement(
              'label',
              { className: 'block text-sm font-medium text-text-main' },
              'Hạng mục ngân sách *'
            ),
            React.createElement(
              'select',
              {
                value: categoryId,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setCategoryId(e.target.value),
                className:
                  'w-full py-2.5 px-3 bg-page border border-border-control rounded-control text-base text-text-main focus:outline-2 focus:outline-focus min-h-[44px]',
                required: true,
              },
              React.createElement('option', { value: '' }, '-- Chọn hạng mục chi phí --'),
              previewData?.available_categories.map((cat) =>
                React.createElement(
                  'option',
                  { key: cat.id, value: cat.id },
                  cat.name
                )
              )
            )
          ),

          // Event Scope Select (Optional)
          previewData?.available_events &&
            previewData.available_events.length > 0 &&
            React.createElement(
              'div',
              { className: 'space-y-1' },
              React.createElement(
                'label',
                { className: 'block text-sm font-medium text-text-main' },
                'Áp dụng cho buổi lễ (Tùy chọn)'
              ),
              React.createElement(
                'select',
                {
                  value: eventId,
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setEventId(e.target.value),
                  className:
                    'w-full py-2.5 px-3 bg-page border border-border-control rounded-control text-base text-text-main focus:outline-2 focus:outline-focus min-h-[44px]',
                },
                React.createElement('option', { value: '' }, 'Tất cả / Chung cho đám cưới'),
                previewData.available_events.map((evt) =>
                  React.createElement(
                    'option',
                    { key: evt.id, value: evt.id },
                    evt.title
                  )
                )
              )
            ),

          // Notes
          React.createElement(
            'div',
            { className: 'space-y-1' },
            React.createElement(
              'label',
              { className: 'block text-sm font-medium text-text-main' },
              'Ghi chú bổ sung'
            ),
            React.createElement('textarea', {
              value: notes,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value),
              rows: 2,
              placeholder: 'Ghi chú cho khoản chi khi vào ngân sách...',
              className:
                'w-full p-2.5 bg-page border border-border-control rounded-control text-sm focus:outline-2 focus:outline-focus',
            })
          ),

          // Strict AT23 invariant notice
          React.createElement(
            'div',
            { className: 'p-3 bg-primary/5 rounded border border-primary/20 text-xs text-text-muted flex items-start gap-2' },
            React.createElement(ShieldCheck, { className: 'w-4 h-4 text-primary shrink-0 mt-0.5', 'aria-hidden': 'true' }),
            React.createElement(
              'span',
              null,
              'Khoản chi sẽ được tạo ở trạng thái Đã ký hợp đồng (Contracted). Tuyệt đối không tự động tạo bất kỳ giao dịch thanh toán nào.'
            )
          ),

          // Actions
          React.createElement(
            'div',
            { className: 'pt-4 flex items-center justify-end gap-3 border-t border-border-subtle' },
            React.createElement(
              Button,
              {
                type: 'button',
                variant: 'secondary',
                onClick: onClose,
                disabled: submitting,
              },
              'Hủy'
            ),
            React.createElement(
              Button,
              {
                type: 'submit',
                variant: 'primary',
                loading: submitting,
                loadingText: 'Đang tạo khoản chi...',
              },
              'Xác nhận tạo khoản chi'
            )
          )
        )
  );
};
