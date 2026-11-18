'use client';

import * as React from 'react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Checkbox } from '@/components/ui/checkbox';
import { QuoteDto, ReviseQuoteInput, reviseQuoteSchema } from '@/schemas/vendors';
import { vendorsApi } from '@/lib/vendors/api-client';

export interface ReviseQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  baseQuote: QuoteDto;
  onSuccess: (newVersionQuote: QuoteDto) => void;
}

export const ReviseQuoteModal: React.FC<ReviseQuoteModalProps> = ({
  isOpen,
  onClose,
  vendorId,
  baseQuote,
  onSuccess,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const nextVersion = baseQuote.version_number + 1;

  const [quoteName, setQuoteName] = React.useState(baseQuote.quote_name);
  const [receivedDate, setReceivedDate] = React.useState(
    new Date().toISOString().split('T')[0]
  );
  const [validUntil, setValidUntil] = React.useState(baseQuote.valid_until || '');
  const [totalAmount, setTotalAmount] = React.useState<bigint | null>(
    baseQuote.total_amount ? BigInt(baseQuote.total_amount) : null
  );
  const [isEstimate, setIsEstimate] = React.useState(baseQuote.is_estimate);
  const [guestCount, setGuestCount] = React.useState(
    baseQuote.guest_count_assumption ? String(baseQuote.guest_count_assumption) : ''
  );
  const [tableCount, setTableCount] = React.useState(
    baseQuote.table_count_assumption ? String(baseQuote.table_count_assumption) : ''
  );
  const [terms, setTerms] = React.useState(baseQuote.terms || '');
  const [includesText, setIncludesText] = React.useState(
    baseQuote.includes.join('\n')
  );
  const [excludesText, setExcludesText] = React.useState(
    baseQuote.excludes.join('\n')
  );
  const [depositConditions, setDepositConditions] = React.useState(
    baseQuote.deposit_conditions || ''
  );
  const [revisionReason, setRevisionReason] = React.useState('');

  React.useEffect(() => {
    setQuoteName(baseQuote.quote_name);
    setReceivedDate(new Date().toISOString().split('T')[0]);
    setValidUntil(baseQuote.valid_until || '');
    setTotalAmount(baseQuote.total_amount ? BigInt(baseQuote.total_amount) : null);
    setIsEstimate(baseQuote.is_estimate);
    setGuestCount(
      baseQuote.guest_count_assumption ? String(baseQuote.guest_count_assumption) : ''
    );
    setTableCount(
      baseQuote.table_count_assumption ? String(baseQuote.table_count_assumption) : ''
    );
    setTerms(baseQuote.terms || '');
    setIncludesText(baseQuote.includes.join('\n'));
    setExcludesText(baseQuote.excludes.join('\n'));
    setDepositConditions(baseQuote.deposit_conditions || '');
    setRevisionReason('');
    setErrorMsg(null);
  }, [baseQuote]);

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

    const rawPayload: ReviseQuoteInput = {
      quote_name: quoteName.trim(),
      received_date: receivedDate,
      valid_until: validUntil.trim() || null,
      total_amount: totalAmount !== null ? totalAmount.toString() : null,
      is_estimate: isEstimate,
      guest_count_assumption: guestCount ? Number(guestCount) : null,
      table_count_assumption: tableCount ? Number(tableCount) : null,
      terms: terms.trim() || null,
      includes,
      excludes,
      deposit_conditions: depositConditions.trim() || null,
      revision_reason: revisionReason.trim() || undefined,
    };

    const parsed = reviseQuoteSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setErrorMsg(firstIssue?.message || 'Dữ liệu điều chỉnh báo giá chưa hợp lệ');
      return;
    }

    try {
      setLoading(true);
      // AT24: Call reviseQuote passing baseQuote.id as parent_quote_id
      const res = await vendorsApi.reviseQuote(vendorId, baseQuote.id, parsed.data);
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tạo phiên bản báo giá mới. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    ModalDialog,
    {
      isOpen,
      onClose,
      title: `Tạo Phiên Bản Mới (v${nextVersion})`,
      description: `Điều chỉnh báo giá kế thừa từ bản v${baseQuote.version_number}. Bản ghi cũ sẽ được bảo toàn nguyên vẹn trong lịch sử (AT24).`,
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

      // Revision Reason input
      React.createElement(
        'div',
        { className: 'space-y-1' },
        React.createElement(
          'label',
          { className: 'block text-sm font-semibold text-primary' },
          'Lý do điều chỉnh báo giá (Ghi nhận lịch sử đàm phán)'
        ),
        React.createElement(TextInput, {
          label: '',
          value: revisionReason,
          onChange: (e) => setRevisionReason(e.target.value),
          placeholder: 'Ví dụ: Đàm phán giảm 5% phí sảnh, đổi màn hình LED P3...',
        })
      ),

      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
        React.createElement(TextInput, {
          label: 'Tên gói / Tên báo giá *',
          value: quoteName,
          onChange: (e) => setQuoteName(e.target.value),
          required: true,
        }),
        React.createElement(CurrencyInput, {
          label: 'Tổng tiền báo giá mới (Để trống nếu Chưa báo)',
          value: totalAmount,
          onChange: setTotalAmount,
          placeholder: 'Chưa có giá chính thức',
          helperText: 'Nếu chưa có giá, để trống để hiển thị "Chưa báo" (AT24)',
        })
      ),

      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
        React.createElement(TextInput, {
          label: 'Ngày nhận bản mới *',
          type: 'date',
          value: receivedDate,
          onChange: (e) => setReceivedDate(e.target.value),
          required: true,
        }),
        React.createElement(TextInput, {
          label: 'Hạn hiệu lực mới',
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
          label: 'Số bàn giả định',
          type: 'number',
          value: tableCount,
          onChange: (e) => setTableCount(e.target.value),
        }),
        React.createElement(TextInput, {
          label: 'Số khách giả định',
          type: 'number',
          value: guestCount,
          onChange: (e) => setGuestCount(e.target.value),
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
            className:
              'w-full p-2.5 bg-[#FAF9F5] border border-border-control rounded-control text-sm focus:outline-2 focus:outline-focus',
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
            className:
              'w-full p-2.5 bg-[#FAF9F5] border border-border-control rounded-control text-sm focus:outline-2 focus:outline-focus',
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
            className:
              'w-full p-2 bg-[#FAF9F5] border border-border-control rounded-control text-sm focus:outline-2 focus:outline-focus',
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
            className:
              'w-full p-2 bg-[#FAF9F5] border border-border-control rounded-control text-sm focus:outline-2 focus:outline-focus',
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
            loadingText: 'Đang lưu bản v mới...',
          },
          `Lưu phiên bản v${nextVersion}`
        )
      )
    )
  );
};
