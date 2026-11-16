'use client';

import * as React from 'react';
import { TableItem, GuestSeatingItem } from './types';
import { AlertTriangle, Users, ShieldAlert } from 'lucide-react';

const h = React.createElement;

export interface SeatingConflictAlertsProps {
  tables: TableItem[];
  guests: GuestSeatingItem[];
  className?: string;
}

export interface SplitFamilyInfo {
  groupName: string;
  seatedTableNames: string[];
  unseatedGuestNames: string[];
}

export const SeatingConflictAlerts: React.FC<SeatingConflictAlertsProps> = ({
  tables,
  guests,
  className = '',
}) => {
  // 1. Unseated confirmed guests
  const unseatedConfirmed = guests.filter(
    (g) => !g.tableId && g.rsvpStatus !== 'declined'
  );

  // 2. Split family detection (AT06/AT09)
  const familyGroups: Record<string, GuestSeatingItem[]> = {};
  guests.forEach((g) => {
    if (!familyGroups[g.groupName]) {
      familyGroups[g.groupName] = [];
    }
    familyGroups[g.groupName].push(g);
  });

  const splitFamilies: SplitFamilyInfo[] = [];
  Object.entries(familyGroups).forEach(([groupName, groupMembers]) => {
    if (groupMembers.length <= 1) return;

    const seatedTables = new Set<string>();
    const unseatedGuests: string[] = [];

    groupMembers.forEach((member) => {
      if (member.tableId) {
        const tbl = tables.find((t) => t.id === member.tableId);
        if (tbl) seatedTables.add(tbl.name);
      } else {
        unseatedGuests.push(member.name);
      }
    });

    // A family is split if seated across >1 table, or if partially seated and partially unseated
    const isSplit =
      seatedTables.size > 1 || (seatedTables.size === 1 && unseatedGuests.length > 0);

    if (isSplit) {
      splitFamilies.push({
        groupName,
        seatedTableNames: Array.from(seatedTables),
        unseatedGuestNames: unseatedGuests,
      });
    }
  });

  // 3. Overcapacity tables (AT21)
  const overcapacityTables = tables.filter((tbl) => {
    // Count guests that actually need seats (AT07 infant logic)
    const seatedCount = tbl.seatedGuestIds.filter((guestId) => {
      const g = guests.find((x) => x.id === guestId);
      return g?.needsSeat !== false;
    }).length;
    return seatedCount > tbl.capacity;
  });

  const hasAnyConflict =
    unseatedConfirmed.length > 0 ||
    splitFamilies.length > 0 ||
    overcapacityTables.length > 0;

  if (!hasAnyConflict) return null;

  return h(
    'div',
    { className: `space-y-3 ${className}`, 'data-testid': 'seating-conflict-alerts' },

    // Overcapacity warning (AT21)
    overcapacityTables.length > 0 &&
      h(
        'div',
        {
          className:
            'p-3.5 bg-danger-bg border border-danger/40 rounded-card flex items-start gap-3 text-sm text-danger',
          role: 'alert',
        },
        h(ShieldAlert, { className: 'w-5 h-5 shrink-0 mt-0.5 text-danger' }),
        h(
          'div',
          null,
          h(
            'p',
            { className: 'font-bold' },
            `Cảnh báo quá tải sức chứa bàn (${overcapacityTables.length} bàn vượt số ghế)`
          ),
          h(
            'ul',
            { className: 'list-disc list-inside text-xs mt-1 space-y-0.5' },
            overcapacityTables.map((tbl) => {
              const seatedCount = tbl.seatedGuestIds.filter((guestId) => {
                const g = guests.find((x) => x.id === guestId);
                return g?.needsSeat !== false;
              }).length;
              return h(
                'li',
                { key: tbl.id },
                `${tbl.name}: Đang xếp ${seatedCount} người / ${tbl.capacity} ghế (vượt ${
                  seatedCount - tbl.capacity
                } ghế)`
              );
            })
          )
        )
      ),

    // Split families alert (AT06 / AT09)
    splitFamilies.length > 0 &&
      h(
        'div',
        {
          className:
            'p-3.5 bg-[#FFFBEB] border border-[#F59E0B] rounded-card flex items-start gap-3 text-sm text-[#92400E]',
          role: 'alert',
        },
        h(AlertTriangle, { className: 'w-5 h-5 shrink-0 mt-0.5 text-[#D97706]' }),
        h(
          'div',
          null,
          h(
            'p',
            { className: 'font-bold' },
            `Cảnh báo tách gia đình (${splitFamilies.length} nhóm thiệp chưa ngồi cùng bàn)`
          ),
          h(
            'ul',
            { className: 'list-disc list-inside text-xs mt-1 space-y-1' },
            splitFamilies.map((sf) =>
              h(
                'li',
                { key: sf.groupName },
                h('span', { className: 'font-semibold' }, `${sf.groupName}: `),
                sf.seatedTableNames.length > 0
                  ? `Đang ngồi tại ${sf.seatedTableNames.join(', ')}`
                  : 'Chưa xếp bàn',
                sf.unseatedGuestNames.length > 0 &&
                  ` (${sf.unseatedGuestNames.join(', ')} chưa được xếp)`
              )
            )
          )
        )
      ),

    // Unseated confirmed guests alert
    unseatedConfirmed.length > 0 &&
      h(
        'div',
        {
          className:
            'p-3 bg-[#EFF6FF] border border-[#93C5FD] rounded-card flex items-center justify-between text-xs text-[#1E40AF]',
        },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(Users, { className: 'w-4 h-4 text-[#2563EB] shrink-0' }),
          h(
            'span',
            null,
            `Có `,
            h('span', { className: 'font-bold' }, `${unseatedConfirmed.length} khách xác nhận tham dự`),
            ` chưa được phân bổ vào bàn tiệc.`
          )
        )
      )
  );
};
