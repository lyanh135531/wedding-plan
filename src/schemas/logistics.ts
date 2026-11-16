import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
  dateTimeStringSchema,
  dateStringSchema,
  nullableVietnamesePhoneSchema,
  notesSchema,
} from './common';

export const vehicleTypeEnum = z.enum(['shuttle_bus', 'van', 'car']);
export type VehicleType = z.infer<typeof vehicleTypeEnum>;

// Accommodation Schemas
export const createAccommodationSchema = z.object({
  eventId: uuidSchema,
  name: z.string().trim().min(1, { message: 'Tên nơi lưu trú không được để trống' }).max(255),
  locationAddress: notesSchema.optional().nullable(),
  checkInTime: dateTimeStringSchema.optional().nullable(),
  checkOutTime: dateTimeStringSchema.optional().nullable(),
  totalRooms: z.number().int().positive({ message: 'Số phòng phải lớn hơn 0' }).default(1),
  contactPhone: nullableVietnamesePhoneSchema.optional(),
  notes: notesSchema.optional().nullable(),
});
export type CreateAccommodationInput = z.infer<typeof createAccommodationSchema>;

export const updateAccommodationSchema = z.object({
  name: z.string().trim().min(1, { message: 'Tên nơi lưu trú không được để trống' }).max(255).optional(),
  locationAddress: notesSchema.optional().nullable(),
  checkInTime: dateTimeStringSchema.optional().nullable(),
  checkOutTime: dateTimeStringSchema.optional().nullable(),
  totalRooms: z.number().int().positive({ message: 'Số phòng phải lớn hơn 0' }).optional(),
  contactPhone: nullableVietnamesePhoneSchema.optional(),
  notes: notesSchema.optional().nullable(),
  version: versionSchema.optional(),
});
export type UpdateAccommodationInput = z.infer<typeof updateAccommodationSchema>;

export const accommodationDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  name: z.string(),
  locationAddress: z.string().nullable(),
  checkInTime: dateTimeStringSchema.nullable(),
  checkOutTime: dateTimeStringSchema.nullable(),
  totalRooms: z.number().int(),
  contactPhone: z.string().nullable(),
  notes: z.string().nullable(),
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type AccommodationDto = z.infer<typeof accommodationDtoSchema>;

// Room Assignment Schemas
export const assignRoomSchema = z.object({
  accommodationId: uuidSchema,
  eventId: uuidSchema,
  roomNumber: z.string().trim().min(1, { message: 'Số phòng không được để trống' }).max(50),
  guestId: uuidSchema,
  checkInDate: dateStringSchema.optional().nullable(),
  checkOutDate: dateStringSchema.optional().nullable(),
  notes: notesSchema.optional().nullable(),
});
export type AssignRoomInput = z.infer<typeof assignRoomSchema>;

export const roomAssignmentDtoSchema = z.object({
  id: uuidSchema,
  accommodationId: uuidSchema,
  eventId: uuidSchema,
  roomNumber: z.string(),
  guestId: uuidSchema,
  checkInDate: z.string().nullable(),
  checkOutDate: z.string().nullable(),
  notes: z.string().nullable(),
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type RoomAssignmentDto = z.infer<typeof roomAssignmentDtoSchema>;

// Transport Trip Schemas
export const createTransportTripSchema = z.object({
  eventId: uuidSchema,
  name: z.string().trim().min(1, { message: 'Tên chuyến xe không được để trống' }).max(255),
  vehicleType: vehicleTypeEnum.default('shuttle_bus'),
  departureTime: dateTimeStringSchema.optional().nullable(),
  departureLocation: notesSchema.optional().nullable(),
  arrivalLocation: notesSchema.optional().nullable(),
  capacity: z.number().int().positive({ message: 'Sức chứa xe phải lớn hơn 0' }),
  driverContact: z.string().max(100).optional().nullable(),
  notes: notesSchema.optional().nullable(),
});
export type CreateTransportTripInput = z.infer<typeof createTransportTripSchema>;

export const updateTransportTripSchema = z.object({
  name: z.string().trim().min(1, { message: 'Tên chuyến xe không được để trống' }).max(255).optional(),
  vehicleType: vehicleTypeEnum.optional(),
  departureTime: dateTimeStringSchema.optional().nullable(),
  departureLocation: notesSchema.optional().nullable(),
  arrivalLocation: notesSchema.optional().nullable(),
  capacity: z.number().int().positive({ message: 'Sức chứa xe phải lớn hơn 0' }).optional(),
  driverContact: z.string().max(100).optional().nullable(),
  notes: notesSchema.optional().nullable(),
  version: versionSchema.optional(),
});
export type UpdateTransportTripInput = z.infer<typeof updateTransportTripSchema>;

export const transportTripDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  name: z.string(),
  vehicleType: vehicleTypeEnum,
  departureTime: dateTimeStringSchema.nullable(),
  departureLocation: z.string().nullable(),
  arrivalLocation: z.string().nullable(),
  capacity: z.number().int(),
  driverContact: z.string().nullable(),
  notes: z.string().nullable(),
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type TransportTripDto = z.infer<typeof transportTripDtoSchema>;

// Trip Passenger Schemas
export const assignPassengerSchema = z.object({
  tripId: uuidSchema,
  eventId: uuidSchema,
  guestId: uuidSchema,
  pickupPoint: notesSchema.optional().nullable(),
  notes: notesSchema.optional().nullable(),
});
export type AssignPassengerInput = z.infer<typeof assignPassengerSchema>;

export const tripPassengerDtoSchema = z.object({
  id: uuidSchema,
  tripId: uuidSchema,
  eventId: uuidSchema,
  guestId: uuidSchema,
  pickupPoint: z.string().nullable(),
  notes: z.string().nullable(),
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type TripPassengerDto = z.infer<typeof tripPassengerDtoSchema>;
