'use client';

import * as React from 'react';
import { TransportTrip, TripPassengerItem } from './types';
import { useRole } from '@/context/RoleContext';
import { Bus, Car, Clock, MapPin, Phone, FileText, UserPlus, Trash2, ShieldAlert, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const h = React.createElement;

export interface TransportTripsTabProps {
  trips: TransportTrip[];
  onOpenAssignModal?: (trip: TransportTrip) => void;
  onRemovePassenger?: (tripId: string, guestId: string) => void;
  className?: string;
}

export const TransportTripsTab: React.FC<TransportTripsTabProps> = ({
  trips,
  onOpenAssignModal,
  onRemovePassenger,
  className = '',
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default to owner in isolation
  }
  const { isOwner, isFamily, canMutate } = roleContext;

  return h(
    'div',
    { className: `space-y-6 ${className}`, 'data-testid': 'transport-trips-tab' },

    // Header Toolbar
    h(
      'div',
      { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border-subtle' },
      h(
        'div',
        null,
        h('h3', { className: 'text-base font-bold text-text-main' }, 'Lịch Trình Chuyến Xe Đưa Đón'),
        h(
          'p',
          { className: 'text-xs text-text-muted mt-0.5' },
          'Phân bổ danh sách khách theo từng chuyến xe, theo dõi sức chứa và điểm đón trả'
        )
      )
    ),

    // Trips List
    trips.map((trip) => {
      const passengerCount = trip.passengers.length;
      const isFull = passengerCount >= trip.capacity;
      const isOverloaded = passengerCount > trip.capacity;
      const percentOccupied = Math.min(100, Math.round((passengerCount / trip.capacity) * 100));

      return h(
        'div',
        {
          key: trip.id,
          'data-testid': `transport-trip-card-${trip.id}`,
          className: `bg-surface border rounded-card shadow-sm p-4 space-y-4 transition-all ${
            isOverloaded
              ? 'border-danger/60 ring-2 ring-danger/20'
              : 'border-border-subtle'
          }`,
        },

        // Trip Header
        h(
          'div',
          { className: 'flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-border-subtle pb-3' },
          h(
            'div',
            { className: 'space-y-1.5' },
            h(
              'div',
              { className: 'flex items-center gap-2 flex-wrap' },
              h(Bus, { className: 'w-4 h-4 text-primary shrink-0' }),
              h('h4', { className: 'font-bold text-sm text-text-main' }, trip.name),
              h(
                'span',
                { className: 'text-[11px] px-2 py-0.5 rounded font-medium bg-primary/10 text-primary' },
                trip.vehicleType === 'shuttle_bus'
                  ? 'Xe buýt đưa đón'
                  : trip.vehicleType === 'van'
                  ? 'Xe 16 chỗ'
                  : 'Xe con'
              )
            ),

            // Time & Route
            h(
              'div',
              { className: 'grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-text-muted' },
              h(
                'div',
                { className: 'flex items-center gap-1.5' },
                h(Clock, { className: 'w-3.5 h-3.5 text-text-muted shrink-0' }),
                h('span', null, `Khởi hành: ${trip.departureTime}`)
              ),
              h(
                'div',
                { className: 'flex items-center gap-1.5' },
                h(MapPin, { className: 'w-3.5 h-3.5 text-text-muted shrink-0' }),
                h('span', null, `Điểm đón: ${trip.departureLocation}`)
              )
            ),

            // Driver contact: Owner only per AT03/AT26
            isOwner &&
              trip.driverContact &&
              h(
                'div',
                { className: 'flex items-center gap-1.5 text-xs text-text-main font-medium' },
                h(Phone, { className: 'w-3.5 h-3.5 text-primary shrink-0' }),
                `Đầu mối xe: ${trip.driverContact}`
              ),

            // Notes: Owner only
            isOwner &&
              trip.notes &&
              h(
                'div',
                { className: 'flex items-center gap-1.5 text-xs text-[#B45309] italic' },
                h(FileText, { className: 'w-3.5 h-3.5 shrink-0' }),
                trip.notes
              )
          ),

          // Capacity Bar & Badge
          h(
            'div',
            { className: 'w-full md:w-56 space-y-1.5 self-start' },
            h(
              'div',
              { className: 'flex justify-between items-center text-xs' },
              h('span', { className: 'text-text-muted font-medium' }, 'Sức chứa xe:'),
              h(
                'span',
                {
                  className: `font-mono font-bold ${
                    isOverloaded
                      ? 'text-danger'
                      : isFull
                      ? 'text-[#D97706]'
                      : 'text-primary'
                  }`,
                },
                `${passengerCount} / ${trip.capacity} chỗ`
              )
            ),

            // Progress bar
            h(
              'div',
              { className: 'w-full h-2 bg-border-subtle rounded-full overflow-hidden' },
              h('div', {
                className: `h-full rounded-full transition-all ${
                  isOverloaded
                    ? 'bg-danger'
                    : isFull
                    ? 'bg-[#F59E0B]'
                    : 'bg-primary'
                }`,
                style: { width: `${percentOccupied}%` },
              })
            ),

            // Overload warning or Full badge (AT21)
            isOverloaded
              ? h(
                  'div',
                  {
                    className:
                      'text-[11px] font-bold text-danger flex items-center gap-1 bg-danger-bg p-1 rounded',
                  },
                  h(ShieldAlert, { className: 'w-3 h-3 shrink-0' }),
                  `Cảnh báo quá tải xe (vượt ${passengerCount - trip.capacity} chỗ)!`
                )
              : isFull
              ? h(
                  'div',
                  { className: 'text-[11px] font-semibold text-[#B45309] bg-[#FFFBEB] p-1 rounded text-center' },
                  'Xe đã đủ chỗ'
                )
              : null
          )
        ),

        // Passengers List
        h(
          'div',
          { className: 'space-y-2' },
          h(
            'div',
            { className: 'flex items-center justify-between' },
            h(
              'h5',
              { className: 'text-xs font-bold uppercase tracking-wider text-text-muted' },
              `Danh Sách Hành Khách (${passengerCount} người):`
            ),

            // Assign passenger button: Owner only
            isOwner &&
              onOpenAssignModal &&
              h(
                'button',
                {
                  type: 'button',
                  disabled: isFull,
                  onClick: () => onOpenAssignModal(trip),
                  className: `text-xs font-semibold flex items-center gap-1 ${
                    isFull
                      ? 'text-text-muted cursor-not-allowed opacity-60'
                      : 'text-primary hover:text-primary/80 hover:underline'
                  }`,
                },
                h(UserPlus, { className: 'w-3 h-3' }),
                isFull ? 'Xe đã đầy' : 'Gán khách lên xe'
              )
          ),

          passengerCount === 0
            ? h(
                'p',
                { className: 'text-xs text-text-muted italic py-2' },
                'Chưa có hành khách nào được xếp vào chuyến này.'
              )
            : h(
                'div',
                { className: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2' },
                trip.passengers.map((p) =>
                  h(
                    'div',
                    {
                      key: p.id,
                      'data-testid': `trip-passenger-${p.id}`,
                      className:
                        'p-2 bg-[#FAF9F5] border border-border-subtle rounded-control flex items-center justify-between gap-2 text-xs',
                    },
                    h(
                      'div',
                      { className: 'space-y-0.5' },
                      h('p', { className: 'font-semibold text-text-main' }, p.guestName),
                      p.pickupPoint &&
                        h('p', { className: 'text-[11px] text-text-muted' }, `Đón tại: ${p.pickupPoint}`),
                      // Passenger contact phone: Owner only per AT03/AT26
                      isOwner &&
                        p.guestPhone &&
                        h(
                          'p',
                          { className: 'text-[10px] text-text-muted flex items-center gap-0.5' },
                          h(Phone, { className: 'w-2.5 h-2.5' }),
                          p.guestPhone
                        )
                    ),

                    // Remove passenger: Owner only
                    isOwner &&
                      onRemovePassenger &&
                      h(
                        'button',
                        {
                          type: 'button',
                          onClick: () => onRemovePassenger(trip.id, p.guestId),
                          className:
                            'text-text-muted hover:text-danger p-1 rounded hover:bg-danger-bg text-xs shrink-0',
                          title: 'Gỡ khách khỏi chuyến',
                        },
                        '✕'
                      )
                  )
                )
              )
        )
      );
    })
  );
};
