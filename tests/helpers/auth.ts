/**
 * Auth Session & Role Permission Test Helpers.
 * Supports multi-role testing: Owner (Groom/Bride), Family View-only, Revoked, Anonymous.
 */

export type UserRole = 'owner' | 'family_view' | 'revoked' | 'anonymous';

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  assignedEventIds?: string[];
  expiresAt: Date;
  token: string;
}

export const TEST_USERS = {
  OWNER_GROOM: {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'groom@example.com',
    name: 'Nguyễn Văn Chú Rể',
    role: 'owner' as UserRole,
  },
  OWNER_BRIDE: {
    userId: '22222222-2222-4222-8222-222222222222',
    email: 'bride@example.com',
    name: 'Trần Thị Cô Dâu',
    role: 'owner' as UserRole,
  },
  FAMILY_EVENT1: {
    userId: '33333333-3333-4333-8333-333333333333',
    email: 'family1@example.com',
    name: 'Bác Ba (Họ Nhà Trai)',
    role: 'family_view' as UserRole,
    assignedEventIds: ['00000000-0000-4000-8000-000000000001'],
  },
  FAMILY_UNASSIGNED: {
    userId: '44444444-4444-4444-8444-444444444444',
    email: 'family_unassigned@example.com',
    name: 'Họ Hàng Xa',
    role: 'family_view' as UserRole,
    assignedEventIds: [],
  },
  REVOKED_USER: {
    userId: '55555555-5555-4555-8555-555555555555',
    email: 'revoked@example.com',
    name: 'Thành Viên Đã Thu Hồi',
    role: 'revoked' as UserRole,
  },
};

/**
 * Create a mock session object for a given role or test profile.
 */
export function createMockUserSession(
  role: UserRole = 'owner',
  overrides: Partial<UserSession> = {}
): UserSession {
  const baseProfile =
    role === 'owner'
      ? TEST_USERS.OWNER_GROOM
      : role === 'family_view'
      ? TEST_USERS.FAMILY_EVENT1
      : role === 'revoked'
      ? TEST_USERS.REVOKED_USER
      : {
          userId: '00000000-0000-4000-8000-000000000000',
          email: 'anonymous@example.com',
          name: 'Khách Vãng Lai',
          role: 'anonymous' as UserRole,
        };

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day default

  return {
    ...baseProfile,
    expiresAt,
    token: `test-session-token-${baseProfile.userId}`,
    ...overrides,
  };
}

/**
 * Check if a given user role is permitted to view financial data (AT03).
 */
export function canViewFinancials(role: UserRole): boolean {
  return role === 'owner';
}

/**
 * Check if a given user role is permitted to view sensitive guest data
 * (phone, email, private notes, address) (AT03).
 */
export function canViewGuestPrivateInfo(role: UserRole): boolean {
  return role === 'owner';
}

/**
 * Sanitize guest data payload based on the caller's role (AT03 DTO isolation).
 * Hỗ trợ làm sạch cả camelCase (privateNotes) và snake_case (private_notes).
 */
export function sanitizeGuestForRole<
  T extends {
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    privateNotes?: string | null;
    private_notes?: string | null;
  }
>(guest: T, role: UserRole): T {
  if (role === 'owner') {
    return guest;
  }
  return {
    ...guest,
    phone: null,
    email: null,
    address: null,
    privateNotes: null,
    private_notes: null,
  } as T;
}

/**
 * Generate HTTP mock headers representing an authenticated session.
 */
export function getMockAuthHeaders(session: UserSession): Record<string, string> {
  return {
    'Authorization': `Bearer ${session.token}`,
  };
}
