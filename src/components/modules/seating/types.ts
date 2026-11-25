export type TableShape = 'round' | 'rectangular';

export interface TableItem {
  id: string;
  name: string;
  tableNumber?: string;
  shape: TableShape;
  capacity: number;
  notes?: string | null;
  seatedGuestIds: string[];
  version?: number;
}

export interface GuestSeatingItem {
  id: string;
  name: string;
  groupName: string;
  side?: 'groom' | 'bride' | 'mutual' | 'unassigned';
  tableId: string | null;
  rsvpStatus?: 'attending' | 'declined' | 'pending';
  needsSeat?: boolean; // false for infants (AT07)
  notes?: string | null; // private notes (redacted for family_view)
  phone?: string | null; // contact info (redacted for family_view)
}
