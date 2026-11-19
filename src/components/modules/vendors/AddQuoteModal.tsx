'use client';

import * as React from 'react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Checkbox } from '@/components/ui/checkbox';
import { QuoteDto, CreateQuoteInput, createQuoteSchema } from '@/schemas/vendors';
import { vendorsApi } from '@/lib/vendors/api-client';

export interface AddQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  vendorName: string;
  onSuccess: (newQuote: QuoteDto) => void;
}

export const AddQuoteModal: React.FC<AddQuoteModalProps> = ({
  isOpen,
  onClose,
  vendorId,
  vendorName,
  onSuccess,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [quoteName, setQuoteName] = React.useState('');
  const [receivedDate, setReceivedDate] = React.useState(
    new Date().toISOString().split('T')[0]
  );
  const [validUntil, setValidUntil] = React.useState('');
  const [totalAmount, setTotalAmount] = React.useState<bigint | null>(null);
  const [isEstimate, setIsEstimate] = React.useState(false);
  const [guestCount, setGuestCount] = React.useState('');
  const [tableCount, setTableCount] = React.useState('');
  const [terms, setTerms] = React.useState('');
  const [includesText, setIncludesText] = React.useState('');
  const [excludesText, setExcludesText] = React.useState('');
  const [depositConditions, setDepositConditions] = React.useState('');

  const resetForm = () => {
    setQuoteName('');
    setReceivedDate(new Date().toISOString().split('T')[0]);
    setValidUntil('');
    setTotalAmount(null);
    setIsEstimate(false);
    setGuestCount('');
    setTableCount('');
    setTerms('');
    setIncludesText('');
    setExcludesText('');
    setDepositConditions('');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const includes = includesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const excludes = excludesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const rawPayload: CreateQuoteInput = {
      quote_name: quoteName.trim(),
      received_date: receivedDate,
      valid_until: validUntil.trim() || null,
      // AT24: Total amount is nullable. If null, remains null ("Chưa báo")
      total_amount: totalAmount !== null ? totalAmount.toString() : null,
      is_estimate: isEstimate,
      guest_count_assumption: guestCount ? Number(guestCount) : null,
      table_count_assumption: tableCount ? Number(tableCount) : null,
      terms: terms.trim() || null,
      includes,
      excludes,
      deposit_conditions: depositConditions.trim() || null,
    };

    const parsed = createQuoteSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setErrorMsg(firstIssue?.message || 'Dữ liệu nhập báo giá chưa hợp lệ');
      return;
    }

    try {
      setLoading(true);
      const res = await vendorsApi.createQuote(vendorId, parsed.data);
      resetForm();
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tạo báo giá. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    ModalDialog,
    {
      isOpen,
      onClose: () => {
        resetForm();
        onClose();
      },
      title: 'Thêm Báo Giá Ban Đầu (v1)',
      description: `Tạo báo giá hoặc gói dịch vụ mới cho ${vendorName}`,
      maxWidth: 'lg',
    },
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

      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
        React.createElement(TextInput, {
          label: 'Tên gói / Tên báo giá *',
          value: quoteName,
          onChange: (e) => setQuoteName(e.target.value),
          placeholder: 'Ví dụ: Gói Tiệc Cưới Vàng 2027',
          required: true,
          autoFocusOnError: true,
        }),
        React.createElement(CurrencyInput, {
          label: 'Tổng tiền báo giá (Để trống nếu Chưa báo)',
          value: totalAmount,
          onChange: setTotalAmount,
          placeholder: 'Chưa có giá chính thức',
          helperText: 'Nếu đối tác chưa chốt giá, để trống để hiển thị "Chưa báo" (AT24)',
        })
      ),

      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
        React.createElement(TextInput, {
          label: 'Ngày nhận báo giá *',
          type: 'date',
          value: receivedDate,
          onChange: (e) => setReceivedDate(e.target.value),
          required: true,
        }),
        React.createElement(TextInput, {
          label: 'Hạn hiệu lực báo giá',
          type: 'date',
          value: validUntil,
          onChange: (e) => setValidUntil(e.target.value),
        }),
        React.createElement(
          'div',
          { className: 'flex items-center pt-6' },
          React.createElement(Checkbox, {
            label: 'Đây là giá ước tính sơ bộ',
            checked: isEstimate,
            onChange: (e) => setIsEstimate(e.target.checked),
          })
        )
      ),

      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
        React.createElement(TextInput, {
          label: 'Số bàn giả định trong gói',
          type: 'number',
          value: tableCount,
          onChange: (e) => setTableCount(e.target.value),
          placeholder: 'Ví dụ: 30',
        }),
        React.createElement(TextInput, {
          label: 'Số khách giả định',
          type: 'number',
          value: guestCount,
          onChange: (e) => setGuestCount(e.target.value),
          placeholder: 'Ví dụ: 300',
        })
      ),

      // Includes & Excludes
      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4 text-sm' },
        React.createElement(
          'div',
          { className: 'space-y-1' },
          React.createElement(
            'label',
            { className: 'block font-medium text-xs text-text-main' },
            'Hạng mục bao gồm (Mỗi dòng 1 mục)'
          ),
          React.createElement('textarea', {
            value: includesText,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setIncludesText(e.target.value),
            rows: 3,
            placeholder: 'Thực đơn 6 món\nNước ngọt suốt tiệc\nMàn hình LED...',
            className:
              'w-full p-2.5 bg-page border border-border-control rounded-control text-sm focus:outline-2 focus:outline-focus',
          })
        ),
        React.createElement(
          'div',
          { className: 'space-y-1' },
          React.createElement(
            'label',
            { className: 'block font-medium text-xs text-text-main' },
            'Hạng mục không bao gồm / phát sinh'
          ),
          React.createElement('textarea', {
            value: excludesText,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setExcludesText(e.target.value),
            rows: 3,
            placeholder: 'Phí rượu mang ngoài\nVũ đoàn khai mạc...',
            className:
              'w-full p-2.5 bg-page border border-border-control rounded-control text-sm focus:outline-2 focus:outline-focus',
          })
        )
      ),

      // Deposit conditions & Terms
      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4 text-sm' },
        React.createElement(
          'div',
          { className: 'space-y-1' },
          React.createElement(
            'label',
            { className: 'block font-medium text-xs text-text-main' },
            'Điều kiện đặt cọc & thanh toán'
          ),
          React.createElement('textarea', {
            value: depositConditions,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setDepositConditions(e.target.value),
            rows: 2,
            placeholder: 'Cọc đợt 1 30%, đợt 2 50%...',
            className:
              'w-full p-2 bg-page border border-border-control rounded-control text-sm focus:outline-2 focus:outline-focus',
          })
        ),
        React.createElement(
          'div',
          { className: 'space-y-1' },
          React.createElement(
            'label',
            { className: 'block font-medium text-xs text-text-main' },
            'Điều khoản hợp đồng & hoàn hủy'
          ),
          React.createElement('textarea', {
            value: terms,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setTerms(e.target.value),
            rows: 2,
            placeholder: 'Thời hạn hủy không phạt cọc trước 30 ngày...',
            className:
              'w-full p-2 bg-page border border-border-control rounded-control text-sm focus:outline-2 focus:outline-focus',
          })
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
            disabled: loading,
          },
          'Hủy'
        ),
        React.createElement(
          Button,
          {
            type: 'submit',
            variant: 'primary',
            loading,
            loadingText: 'Đang tạo báo giá...',
          },
          'Tạo báo giá v1'
        )
      )
    )
  );
};
