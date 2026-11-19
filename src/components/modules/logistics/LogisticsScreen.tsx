'use client';

import * as React from 'react';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';
import { Hotel, Bus, Plus, ShieldCheck } from 'lucide-react';
import { Accommodation, RoomAssignment, TransportTrip, TripPassengerItem } from './types';
import {
  INITIAL_ACCOMMODATIONS,
  INITIAL_ROOM_ASSIGNMENTS,
  INITIAL_TRANSPORT_TRIPS,
} from './fixtures';
import { AccommodationsTab } from './AccommodationsTab';
import { TransportTripsTab } from './TransportTripsTab';
import { AssignPassengerModal } from './AssignPassengerModal';
import { CapacityReductionWarningModal } from './CapacityReductionWarningModal';

export * from './types';
export * from './fixtures';
export * from './AccommodationsTab';
export * from './TransportTripsTab';
export * from './AssignPassengerModal';
export * from './CapacityReductionWarningModal';

const h = React.createElement;

export interface LogisticsScreenProps {
  initialState?: PrototypeState;
  initialAccommodations?: Accommodation[];
  initialRoomAssignments?: RoomAssignment[];
  initialTrips?: TransportTrip[];
}

export const LogisticsScreen: React.FC<LogisticsScreenProps> = ({
  initialState = 'populated',
  initialAccommodations = INITIAL_ACCOMMODATIONS,
  initialRoomAssignments = INITIAL_ROOM_ASSIGNMENTS,
  initialTrips = INITIAL_TRANSPORT_TRIPS,
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default to owner in isolation
  }
  const { isOwner, isFamily, canMutate } = roleContext;

  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [activeTab, setActiveTab] = React.useState<'accommodations' | 'transport'>('transport');
  const [accommodations, setAccommodations] = React.useState<Accommodation[]>(initialAccommodations);
  const [roomAssignments, setRoomAssignments] = React.useState<RoomAssignment[]>(initialRoomAssignments);
  const [trips, setTrips] = React.useState<TransportTrip[]>(initialTrips);

  // Modals
  const [assigningTrip, setAssigningTrip] = React.useState<TransportTrip | null>(null);
  const [reductionWarning, setReductionWarning] = React.useState<{
    currentCount: number;
    requestedCapacity: number;
  } | null>(null);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const handleAssignPassenger = (
    tripId: string,
    guest: { id: string; name: string; pickupPoint?: string }
  ) => {
    if (!canMutate) return;
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id === tripId) {
          const newPassenger: TripPassengerItem = {
            id: `p_${Date.now()}`,
            tripId,
            guestId: guest.id,
            guestName: guest.name,
            pickupPoint: guest.pickupPoint,
          };
          return { ...t, passengers: [...t.passengers, newPassenger] };
        }
        return t;
      })
    );
  };

  const handleRemovePassenger = (tripId: string, guestId: string) => {
    if (!canMutate) return;
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? { ...t, passengers: t.passengers.filter((p) => p.guestId !== guestId) }
          : t
      )
    );
  };

  const handleDeleteRoomAssignment = (assignmentId: string) => {
    if (!canMutate) return;
    setRoomAssignments((prev) => prev.filter((ra) => ra.id !== assignmentId));
  };

  const loadingSkeleton = h(
    'div',
    { className: 'space-y-4 animate-pulse', role: 'status', 'aria-label': 'Đang tải hậu cần' },
    h('div', { className: 'h-12 bg-border-subtle rounded-control' }),
    h('div', { className: 'h-48 bg-border-subtle rounded-card' }),
    h('div', { className: 'h-48 bg-border-subtle rounded-card' })
  );

  return h(
    StateWrapper,
    {
      state,
      loadingSkeleton,
      emptyTitle: 'Chưa có thông tin lưu trú hoặc chuyến xe nào',
      emptyDescription: 'Thêm địa điểm khách sạn hoặc chuyến xe đưa đón để bắt đầu quản lý hậu cần.',
      emptyActionLabel: isOwner ? '+ Thêm chuyến xe đầu tiên' : undefined,
      onEmptyAction: isOwner
        ? () => {
            setTrips(INITIAL_TRANSPORT_TRIPS);
            setAccommodations(INITIAL_ACCOMMODATIONS);
            setState('populated');
          }
        : undefined,
      errorTitle: 'Không thể tải dữ liệu lưu trú & xe',
      errorMessage: 'Lỗi đồng bộ dữ liệu hậu cần từ máy chủ.',
      errorRequestId: 'REQ-20261116-LOGISTICS-ERR',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không có kết quả hậu cần phù hợp',
      filteredDescription: 'Hãy thử chọn tab hoặc danh mục khác.',
      onClearFilter: () => setState('populated'),
      permissionDeniedMessage: 'Bạn không có quyền chỉnh sửa thông tin hậu cần.',
    },
    h(
      'div',
      { className: 'space-y-6 max-w-7xl mx-auto' },

      // Header Toolbar
      h(
        'div',
        { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Lưu Trú & Di Chuyển Ngày Cưới'),
          h(
            'p',
            { className: 'text-sm text-text-muted mt-0.5' },
            isFamily
              ? 'Chế độ Người nhà (family_view): Chỉ xem lịch trình chuyến xe và danh sách phòng lưu trú'
              : 'Điều phối khách sạn cho khách ở xa và các chuyến xe đưa đón sảnh tiệc'
          )
        )
      ),

      // Navigation Tabs: Accommodations vs Transport Trips
      h(
        'div',
        { className: 'flex items-center gap-2 border-b border-border-subtle pb-1' },
        h(
          'button',
          {
            type: 'button',
            onClick: () => setActiveTab('transport'),
            className: `px-4 py-2 rounded-t-control text-xs font-semibold flex items-center gap-2 transition-all border-b-2 ${
              activeTab === 'transport'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-muted hover:text-text-main hover:bg-page'
            }`,
          },
          h(Bus, { className: 'w-4 h-4' }),
          'Chuyến Xe Đưa Đón',
          h(
            'span',
            { className: 'text-[11px] px-1.5 py-0.2 rounded-full bg-border-subtle/60 font-mono' },
            trips.length
          )
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: () => setActiveTab('accommodations'),
            className: `px-4 py-2 rounded-t-control text-xs font-semibold flex items-center gap-2 transition-all border-b-2 ${
              activeTab === 'accommodations'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-muted hover:text-text-main hover:bg-page'
            }`,
          },
          h(Hotel, { className: 'w-4 h-4' }),
          'Địa Điểm Lưu Trú',
          h(
            'span',
            { className: 'text-[11px] px-1.5 py-0.2 rounded-full bg-border-subtle/60 font-mono' },
            accommodations.length
          )
        )
      ),

      // Active Tab Content
      activeTab === 'transport'
        ? h(TransportTripsTab, {
            trips,
            onOpenAssignModal: (trip) => setAssigningTrip(trip),
            onRemovePassenger: handleRemovePassenger,
          })
        : h(AccommodationsTab, {
            accommodations,
            roomAssignments,
            onDeleteAssignment: handleDeleteRoomAssignment,
          }),

      // Modals
      assigningTrip &&
        isOwner &&
        h(AssignPassengerModal, {
          isOpen: Boolean(assigningTrip),
          onClose: () => setAssigningTrip(null),
          trip: assigningTrip,
          onAssignPassenger: handleAssignPassenger,
        }),

      reductionWarning &&
        h(CapacityReductionWarningModal, {
          isOpen: Boolean(reductionWarning),
          onClose: () => setReductionWarning(null),
          currentCount: reductionWarning.currentCount,
          requestedCapacity: reductionWarning.requestedCapacity,
        })
    )
  );
};
