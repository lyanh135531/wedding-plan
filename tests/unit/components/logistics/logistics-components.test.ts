import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import {
  LogisticsScreen,
  AccommodationsTab,
  TransportTripsTab,
  AssignPassengerModal,
  CapacityReductionWarningModal,
  Accommodation,
  RoomAssignment,
  TransportTrip,
} from '@/components/modules/logistics';

const h = React.createElement;

describe('S20: Logistics Screen & Components Unit Tests', () => {
  const mockAccommodations: Accommodation[] = [
    {
      id: 'acc_01',
      name: 'Khách Sạn Grand Plaza',
      locationAddress: '117 Trần Duy Hưng',
      totalRooms: 10,
      contactPhone: '02435558888',
      notes: 'Ghi chú mật khách sạn: Hợp đồng đoàn 10 phòng',
      version: 1,
    },
  ];

  const mockRoomAssignments: RoomAssignment[] = [
    {
      id: 'ra_01',
      accommodationId: 'acc_01',
      roomNumber: 'Phòng 401',
      guestId: 'g_01',
      guestName: 'Bác Thành',
      guestPhone: '0901234567',
      checkInDate: '20/11/2026',
      checkOutDate: '22/11/2026',
      notes: 'Ghi chú mật phòng: Yêu cầu tầng cao',
    },
  ];

  const mockTrips: TransportTrip[] = [
    {
      id: 'trip_01',
      name: 'Chuyến Đón Sân Bay Nội Bài',
      vehicleType: 'shuttle_bus',
      departureTime: '2026-11-20 09:30',
      departureLocation: 'Cột số 10 Ga Nội Bài',
      arrivalLocation: 'KS Grand Plaza',
      capacity: 29,
      driverContact: 'Bác Tài Hùng - 0913555777',
      notes: 'Ghi chú mật chuyến: Mang biển đón dâu',
      version: 1,
      passengers: [
        {
          id: 'p_01',
          tripId: 'trip_01',
          guestId: 'g_01',
          guestName: 'Bác Thành',
          guestPhone: '0901234567',
          pickupPoint: 'Ga Nội Bài',
        },
      ],
    },
    {
      id: 'trip_full',
      name: 'Chuyến Rước Dâu 16 Chỗ (Đầy)',
      vehicleType: 'van',
      departureTime: '2026-11-21 07:00',
      departureLocation: 'Nhà Gái',
      arrivalLocation: 'Trống Đồng Cảnh Hồ',
      capacity: 2,
      driverContact: 'Bác Tài Dũng - 0982444555',
      version: 1,
      passengers: [
        { id: 'p_02', tripId: 'trip_full', guestId: 'g_02', guestName: 'Cô Mai' },
        { id: 'p_03', tripId: 'trip_full', guestId: 'g_03', guestName: 'Chú Hùng' },
      ],
    },
  ];

  describe('Role-Aware Rendering (AT03, AT26)', () => {
    it('renders full management controls and sensitive contacts for owner role', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(LogisticsScreen, {
            initialState: 'populated',
            initialAccommodations: mockAccommodations,
            initialRoomAssignments: mockRoomAssignments,
            initialTrips: mockTrips,
          })
        )
      );

      expect(html).toContain('Lưu Trú &amp; Di Chuyển Ngày Cưới');
      expect(html).toContain('Chuyến Xe Đưa Đón');
      expect(html).toContain('Gán khách lên xe');

      // Sensitive fields visible for owner
      expect(html).toContain('Bác Tài Hùng - 0913555777');
      expect(html).toContain('0901234567');
      expect(html).toContain('Ghi chú mật chuyến: Mang biển đón dâu');
    });

    it('strictly redacts mutation buttons, driver contact and private notes for family_view role (AT03, AT26)', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'family_view' },
          h(LogisticsScreen, {
            initialState: 'populated',
            initialAccommodations: mockAccommodations,
            initialRoomAssignments: mockRoomAssignments,
            initialTrips: mockTrips,
          })
        )
      );

      expect(html).toContain('Lưu Trú &amp; Di Chuyển Ngày Cưới');
      expect(html).toContain('Chế độ Người nhà (family_view)');

      // MUST NOT contain mutation buttons
      expect(html).not.toContain('Gán khách lên xe');
      expect(html).not.toContain('Phân phòng mới');
      expect(html).not.toContain('title="Gỡ khách khỏi chuyến"');

      // MUST NOT reveal driver contact or private notes
      expect(html).not.toContain('Bác Tài Hùng - 0913555777');
      expect(html).not.toContain('0901234567');
      expect(html).not.toContain('Ghi chú mật');
    });

    it('redacts accommodation contact phone and private notes in AccommodationsTab for family_view', () => {
      const familyHtml = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'family_view' },
          h(AccommodationsTab, {
            accommodations: mockAccommodations,
            roomAssignments: mockRoomAssignments,
          })
        )
      );

      expect(familyHtml).toContain('Khách Sạn Grand Plaza');
      expect(familyHtml).toContain('Phòng 401');
      expect(familyHtml).toContain('Bác Thành');

      // MUST NOT reveal sensitive fields
      expect(familyHtml).not.toContain('02435558888');
      expect(familyHtml).not.toContain('0901234567');
      expect(familyHtml).not.toContain('Ghi chú mật');
      expect(familyHtml).not.toContain('Phân phòng mới');
      expect(familyHtml).not.toContain('title="Gỡ phân phòng"');
    });
  });

  describe('Vehicle Capacity Bar & Overload Warnings (AT21, AT22)', () => {
    it('displays capacity ratio and Full badge when vehicle reaches limit (AT21)', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(TransportTripsTab, { trips: mockTrips })
        )
      );

      // Normal trip
      expect(html).toContain('1 / 29 chỗ');

      // Full trip
      expect(html).toContain('2 / 2 chỗ');
      expect(html).toContain('Xe đã đủ chỗ');
    });

    it('warns when vehicle capacity is overloaded (AT21)', () => {
      const overloadedTrip: TransportTrip = {
        ...mockTrips[0],
        capacity: 1,
        passengers: [
          { id: 'p_01', tripId: 'trip_01', guestId: 'g_01', guestName: 'Khách 1' },
          { id: 'p_02', tripId: 'trip_01', guestId: 'g_02', guestName: 'Khách 2' },
        ],
      };

      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(TransportTripsTab, { trips: [overloadedTrip] })
        )
      );

      expect(html).toContain('Cảnh báo quá tải xe (vượt 1 chỗ)!');
    });

    it('blocks passenger assignment when vehicle is full in AssignPassengerModal (AT21)', () => {
      const fullTrip = mockTrips[1]; // capacity 2, 2 passengers
      const html = renderToStaticMarkup(
        h(AssignPassengerModal, {
          isOpen: true,
          onClose: () => {},
          trip: fullTrip,
          onAssignPassenger: () => {},
        })
      );

      expect(html).toContain('Chuyến xe đã đủ chỗ (2/2 chỗ)');
      expect(html).toContain('yêu cầu AT21');
      expect(html).toContain('disabled=""');
    });

    it('displays invalid capacity reduction block modal (AT22)', () => {
      const html = renderToStaticMarkup(
        h(CapacityReductionWarningModal, {
          isOpen: true,
          onClose: () => {},
          currentCount: 15,
          requestedCapacity: 10,
        })
      );

      expect(html).toContain('Chặn Giảm Sức Chứa Dưới Số Lượng Đã Phân Bổ (AT22)');
      expect(html).toContain('15 khách');
      expect(html).toContain('10 chỗ');
    });
  });
});
