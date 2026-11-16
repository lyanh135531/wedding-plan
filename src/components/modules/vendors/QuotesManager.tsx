'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FileText,
  Calendar,
  Check,
  X,
  History,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  GitBranch,
  ShieldAlert,
} from 'lucide-react';
import { QuoteDto } from '@/schemas/vendors';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { formatVND } from '@/lib/utils';
import { ReviseQuoteModal } from './ReviseQuoteModal';
import { QuoteToCostPreviewModal } from './QuoteToCostPreviewModal';

export interface QuotesManagerProps {
  quotes: QuoteDto[];
  vendorId: string;
  vendorName: string;
  isOwner: boolean;
  onQuotesUpdated: (newQuotes: QuoteDto[]) => void;
  onOpenAddQuote: () => void;
}

export const QuotesManager: React.FC<QuotesManagerProps> = ({
  quotes,
  vendorId,
  vendorName,
  isOwner,
  onQuotesUpdated,
  onOpenAddQuote,
}) => {
  // AT03, AT41: Quotes & contract amounts are strictly forbidden for Family View
  if (!isOwner) {
    return null;
  }

  // Active modal targets
  const [activeReviseQuote, setActiveReviseQuote] = React.useState<QuoteDto | null>(null);
  const [activeConvertQuote, setActiveConvertQuote] = React.useState<QuoteDto | null>(null);
  const [expandedHistories, setExpandedHistories] = React.useState<Record<string, boolean>>({});

  // Group quotes by package_group_id
  const packageGroups = React.useMemo(() => {
    const map = new Map<string, QuoteDto[]>();
    for (const q of quotes) {
      const gid = q.package_group_id;
      if (!map.has(gid)) {
        map.set(gid, []);
      }
      map.get(gid)!.push(q);
    }
    // Sort each group by version_number desc
    for (const [gid, list] of map.entries()) {
      list.sort((a, b) => b.version_number - a.version_number);
    }
    return Array.from(map.entries());
  }, [quotes]);

  const toggleHistory = (packageGroupId: string) => {
    setExpandedHistories((prev) => ({
      ...prev,
      [packageGroupId]: !prev[packageGroupId],
    }));
  };

  const handleReviseSuccess = (newVersion: QuoteDto) => {
    onQuotesUpdated([...quotes, newVersion]);
    setActiveReviseQuote(null);
  };

  const handleConvertSuccess = () => {
    // Mark quote as selected in local state
    if (activeConvertQuote) {
      const updated = quotes.map((q) =>
        q.id === activeConvertQuote.id
          ? { ...q, is_selected: true }
          : q
      );
      onQuotesUpdated(updated);
    }
    setActiveConvertQuote(null);
  };

  return React.createElement(
    'section',
    {
      className: 'space-y-6 pt-4 border-t border-border-subtle',
      'aria-label': 'Quản lý báo giá và phiên bản hợp đồng',
    },
    // Section Header
    React.createElement(
      'div',
      { className: 'flex items-center justify-between gap-4 flex-wrap' },
      React.createElement(
        'div',
        null,
        React.createElement(
          'h2',
          { className: 'text-xl font-bold text-text-main flex items-center gap-2' },
          React.createElement(FileText, { className: 'w-5 h-5 text-primary', 'aria-hidden': 'true' }),
          'Báo Giá & Phiên Bản Hợp Đồng'
        ),
        React.createElement(
          'p',
          { className: 'text-xs text-text-muted mt-0.5' },
          'Bảo toàn lịch sử đàm phán bất biến (AT24). Mỗi lần chỉnh sửa điều khoản sẽ sinh ra phiên bản mới.'
        )
      ),
      React.createElement(
        Button,
        {
          variant: 'secondary',
          onClick: onOpenAddQuote,
          size: 'sm',
          leftIcon: React.createElement(Plus, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
        },
        'Thêm gói báo giá mới'
      )
    ),

    // Empty state if no quotes
    quotes.length === 0
      ? React.createElement(
          'div',
          {
            className:
              'p-8 text-center bg-surface rounded-card border border-dashed border-border-control/60 space-y-3',
          },
          React.createElement(FileText, {
            className: 'w-10 h-10 text-text-muted/50 mx-auto',
            'aria-hidden': 'true',
          }),
          React.createElement(
            'p',
            { className: 'text-sm font-semibold text-text-main' },
            'Chưa có báo giá nào cho nhà cung cấp này'
          ),
          React.createElement(
            'p',
            { className: 'text-xs text-text-muted max-w-md mx-auto' },
            'Thêm gói báo giá ban đầu để bắt đầu lưu vết các điều khoản, quy mô bàn tiệc và bóc tách chi phí.'
          ),
          React.createElement(
            Button,
            {
              variant: 'primary',
              size: 'sm',
              onClick: onOpenAddQuote,
              leftIcon: React.createElement(Plus, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
            },
            'Thêm báo giá v1'
          )
        )
      : React.createElement(
          'div',
          { className: 'space-y-6' },
          packageGroups.map(([groupId, packageQuotes]) => {
            const latestQuote = packageQuotes[0];
            const olderQuotes = packageQuotes.slice(1);
            const isHistoryOpen = Boolean(expandedHistories[groupId]);

            // Check if valid_until is past
            const isExpired =
              latestQuote.valid_until &&
              new Date(latestQuote.valid_until) < new Date();

            return React.createElement(
              'article',
              {
                key: groupId,
                className: `bg-surface rounded-card border transition-all ${
                  latestQuote.is_selected
                    ? 'border-success ring-1 ring-success shadow-md'
                    : 'border-border-subtle shadow-sm'
                }`,
              },
              // Card Top row: Quote Name, Version Badge, Status Badge
              React.createElement(
                'div',
                { className: 'p-5 border-b border-border-subtle/80 flex items-start justify-between gap-4 flex-wrap' },
                React.createElement(
                  'div',
                  { className: 'space-y-1.5' },
                  React.createElement(
                    'div',
                    { className: 'flex items-center gap-2 flex-wrap' },
                    React.createElement(
                      'h3',
                      { className: 'text-lg font-bold text-text-main' },
                      latestQuote.quote_name
                    ),
                    React.createElement(
                      'span',
                      {
                        className:
                          'text-xs font-bold px-2 py-0.5 rounded bg-primary text-white',
                      },
                      `v${latestQuote.version_number}`
                    ),
                    latestQuote.is_selected
                      ? React.createElement(StatusBadge, {
                          text: 'Đã chọn / Đã liên kết',
                          variant: 'success',
                          size: 'sm',
                        })
                      : React.createElement(StatusBadge, {
                          text: 'Đang cân nhắc',
                          variant: 'info',
                          size: 'sm',
                        }),
                    isExpired &&
                      React.createElement(StatusBadge, {
                        text: 'Đã hết hạn',
                        variant: 'danger',
                        size: 'sm',
                      })
                  ),
                  React.createElement(
                    'div',
                    { className: 'flex items-center gap-4 text-xs text-text-muted flex-wrap' },
                    React.createElement(
                      'span',
                      { className: 'flex items-center gap-1' },
                      React.createElement(Calendar, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' }),
                      `Ngày nhận: ${latestQuote.received_date}`
                    ),
                    latestQuote.valid_until &&
                      React.createElement(
                        'span',
                        null,
                        `Hạn hiệu lực: ${latestQuote.valid_until}`
                      ),
                    latestQuote.table_count_assumption &&
                      React.createElement(
                        'span',
                        null,
                        `Quy mô: ${latestQuote.table_count_assumption} bàn (${
                          latestQuote.guest_count_assumption ||
                          latestQuote.table_count_assumption * 10
                        } khách)`
                      )
                  )
                ),

                // Amount display (AT24: If null, bold orange "Chưa báo", never 0 VND)
                React.createElement(
                  'div',
                  { className: 'text-right' },
                  React.createElement(
                    'span',
                    { className: 'text-xs text-text-muted block' },
                    latestQuote.is_estimate ? 'Giá ước tính sơ bộ' : 'Tổng số tiền gói'
                  ),
                  latestQuote.total_amount
                    ? React.createElement(
                        'span',
                        { className: 'text-xl font-bold text-primary tracking-tight' },
                        formatVND(BigInt(latestQuote.total_amount))
                      )
                    : React.createElement(
                        'span',
                        {
                          className:
                            'text-lg font-bold text-warning bg-warning-bg px-2.5 py-1 rounded inline-block',
                        },
                        'Chưa báo'
                      )
                )
              ),

              // Card Body: Includes, Excludes, Terms
              React.createElement(
                'div',
                { className: 'p-5 space-y-4 text-sm' },
                // Includes & Excludes
                (latestQuote.includes.length > 0 || latestQuote.excludes.length > 0) &&
                  React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                    latestQuote.includes.length > 0 &&
                      React.createElement(
                        'div',
                        { className: 'space-y-1.5' },
                        React.createElement(
                          'p',
                          { className: 'text-xs font-semibold text-success flex items-center gap-1.5' },
                          React.createElement(Check, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
                          'Hạng mục bao gồm:'
                        ),
                        React.createElement(
                          'ul',
                          { className: 'space-y-1 text-xs text-text-main pl-5 list-disc' },
                          latestQuote.includes.map((inc, i) =>
                            React.createElement('li', { key: i }, inc)
                          )
                        )
                      ),
                    latestQuote.excludes.length > 0 &&
                      React.createElement(
                        'div',
                        { className: 'space-y-1.5' },
                        React.createElement(
                          'p',
                          { className: 'text-xs font-semibold text-text-muted flex items-center gap-1.5' },
                          React.createElement(X, { className: 'w-4 h-4 text-danger', 'aria-hidden': 'true' }),
                          'Chưa bao gồm / Phát sinh:'
                        ),
                        React.createElement(
                          'ul',
                          { className: 'space-y-1 text-xs text-text-muted pl-5 list-disc' },
                          latestQuote.excludes.map((exc, i) =>
                            React.createElement('li', { key: i }, exc)
                          )
                        )
                      )
                  ),

                // Deposit & Terms
                (latestQuote.deposit_conditions || latestQuote.terms) &&
                  React.createElement(
                    'div',
                    { className: 'p-3 bg-[#FAF9F5] rounded border border-border-subtle text-xs space-y-1 text-text-muted' },
                    latestQuote.deposit_conditions &&
                      React.createElement(
                        'p',
                        null,
                        React.createElement('strong', { className: 'text-text-main' }, 'Điều kiện cọc: '),
                        latestQuote.deposit_conditions
                      ),
                    latestQuote.terms &&
                      React.createElement(
                        'p',
                        null,
                        React.createElement('strong', { className: 'text-text-main' }, 'Điều khoản: '),
                        latestQuote.terms
                      )
                  )
              ),

              // Card Footer: Actions and Version History Expander
              React.createElement(
                'div',
                {
                  className:
                    'px-5 py-3.5 bg-[#FAF9F5]/70 border-t border-border-subtle flex items-center justify-between gap-3 flex-wrap',
                },
                // Version History Button (if older versions exist)
                olderQuotes.length > 0
                  ? React.createElement(
                      'button',
                      {
                        type: 'button',
                        onClick: () => toggleHistory(groupId),
                        className:
                          'inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-main py-1 px-2 rounded hover:bg-black/5',
                      },
                      React.createElement(History, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' }),
                      `Lịch sử phiên bản (${olderQuotes.length} bản cũ)`,
                      isHistoryOpen
                        ? React.createElement(ChevronUp, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' })
                        : React.createElement(ChevronDown, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' })
                    )
                  : React.createElement(
                      'span',
                      { className: 'text-xs text-text-muted/60' },
                      'Phiên bản ban đầu v1'
                    ),

                // Action buttons on latest quote
                React.createElement(
                  'div',
                  { className: 'flex items-center gap-2.5 ml-auto' },
                  // Revise button (AT24)
                  React.createElement(
                    Button,
                    {
                      variant: 'secondary',
                      size: 'sm',
                      onClick: () => setActiveReviseQuote(latestQuote),
                      leftIcon: React.createElement(GitBranch, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' }),
                    },
                    'Tạo phiên bản mới (v' + (latestQuote.version_number + 1) + ')'
                  ),

                  // Convert to Cost Item button (FL14, AT23)
                  latestQuote.is_selected
                    ? React.createElement(
                        Link,
                        {
                          href: '/budget',
                          className:
                            'inline-flex items-center justify-center font-medium rounded-control h-11 px-3 py-1.5 text-sm bg-success-bg text-success border border-success/30 hover:bg-success/20 min-h-[44px]',
                        },
                        'Mở khoản chi',
                        React.createElement(ExternalLink, { className: 'w-3.5 h-3.5 ml-1.5', 'aria-hidden': 'true' })
                      )
                    : React.createElement(
                        Button,
                        {
                          variant: 'primary',
                          size: 'sm',
                          onClick: () => setActiveConvertQuote(latestQuote),
                        },
                        'Tạo khoản chi từ báo giá'
                      )
                )
              ),

              // Older superseded versions drawer (AT24: immutable history view)
              olderQuotes.length > 0 &&
                isHistoryOpen &&
                React.createElement(
                  'div',
                  {
                    className:
                      'p-4 bg-[#F2F1EA] border-t border-border-control/40 space-y-3',
                    role: 'region',
                    'aria-label': 'Lịch sử các phiên bản cũ',
                  },
                  React.createElement(
                    'p',
                    { className: 'text-xs font-semibold text-text-muted uppercase tracking-wider' },
                    'Các phiên bản hợp đồng cũ đã lưu vết (Chỉ đọc — Không thể sửa đè)'
                  ),
                  olderQuotes.map((oldQuote) =>
                    React.createElement(
                      'div',
                      {
                        key: oldQuote.id,
                        className:
                          'p-3.5 bg-surface rounded border border-border-subtle/80 text-xs space-y-1.5 opacity-90',
                      },
                      React.createElement(
                        'div',
                        { className: 'flex items-center justify-between' },
                        React.createElement(
                          'div',
                          { className: 'flex items-center gap-2' },
                          React.createElement(
                            'span',
                            { className: 'font-bold px-1.5 py-0.5 rounded bg-gray-200 text-text-muted' },
                            `v${oldQuote.version_number} (Cũ)`
                          ),
                          React.createElement(
                            'span',
                            { className: 'font-semibold text-text-main' },
                            oldQuote.quote_name
                          )
                        ),
                        React.createElement(
                          'span',
                          { className: 'font-semibold text-text-muted' },
                          oldQuote.total_amount
                            ? formatVND(BigInt(oldQuote.total_amount))
                            : 'Chưa báo'
                        )
                      ),
                      React.createElement(
                        'p',
                        { className: 'text-[11px] text-text-muted' },
                        `Nhận ngày: ${oldQuote.received_date} • Tạo lúc: ${new Date(
                          oldQuote.created_at
                        ).toLocaleDateString('vi-VN')}`
                      ),
                      oldQuote.terms &&
                        React.createElement(
                          'p',
                          { className: 'text-[11px] text-text-muted italic' },
                          `Ghi chú: ${oldQuote.terms}`
                        )
                    )
                  )
                )
            );
          })
        ),

    // Revise Quote Modal
    activeReviseQuote &&
      React.createElement(ReviseQuoteModal, {
        isOpen: Boolean(activeReviseQuote),
        onClose: () => setActiveReviseQuote(null),
        vendorId,
        baseQuote: activeReviseQuote,
        onSuccess: handleReviseSuccess,
      }),

    // Quote to Cost Preview Modal
    activeConvertQuote &&
      React.createElement(QuoteToCostPreviewModal, {
        isOpen: Boolean(activeConvertQuote),
        onClose: () => setActiveConvertQuote(null),
        vendorId,
        quoteId: activeConvertQuote.id,
        onSuccess: handleConvertSuccess,
      })
  );
};
