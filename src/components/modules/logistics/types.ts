export type VehicleType = 'shuttle_bus' | 'van' | 'car';

export interface Accommodation {
  id: string;
  name: string;
  locationAddress?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  totalRooms: number;
  contactPhone?: string | null; // contact info (redacted for family_view)
  notes?: string | null; // private notes (redacted for family_view)
  version: number;
}

export interface RoomAssignment {
  id: string;
  accommodationId: string;
  roomNumber: string;
  guestId: string;
  guestName: string;
  guestPhone?: string | null; // contact info (redacted for family_view)
  checkInDate?: string | null;
  checkOutDate?: string | null;
  notes?: string | null; // private notes (redacted for family_view)
}

export interface TripPassengerItem {
  id: string;
  tripId: string;
  guestId: string;
  guestName: string;
  guestPhone?: string | null; // contact info (redacted for family_view)
  pickupPoint?: string | null;
  notes?: string | null; // private notes (redacted for family_view)
}

export interface TransportTrip {
  id: string;
  name: string;
  vehicleType: VehicleType;
  departureTime: string;
  departureLocation: string;
  arrivalLocation: string;
  capacity: number;
  driverContact?: string | null; // driver contact (redacted for family_view)
  notes?: string | null; // private notes (redacted for family_view)
  passengers: TripPassengerItem[];
  version: number;
}
