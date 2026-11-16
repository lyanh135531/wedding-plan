'use client';

import * as React from 'react';
import { TransportTrip } from './types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

const h = React.createElement;

export interface AssignPassengerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TransportTrip | null;
  onAssignPassenger: (tripId: string, guest: { id: string; name: string; pickupPoint?: string }) => void;
  availableGuests?: { id: string; name: string }[];
}

export const AssignPassengerModal: React.FC<AssignPassengerModalProps> = ({
  isOpen,
  onClose,
  trip,
  onAssignPassenger,
  availableGuests = [
    { id: 'g_new_01', name: 'Nguyễn Văn Minh' },
    { id: 'g_new_02', name: 'Lê Thị Thu' },
    { id: 'g_new_03', name: 'Hoàng Quốc Việt' },
  ],
}) => {
  const [selectedGuestId, setSelectedGuestId] = React.useState('');
  const [pickupPoint, setPickupPoint] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedGuestId(availableGuests[0]?.id || '');
    setPickupPoint('');
    setError(null);
  }, [trip, isOpen]);

  if (!isOpen || !trip) return null;

  const isFull = trip.passengers.length >= trip.capacity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFull) {
      setError('Chuyến xe đã đủ chỗ, không thể phân bổ thêm khách (Lỗi sức chứa AT21).');
      return;
    }
    const guest = availableGuests.find((g) => g.id === selectedGuestId);
    if (!guest) {
      setError('Vui lòng chọn khách mời.');
      return;
    }

    onAssignPassenger(trip.id, {
      id: guest.id,
      name: guest.name,
      pickupPoint: pickupPoint.trim() || undefined,
    });
    onClose();
  };

  return h(
    Dialog,
    {
      isOpen,
      onClose,
      title: `Gán Khách Lên Chuyến Xe: ${trip.name}`,
    },
    h(
      'form',
      { onSubmit: handleSubmit, className: 'space-y-4 text-xs' },

      // Capacity alert if full (AT21)
      isFull &&
        h(
          'div',
          {
            className:
              'p-3 bg-danger-bg border border-danger/40 rounded-control flex items-start gap-2 text-danger font-semibold',
            role: 'alert',
          },
          h(ShieldAlert, { className: 'w-4 h-4 shrink-0 mt-0.5' }),
          h(
            'span',
            null,
            `Chuyến xe đã đủ chỗ (${trip.passengers.length}/${trip.capacity} chỗ). Hệ thống chặn gán thêm khách để tránh quá tải theo yêu cầu AT21.`
          )
        ),

      error &&
        h(
          'div',
          { className: 'p-2.5 bg-danger-bg text-danger rounded border border-danger/40' },
          error
        ),

      // Guest selector
      h(
        'div',
        { className: 'space-y-1' },
        h('label', { className: 'block font-semibold text-text-main' }, 'Chọn khách mời cần gán xe *'),
        h(
          'select',
          {
            value: selectedGuestId,
            disabled: isFull,
            onChange: (e: any) => setSelectedGuestId(e.target.value),
            className:
              'w-full h-10 px-3 border border-border-control rounded-control text-xs bg-white text-text-main focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed',
          },
          availableGuests.map((g) =>
            h('option', { key: g.id, value: g.id }, g.name)
          )
        )
      ),

      // Pickup point
      h(
        'div',
        { className: 'space-y-1' },
        h('label', { className: 'block font-semibold text-text-main' }, 'Điểm đón cụ thể (tùy chọn)'),
        h('input', {
          className:
            'w-full h-10 px-3 border border-border-control rounded-control text-xs bg-white text-text-main focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed',
          value: pickupPoint,
          disabled: isFull,
          onChange: (e: any) => setPickupPoint(e.target.value),
          placeholder: 'Ví dụ: Đón tại Cột 10 Sân bay hoặc Khách sạn Grand Plaza',
        })
      ),

      // Actions
      h(
        'div',
        { className: 'flex items-center justify-end gap-2 pt-3 border-t border-border-subtle' },
        h(
          Button,
          {
            type: 'button',
            variant: 'secondary',
            onClick: onClose,
            className: 'text-xs',
          },
          'Hủy'
        ),
        h(
          Button,
          {
            type: 'submit',
            variant: 'primary',
            disabled: isFull,
            className: 'text-xs',
          },
          'Xác nhận gán xe'
        )
      )
    )
  );
};
