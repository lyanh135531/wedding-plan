/**
 * FX01_FAMILY_GROUP: Canonical domain fixture for a 4-person family group
 * invited to 2 distinct events with heterogeneous attendance, shared phone,
 * and specific seating/dietary requirements (AT05, AT06, AT07, AT08).
 */

export interface FixtureGuest {
  id: string;
  displayName: string;
  side: 'groom' | 'bride' | 'mutual' | 'unassigned';
  groupId: string;
  subTags: string[];
  ageTier: 'adult' | 'child' | 'baby';
  phone: string | null;
  email: string | null;
  address: string | null;
  privateNotes: string | null;
  isPlaceholder: boolean;
  isArchived: boolean;
  version: number;
}

export interface FixtureEvent {
  id: string;
  title: string;
  eventType: 'engagement' | 'ancestor_ceremony' | 'wedding_party' | 'other';
  status: 'tentative' | 'confirmed' | 'cancelled' | 'completed';
  startTime: string;
  endTime: string;
  locationName: string;
  locationAddress: string;
  mapUrl: string | null;
  publicNotes: string | null;
  privateNotes: string | null;
  version: number;
}

export interface FixtureInvitation {
  id: string;
  eventId: string;
  cardName: string;
  representativeGuestId: string;
  deliveryMethod: 'paper' | 'electronic' | 'in_person';
  status: 'save_the_date' | 'preparing' | 'sent';
  sentDate: string | null;
  notes: string | null;
  memberGuestIds: string[];
  version: number;
}

export interface FixtureAttendance {
  id: string;
  guestId: string;
  eventId: string;
  rsvpStatus: 'not_contacted' | 'pending_reply' | 'tentative' | 'accepted' | 'declined';
  contactCount: number;
  contactNotes: string | null;
  needsSeat: boolean;
  needsMeal: boolean;
  mealDietaryTier: 'regular' | 'vegetarian' | 'child_portion' | 'special';
  dietaryNotes: string | null;
  accommodationNeeded: boolean;
  transportNeeded: boolean;
  version: number;
}

export interface Fx01FamilyGroupFixture {
  readonly events: {
    morningCeremony: FixtureEvent;
    eveningReception: FixtureEvent;
  };
  readonly guestGroup: {
    id: string;
    name: string;
    side: 'groom' | 'bride' | 'mutual' | 'unassigned';
    sortOrder: number;
  };
  readonly guests: {
    father: FixtureGuest;
    mother: FixtureGuest;
    child: FixtureGuest;
    baby: FixtureGuest;
  };
  readonly invitation: FixtureInvitation;
  readonly morningAttendance: FixtureAttendance[];
  readonly eveningAttendance: FixtureAttendance[];
  readonly expectedEveningAggregations: {
    totalInvited: number;
    confirmedGuests: number;
    declinedGuests: number;
    uncertainGuests: number;
    confirmedSeats: number;
    mealsTotal: number;
    mealsRegularAdult: number;
    mealsVegetarian: number;
    mealsChild: number;
    mealsBaby: number;
  };
}

export const FX01_FAMILY_GROUP: Fx01FamilyGroupFixture = {
  events: {
    morningCeremony: {
      id: 'e0000000-0000-4000-8000-000000000001',
      title: 'Lễ Gia Tiên Nhà Gái & Nhà Trai',
      eventType: 'ancestor_ceremony',
      status: 'confirmed',
      startTime: '2028-03-15T09:00:00+07:00',
      endTime: '2028-03-15T11:00:00+07:00',
      locationName: 'Tư gia Nhà gái',
      locationAddress: '123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      mapUrl: 'https://maps.google.com/?q=123+Nguyen+Hue+Q1',
      publicNotes: 'Làm lễ gia tiên truyền thống, trang phục lịch sự hoặc áo dài',
      privateNotes: 'Chú ý chuẩn bị trà sen và nước ngọt cho Bác Ba',
      version: 1,
    },
    eveningReception: {
      id: 'e0000000-0000-4000-8000-000000000002',
      title: 'Tiệc Cưới Chính Buổi Tối',
      eventType: 'wedding_party',
      status: 'confirmed',
      startTime: '2028-03-15T18:00:00+07:00',
      endTime: '2028-03-15T21:30:00+07:00',
      locationName: 'Trung tâm Hội nghị Tiệc cưới Grand Palace',
      locationAddress: '456 Đường Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      mapUrl: 'https://maps.google.com/?q=Grand+Palace+Le+Duan',
      publicNotes: 'Đón khách từ 17:30, khai tiệc đúng 19:00',
      privateNotes: 'Bàn VIP họ nhà trai, gần lối đi trung tâm',
      version: 1,
    },
  },
  guestGroup: {
    id: '11000000-0000-4000-8000-000000000001',
    name: 'Họ hàng Nhà trai',
    side: 'groom',
    sortOrder: 1,
  },
  guests: {
    father: {
      id: '10000000-0000-4000-8000-000000000001',
      displayName: 'Nguyễn Văn Ba (Bác Ba)',
      side: 'groom',
      groupId: '11000000-0000-4000-8000-000000000001',
      subTags: ['Họ nội', 'Bác ruột', 'Trưởng họ'],
      ageTier: 'adult',
      phone: '0901234567',
      email: 'bacba@example.com',
      address: '12 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
      privateNotes: 'Uống trà nóng, kiêng bia rượu lạnh',
      isPlaceholder: false,
      isArchived: false,
      version: 1,
    },
    mother: {
      id: '10000000-0000-4000-8000-000000000002',
      displayName: 'Trần Thị Mẹ (Bác Gái)',
      side: 'groom',
      groupId: '11000000-0000-4000-8000-000000000001',
      subTags: ['Họ nội', 'Dâu trưởng'],
      ageTier: 'adult',
      phone: '0901234567', // Shared family phone
      email: null,
      address: '12 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
      privateNotes: 'Ăn chay trường theo đạo Phật, dị ứng đồ biển tươi sống',
      isPlaceholder: false,
      isArchived: false,
      version: 1,
    },
    child: {
      id: '10000000-0000-4000-8000-000000000003',
      displayName: 'Nguyễn Bé Lớn (Bé Bi)',
      side: 'groom',
      groupId: '11000000-0000-4000-8000-000000000001',
      subTags: ['Con Bác Ba'],
      ageTier: 'child',
      phone: null,
      email: null,
      address: null,
      privateNotes: '6 tuổi, hiếu động, thích đồ chiên giòn',
      isPlaceholder: false,
      isArchived: false,
      version: 1,
    },
    baby: {
      id: '10000000-0000-4000-8000-000000000004',
      displayName: 'Nguyễn Em Bé (Bé Bông)',
      side: 'groom',
      groupId: '11000000-0000-4000-8000-000000000001',
      subTags: ['Con Bác Ba'],
      ageTier: 'baby',
      phone: null,
      email: null,
      address: null,
      privateNotes: '1 tuổi, ăn dặm, mẹ tự mang đồ ăn theo',
      isPlaceholder: false,
      isArchived: false,
      version: 1,
    },
  },
  invitation: {
    id: '12000000-0000-4000-8000-000000000001',
    eventId: 'e0000000-0000-4000-8000-000000000002',
    cardName: 'Gia đình Bác Ba & Các Cháu',
    representativeGuestId: '10000000-0000-4000-8000-000000000001',
    deliveryMethod: 'in_person',
    status: 'sent',
    sentDate: '2028-02-15',
    notes: 'Chú rể đích thân mang thiệp đến trao tận tay tại nhà riêng',
    memberGuestIds: [
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000004',
    ],
    version: 1,
  },
  morningAttendance: [
    {
      id: '13000000-0000-4000-8000-000000000001',
      guestId: '10000000-0000-4000-8000-000000000001',
      eventId: 'e0000000-0000-4000-8000-000000000001',
      rsvpStatus: 'accepted',
      contactCount: 1,
      contactNotes: 'Bác Ba nhận lời đại diện họ nhà trai phát biểu',
      needsSeat: true,
      needsMeal: false,
      mealDietaryTier: 'regular',
      dietaryNotes: null,
      accommodationNeeded: false,
      transportNeeded: false,
      version: 1,
    },
    {
      id: '13000000-0000-4000-8000-000000000002',
      guestId: '10000000-0000-4000-8000-000000000002',
      eventId: 'e0000000-0000-4000-8000-000000000001',
      rsvpStatus: 'accepted',
      contactCount: 1,
      contactNotes: 'Bác Gái sang phụ thắp hương bàn thờ gia tiên',
      needsSeat: true,
      needsMeal: false,
      mealDietaryTier: 'vegetarian',
      dietaryNotes: 'Uống nước lọc, không dùng bánh ngọt trứng mỡ',
      accommodationNeeded: false,
      transportNeeded: false,
      version: 1,
    },
    {
      id: '13000000-0000-4000-8000-000000000003',
      guestId: '10000000-0000-4000-8000-000000000003',
      eventId: 'e0000000-0000-4000-8000-000000000001',
      rsvpStatus: 'accepted',
      contactCount: 1,
      contactNotes: 'Đi cùng bố mẹ dự lễ sáng',
      needsSeat: true,
      needsMeal: false,
      mealDietaryTier: 'regular',
      dietaryNotes: null,
      accommodationNeeded: false,
      transportNeeded: false,
      version: 1,
    },
    {
      id: '13000000-0000-4000-8000-000000000004',
      guestId: '10000000-0000-4000-8000-000000000004',
      eventId: 'e0000000-0000-4000-8000-000000000001',
      rsvpStatus: 'accepted',
      contactCount: 1,
      contactNotes: 'Mẹ ẵm theo dự lễ gia tiên, cần ghế em bé cao để ngồi chơi',
      needsSeat: false,
      needsMeal: false,
      mealDietaryTier: 'regular',
      dietaryNotes: 'Ghế em bé cao (baby highchair)',
      accommodationNeeded: false,
      transportNeeded: false,
      version: 1,
    },
  ],
  eveningAttendance: [
    {
      id: '13000000-0000-4000-8000-000000000011',
      guestId: '10000000-0000-4000-8000-000000000001',
      eventId: 'e0000000-0000-4000-8000-000000000002',
      rsvpStatus: 'accepted',
      contactCount: 2,
      contactNotes: 'Xác nhận tham dự tiệc tối đầy đủ',
      needsSeat: true,
      needsMeal: true,
      mealDietaryTier: 'regular',
      dietaryNotes: null,
      accommodationNeeded: false,
      transportNeeded: false,
      version: 1,
    },
    {
      id: '13000000-0000-4000-8000-000000000012',
      guestId: '10000000-0000-4000-8000-000000000002',
      eventId: 'e0000000-0000-4000-8000-000000000002',
      rsvpStatus: 'accepted',
      contactCount: 2,
      contactNotes: 'Xác nhận tham dự tiệc tối, đặt 1 suất ăn chay',
      needsSeat: true,
      needsMeal: true,
      mealDietaryTier: 'vegetarian',
      dietaryNotes: 'Ăn chay trường, kiêng ngũ vị tân',
      accommodationNeeded: false,
      transportNeeded: false,
      version: 1,
    },
    {
      id: '13000000-0000-4000-8000-000000000013',
      guestId: '10000000-0000-4000-8000-000000000003',
      eventId: 'e0000000-0000-4000-8000-000000000002',
      rsvpStatus: 'accepted',
      contactCount: 2,
      contactNotes: 'Xác nhận có ghế và suất trẻ em',
      needsSeat: true,
      needsMeal: true,
      mealDietaryTier: 'child_portion',
      dietaryNotes: 'Suất trẻ em không cay',
      accommodationNeeded: false,
      transportNeeded: false,
      version: 1,
    },
    {
      id: '13000000-0000-4000-8000-000000000014',
      guestId: '10000000-0000-4000-8000-000000000004',
      eventId: 'e0000000-0000-4000-8000-000000000002',
      rsvpStatus: 'declined',
      contactCount: 2,
      contactNotes: 'Buổi tối đông đúc và ồn ào nên gửi em bé ở nhà với bà ngoại',
      needsSeat: false,
      needsMeal: false,
      mealDietaryTier: 'regular',
      dietaryNotes: null,
      accommodationNeeded: false,
      transportNeeded: false,
      version: 1,
    },
  ],
  expectedEveningAggregations: {
    totalInvited: 4,
    confirmedGuests: 3,
    declinedGuests: 1,
    uncertainGuests: 0,
    confirmedSeats: 3,
    mealsTotal: 3,
    mealsRegularAdult: 1,
    mealsVegetarian: 1,
    mealsChild: 1,
    mealsBaby: 0,
  },
};
