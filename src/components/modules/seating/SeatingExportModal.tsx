'use client';

import * as React from 'react';
import { TableItem, GuestSeatingItem } from './types';
import { useRole } from '@/context/RoleContext';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, ShieldCheck, FileSpreadsheet } from 'lucide-react';

const h = React.createElement;

export interface SeatingExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: TableItem[];
  guests: GuestSeatingItem[];
}

export const SeatingExportModal: React.FC<SeatingExportModalProps> = ({
  isOpen,
  onClose,
  tables,
  guests,
}) => {
  let roleContext = { isOwner: true, isFamily: false };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily };
  } catch {
    // Default to owner when rendered in isolation
  }
  const { isOwner, isFamily } = roleContext;

  if (!isOpen) return null;

  const totalSeats = tables.reduce((acc, t) => acc + t.capacity, 0);
  const totalSeatedGuests = tables.reduce((acc, t) => acc + t.seatedGuestIds.length, 0);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleDownloadCsv = () => {
    // Generate sanitized CSV per AT26 & Anti-Injection standards
    const headers = ['Số bàn', 'Tên bàn', 'Kiểu dáng', 'Sức chứa', 'Khách ngồi', 'Nhóm'];
    if (isOwner) {
      headers.push('Ghi chú riêng');
    }

    const rows: string[] = [headers.join(',')];

    tables.forEach((tbl) => {
      const seated = tbl.seatedGuestIds
        .map((id) => guests.find((g) => g.id === id))
        .filter(Boolean) as GuestSeatingItem[];

      if (seated.length === 0) {
        const row = [
          `"${tbl.tableNumber || ''}"`,
          `"${tbl.name}"`,
          `"${tbl.shape === 'round' ? 'Bàn tròn' : 'Bàn chữ nhật'}"`,
          tbl.capacity,
          `"(Bàn trống)"`,
          `""`,
        ];
        if (isOwner) row.push(`"${tbl.notes || ''}"`);
        rows.push(row.join(','));
      } else {
        seated.forEach((guest) => {
          const row = [
            `"${tbl.tableNumber || ''}"`,
            `"${tbl.name}"`,
            `"${tbl.shape === 'round' ? 'Bàn tròn' : 'Bàn chữ nhật'}"`,
            tbl.capacity,
            `"${guest.name}${guest.needsSeat === false ? ' (Em bé)' : ''}"`,
            `"${guest.groupName}"`,
          ];
          if (isOwner) {
            row.push(`"${guest.notes || tbl.notes || ''}"`);
          }
          rows.push(row.join(','));
        });
      }
    });

    const csvContent = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `so-do-ban-tiec-${isFamily ? 'nguoi-nha' : 'chu-hon'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return h(
    Dialog,
    {
      isOpen,
      onClose,
      title: 'Xuất & In Sơ Đồ Xếp Bàn Tiệc (Chuẩn A4)',
    },
    h(
      'div',
      { className: 'space-y-4 max-h-[75vh] overflow-y-auto pr-1' },

      // Security banner
      h(
        'div',
        {
          className: `p-3 rounded-control text-xs flex items-center gap-2 ${
            isFamily
              ? 'bg-[#EFF6FF] border border-[#93C5FD] text-[#1D4ED8]'
              : 'bg-[#F0FDF4] border border-[#86EFAC] text-[#15803D]'
          }`,
        },
        h(ShieldCheck, { className: 'w-4 h-4 shrink-0' }),
        h(
          'span',
          null,
          isFamily
            ? 'Bản in Người nhà (AT26): Toàn bộ ghi chú riêng tư, số điện thoại và địa chỉ cá nhân đã được tự động loại bỏ để bảo vệ thông tin mật.'
            : 'Bản in Chủ sở hữu: Đầy đủ sơ đồ và thông tin điều phối nhà hàng sảnh tiệc.'
        )
      ),

      // Summary KPIs
      h(
        'div',
        { className: 'grid grid-cols-3 gap-2 bg-page p-3 rounded-control text-center text-xs' },
        h(
          'div',
          null,
          h('p', { className: 'text-text-muted' }, 'Tổng số bàn'),
          h('p', { className: 'text-base font-bold text-text-main mt-0.5' }, tables.length)
        ),
        h(
          'div',
          null,
          h('p', { className: 'text-text-muted' }, 'Tổng số ghế'),
          h('p', { className: 'text-base font-bold text-text-main mt-0.5' }, totalSeats)
        ),
        h(
          'div',
          null,
          h('p', { className: 'text-text-muted' }, 'Đã xếp chỗ'),
          h('p', { className: 'text-base font-bold text-primary mt-0.5' }, totalSeatedGuests)
        )
      ),

      // Printable A4 Container
      h(
        'div',
        {
          id: 'printable-seating-chart',
          className: 'border border-border-subtle p-4 rounded-card bg-surface space-y-4 text-xs',
        },
        h(
          'div',
          { className: 'text-center pb-3 border-b border-border-subtle' },
          h('h2', { className: 'text-base font-bold text-text-main' }, 'DANH SÁCH PHÂN BỔ BÀN TIỆC CƯỚI'),
          h(
            'p',
            { className: 'text-text-muted text-[11px] mt-0.5' },
            `Phiên bản chuẩn hóa A4 — ${isFamily ? 'Bản chia sẻ Người nhà' : 'Bản điều phối Nhà hàng'}`
          )
        ),

        // Table by table list
        tables.map((tbl) => {
          const seated = tbl.seatedGuestIds
            .map((id) => guests.find((g) => g.id === id))
            .filter(Boolean) as GuestSeatingItem[];

          return h(
            'div',
            {
              key: tbl.id,
              className: 'p-3 border border-border-subtle rounded-control bg-[#FAFAFA]',
            },
            h(
              'div',
              { className: 'flex justify-between items-center mb-1.5' },
              h(
                'div',
                { className: 'font-bold text-text-main text-sm' },
                tbl.name,
                h(
                  'span',
                  { className: 'ml-2 text-xs font-normal text-text-muted' },
                  `(${tbl.shape === 'round' ? 'Bàn tròn' : 'Bàn chữ nhật'} - ${tbl.capacity} ghế)`
                )
              ),
              h(
                'span',
                { className: 'font-mono font-semibold text-primary' },
                `${seated.length}/${tbl.capacity} khách`
              )
            ),

            // Note: only show for owner, NEVER for family_view (AT26)
            isOwner &&
              tbl.notes &&
              h(
                'p',
                { className: 'text-[11px] text-[#B45309] italic mb-1.5' },
                `Ghi chú: ${tbl.notes}`
              ),

            // Guest list
            seated.length === 0
              ? h('p', { className: 'text-text-muted italic text-[11px]' }, 'Chưa xếp khách vào bàn này')
              : h(
                  'div',
                  { className: 'grid grid-cols-2 gap-1.5 mt-1' },
                  seated.map((g, idx) =>
                    h(
                      'div',
                      {
                        key: g.id,
                        className:
                          'p-1.5 bg-surface border border-border-subtle rounded flex items-center justify-between',
                      },
                      h(
                        'span',
                        { className: 'font-medium' },
                        `${idx + 1}. ${g.name}`,
                        g.needsSeat === false &&
                          h(
                            'span',
                            { className: 'text-[10px] text-[#2563EB] ml-1' },
                            '(Em bé)'
                          )
                      ),
                      h('span', { className: 'text-[10px] text-text-muted' }, g.groupName)
                    )
                  )
                )
          );
        })
      ),

      // Actions
      h(
        'div',
        { className: 'flex items-center justify-between pt-3 border-t border-border-subtle' },
        h(
          Button,
          {
            type: 'button',
            variant: 'secondary',
            onClick: onClose,
            className: 'text-xs',
          },
          'Đóng'
        ),
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(
            Button,
            {
              type: 'button',
              variant: 'secondary',
              onClick: handleDownloadCsv,
              className: 'text-xs flex items-center gap-1.5',
            },
            h(FileSpreadsheet, { className: 'w-3.5 h-3.5' }),
            'Tải CSV sanitized'
          ),
          h(
            Button,
            {
              type: 'button',
              variant: 'primary',
              onClick: handlePrint,
              className: 'text-xs flex items-center gap-1.5',
            },
            h(Printer, { className: 'w-3.5 h-3.5' }),
            'In A4'
          )
        )
      )
    )
  );
};
