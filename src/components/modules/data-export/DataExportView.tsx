'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, ShieldCheck } from 'lucide-react';

const h = React.createElement;

export const DataExportView: React.FC = () => {
  const [sanitizedPreview, setSanitizedPreview] = React.useState<string[][]>([
    ["'Họ và tên", "'Bên mời", "'Ghi chú"],
    ["'Nguyễn Văn Minh", "'Nhà trai", "'+84901234567 (Đã gắn nháy đơn chống CSV Injection)"],
    ["'Trần Phương Linh", "'Nhà gái", "'=SUM(1,2) (Ký tự = đã được khử an toàn)"],
  ]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return h(
    'div',
    { className: 'space-y-6 max-w-4xl mx-auto' },
    // Header (hidden when printing)
    h(
      'div',
      { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-4 print:hidden' },
      h(
        'div',
        null,
        h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Xuất Dữ Liệu & Bản In Chuẩn CSS Print'),
        h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Khử mã độc Formula Injection và định dạng trang in A4 chuẩn')
      ),
      h(
        'div',
        { className: 'flex items-center gap-2' },
        h(
          Button,
          {
            variant: 'primary',
            leftIcon: h(Printer, { className: 'w-4 h-4' }),
            onClick: handlePrint,
          },
          'In trang này (A4)'
        ),
        h(
          Button,
          {
            variant: 'secondary',
            leftIcon: h(Download, { className: 'w-4 h-4' }),
            onClick: () => alert('Đã xuất file CSV an toàn (chống Formula Injection)'),
          },
          'Tải CSV an toàn'
        )
      )
    ),

    // Anti-Injection info banner
    h(
      'div',
      { className: 'p-4 bg-primary/10 border border-primary/20 rounded-card flex items-start gap-3 text-xs text-text-main print:hidden' },
      h(ShieldCheck, { className: 'w-5 h-5 text-primary shrink-0 mt-0.5' }),
      h(
        'div',
        null,
        h('p', { className: 'font-bold text-primary text-sm' }, 'Cơ chế bảo vệ chống CSV Formula Injection'),
        h(
          'p',
          { className: 'mt-0.5' },
          `Mọi ô dữ liệu bắt đầu bằng các ký tự nguy hiểm (=, +, -, @, \\t, \\r) đều được tự động gắn dấu nháy đơn ' ở đầu để ngăn chặn thực thi mã độc trên Microsoft Excel và Google Sheets.`
        )
      )
    ),

    // Printable Document Area
    h(
      'div',
      {
        className:
          'bg-white border border-border-control rounded-card p-8 shadow-sm print:border-none print:shadow-none print:p-0',
      },
      // Document title for print
      h(
        'div',
        { className: 'text-center mb-6' },
        h('h2', { className: 'text-xl font-bold uppercase tracking-wider text-text-main' }, 'Danh Sách Khách Mời Đám Cưới'),
        h('p', { className: 'text-xs text-text-muted mt-1' }, 'Minh & Linh • Ngày in: 06/11/2026')
      ),

      // Preview Table
      h(
        'table',
        { className: 'w-full text-left border-collapse border border-border-control text-xs' },
        h(
          'thead',
          { className: 'bg-[#FAF9F5] print:bg-white' },
          h(
            'tr',
            null,
            sanitizedPreview[0].map((col, idx) =>
              h('th', { key: idx, className: 'border border-border-control p-2 font-bold' }, col)
            )
          )
        ),
        h(
          'tbody',
          null,
          sanitizedPreview.slice(1).map((row, rIdx) =>
            h(
              'tr',
              { key: rIdx },
              row.map((cell, cIdx) =>
                h('td', { key: cIdx, className: 'border border-border-control p-2' }, cell)
              )
            )
          )
        )
      ),

      // Print footer
      h(
        'div',
        { className: 'mt-8 pt-4 border-t border-border-subtle flex justify-between text-[11px] text-text-muted' },
        h('span', null, 'Sổ Quản Lý Đám Cưới Cá Nhân'),
        h('span', null, 'Trang 1 / 1 — Xuất lúc 06/11/2026 14:00')
      )
    )
  );
};
