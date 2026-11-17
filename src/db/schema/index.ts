import { relations } from "drizzle-orm";

// Export all tables and enums from modular schemas
export * from "./auth";
export * from "./events";
export * from "./guests";
export * from "./finance";
export * from "./vendors";
export * from "./tasks";
export * from "./files";
export * from "./system";
export * from "./seating";
export * from "./catering";
export * from "./logistics";
export * from "./preparation";
export * from "./support";

import { users, sessions, accounts, memberInvites, memberEventAccess } from "./auth";
import { events, weddingSettings } from "./events";
import { guestGroups, guests, invitations, invitationMembers, attendance, contactFollowups } from "./guests";
import {
  budgetCategories,
  categoryBudgets,
  costItems,
  paymentSchedules,
  fundSettings,
  fundingEntries,
  payments,
  paymentAllocations,
} from "./finance";
import { vendors, vendorQuotes, contacts } from "./vendors";
import { tasks, taskChecklistItems, taskDependencies, appointments } from "./tasks";
import { attachments, attachmentVariants } from "./files";
import { auditLogs, notifications, idempotencyRecords, importBatches, importRows } from "./system";
import { tables, seatAssignments } from "./seating";
import { menus, menuItems, guestMealSelections, cateringSnapshots } from "./catering";
import { accommodations, roomAssignments, transportTrips, tripPassengers } from "./logistics";
import { preparationItems } from "./preparation";
import { supportAssignments } from "./support";

// ==========================================
// DRIZZLE RELATIONS DEFINITIONS
// ==========================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  eventAccesses: many(memberEventAccess),
  sentInvites: many(memberInvites),
  assignedTasks: many(tasks),
  assignedCostItems: many(costItems),
  assignedInvitations: many(invitations),
  contactFollowups: many(contactFollowups),
  notifications: many(notifications),
  uploads: many(attachments),
  createdVendorQuotes: many(vendorQuotes),
}));

export const eventsRelations = relations(events, ({ many, one }) => ({
  invitations: many(invitations),
  attendanceRecords: many(attendance),
  costItems: many(costItems),
  tasks: many(tasks),
  appointments: many(appointments),
  memberAccess: many(memberEventAccess),
  tables: many(tables),
  seatAssignments: many(seatAssignments),
  menus: many(menus),
  menuItems: many(menuItems),
  guestMealSelections: many(guestMealSelections),
  cateringSnapshots: many(cateringSnapshots),
  accommodations: many(accommodations),
  roomAssignments: many(roomAssignments),
  transportTrips: many(transportTrips),
  tripPassengers: many(tripPassengers),
  preparationItems: many(preparationItems),
  supportAssignments: many(supportAssignments),
}));

export const weddingSettingsRelations = relations(weddingSettings, ({ one }) => ({
  representativeEvent: one(events, {
    fields: [weddingSettings.representativeEventId],
    references: [events.id],
  }),
}));

export const guestGroupsRelations = relations(guestGroups, ({ many }) => ({
  guests: many(guests),
}));

export const guestsRelations = relations(guests, ({ one, many }) => ({
  group: one(guestGroups, {
    fields: [guests.groupId],
    references: [guestGroups.id],
  }),
  invitationMembers: many(invitationMembers),
  representativeInvitations: many(invitations),
  attendances: many(attendance),
  contactFollowups: many(contactFollowups),
  seatAssignments: many(seatAssignments),
  mealSelections: many(guestMealSelections),
  roomAssignments: many(roomAssignments),
  tripPassengers: many(tripPassengers),
}));

export const invitationsRelations = relations(invitations, ({ one, many }) => ({
  event: one(events, {
    fields: [invitations.eventId],
    references: [events.id],
  }),
  representativeGuest: one(guests, {
    fields: [invitations.representativeGuestId],
    references: [guests.id],
  }),
  inChargeUser: one(users, {
    fields: [invitations.inChargeUserId],
    references: [users.id],
  }),
  members: many(invitationMembers),
}));

export const invitationMembersRelations = relations(invitationMembers, ({ one }) => ({
  invitation: one(invitations, {
    fields: [invitationMembers.invitationId],
    references: [invitations.id],
  }),
  guest: one(guests, {
    fields: [invitationMembers.guestId],
    references: [guests.id],
  }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  guest: one(guests, {
    fields: [attendance.guestId],
    references: [guests.id],
  }),
  event: one(events, {
    fields: [attendance.eventId],
    references: [events.id],
  }),
}));

export const budgetCategoriesRelations = relations(budgetCategories, ({ one, many }) => ({
  budget: one(categoryBudgets, {
    fields: [budgetCategories.id],
    references: [categoryBudgets.categoryId],
  }),
  costItems: many(costItems),
}));

export const categoryBudgetsRelations = relations(categoryBudgets, ({ one }) => ({
  category: one(budgetCategories, {
    fields: [categoryBudgets.categoryId],
    references: [budgetCategories.id],
  }),
}));

export const costItemsRelations = relations(costItems, ({ one, many }) => ({
  category: one(budgetCategories, {
    fields: [costItems.categoryId],
    references: [budgetCategories.id],
  }),
  event: one(events, {
    fields: [costItems.eventId],
    references: [events.id],
  }),
  inChargeUser: one(users, {
    fields: [costItems.inChargeUserId],
    references: [users.id],
  }),
  vendor: one(vendors, {
    fields: [costItems.vendorId],
    references: [vendors.id],
  }),
  vendorQuote: one(vendorQuotes, {
    fields: [costItems.vendorQuoteId],
    references: [vendorQuotes.id],
  }),
  schedules: many(paymentSchedules),
  payments: many(payments),
  fundingEntries: many(fundingEntries),
}));

export const paymentSchedulesRelations = relations(paymentSchedules, ({ one, many }) => ({
  costItem: one(costItems, {
    fields: [paymentSchedules.costItemId],
    references: [costItems.id],
  }),
  allocations: many(paymentAllocations),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  costItem: one(costItems, {
    fields: [payments.costItemId],
    references: [costItems.id],
  }),
  parentPayment: one(payments, {
    fields: [payments.parentPaymentId],
    references: [payments.id],
    relationName: "refundParent",
  }),
  refunds: many(payments, { relationName: "refundParent" }),
  allocations: many(paymentAllocations),
  linkedFundingEntry: one(fundingEntries, {
    fields: [payments.linkedFundingEntryId],
    references: [fundingEntries.id],
  }),
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentAllocations.paymentId],
    references: [payments.id],
  }),
  schedule: one(paymentSchedules, {
    fields: [paymentAllocations.scheduleId],
    references: [paymentSchedules.id],
  }),
}));

export const fundingEntriesRelations = relations(fundingEntries, ({ one }) => ({
  linkedCostItem: one(costItems, {
    fields: [fundingEntries.linkedCostItemId],
    references: [costItems.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  event: one(events, {
    fields: [tasks.eventId],
    references: [events.id],
  }),
  relativeEvent: one(events, {
    fields: [tasks.relativeEventId],
    references: [events.id],
  }),
  inChargeUser: one(users, {
    fields: [tasks.inChargeUserId],
    references: [users.id],
  }),
  checklistItems: many(taskChecklistItems),
  dependencies: many(taskDependencies, { relationName: "dependentTasks" }),
  prerequisites: many(taskDependencies, { relationName: "prerequisiteTasks" }),
}));

export const taskChecklistItemsRelations = relations(taskChecklistItems, ({ one }) => ({
  task: one(tasks, {
    fields: [taskChecklistItems.taskId],
    references: [tasks.id],
  }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  dependentTask: one(tasks, {
    fields: [taskDependencies.dependentTaskId],
    references: [tasks.id],
    relationName: "dependentTasks",
  }),
  prerequisiteTask: one(tasks, {
    fields: [taskDependencies.prerequisiteTaskId],
    references: [tasks.id],
    relationName: "prerequisiteTasks",
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one, many }) => ({
  uploader: one(users, {
    fields: [attachments.uploaderUserId],
    references: [users.id],
  }),
  variants: many(attachmentVariants),
}));

export const attachmentVariantsRelations = relations(attachmentVariants, ({ one }) => ({
  attachment: one(attachments, {
    fields: [attachmentVariants.attachmentId],
    references: [attachments.id],
  }),
}));

export const importBatchesRelations = relations(importBatches, ({ one, many }) => ({
  user: one(users, {
    fields: [importBatches.userId],
    references: [users.id],
  }),
  rows: many(importRows),
}));

export const importRowsRelations = relations(importRows, ({ one }) => ({
  batch: one(importBatches, {
    fields: [importRows.batchId],
    references: [importBatches.id],
  }),
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
  quotes: many(vendorQuotes),
  contacts: many(contacts),
  costItems: many(costItems),
}));

export const vendorQuotesRelations = relations(vendorQuotes, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [vendorQuotes.vendorId],
    references: [vendors.id],
  }),
  parentQuote: one(vendorQuotes, {
    fields: [vendorQuotes.parentQuoteId],
    references: [vendorQuotes.id],
    relationName: "parentQuote",
  }),
  childQuotes: many(vendorQuotes, { relationName: "parentQuote" }),
  createdByUser: one(users, {
    fields: [vendorQuotes.createdBy],
    references: [users.id],
  }),
  costItem: one(costItems, {
    fields: [vendorQuotes.id],
    references: [costItems.vendorQuoteId],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  vendor: one(vendors, {
    fields: [contacts.vendorId],
    references: [vendors.id],
  }),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  event: one(events, {
    fields: [tables.eventId],
    references: [events.id],
  }),
  seatAssignments: many(seatAssignments),
}));

export const seatAssignmentsRelations = relations(seatAssignments, ({ one }) => ({
  event: one(events, {
    fields: [seatAssignments.eventId],
    references: [events.id],
  }),
  table: one(tables, {
    fields: [seatAssignments.tableId],
    references: [tables.id],
  }),
  guest: one(guests, {
    fields: [seatAssignments.guestId],
    references: [guests.id],
  }),
}));

export const menusRelations = relations(menus, ({ one, many }) => ({
  event: one(events, {
    fields: [menus.eventId],
    references: [events.id],
  }),
  items: many(menuItems),
  snapshots: many(cateringSnapshots),
}));

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  menu: one(menus, {
    fields: [menuItems.menuId],
    references: [menus.id],
  }),
  event: one(events, {
    fields: [menuItems.eventId],
    references: [events.id],
  }),
}));

export const guestMealSelectionsRelations = relations(guestMealSelections, ({ one }) => ({
  event: one(events, {
    fields: [guestMealSelections.eventId],
    references: [events.id],
  }),
  guest: one(guests, {
    fields: [guestMealSelections.guestId],
    references: [guests.id],
  }),
}));

export const cateringSnapshotsRelations = relations(cateringSnapshots, ({ one }) => ({
  event: one(events, {
    fields: [cateringSnapshots.eventId],
    references: [events.id],
  }),
  menu: one(menus, {
    fields: [cateringSnapshots.menuId],
    references: [menus.id],
  }),
}));

export const accommodationsRelations = relations(accommodations, ({ one, many }) => ({
  event: one(events, {
    fields: [accommodations.eventId],
    references: [events.id],
  }),
  roomAssignments: many(roomAssignments),
}));

export const roomAssignmentsRelations = relations(roomAssignments, ({ one }) => ({
  accommodation: one(accommodations, {
    fields: [roomAssignments.accommodationId],
    references: [accommodations.id],
  }),
  event: one(events, {
    fields: [roomAssignments.eventId],
    references: [events.id],
  }),
  guest: one(guests, {
    fields: [roomAssignments.guestId],
    references: [guests.id],
  }),
}));

export const transportTripsRelations = relations(transportTrips, ({ one, many }) => ({
  event: one(events, {
    fields: [transportTrips.eventId],
    references: [events.id],
  }),
  passengers: many(tripPassengers),
}));

export const tripPassengersRelations = relations(tripPassengers, ({ one }) => ({
  trip: one(transportTrips, {
    fields: [tripPassengers.tripId],
    references: [transportTrips.id],
  }),
  event: one(events, {
    fields: [tripPassengers.eventId],
    references: [events.id],
  }),
  guest: one(guests, {
    fields: [tripPassengers.guestId],
    references: [guests.id],
  }),
}));

export const preparationItemsRelations = relations(preparationItems, ({ one }) => ({
  event: one(events, {
    fields: [preparationItems.eventId],
    references: [events.id],
  }),
}));

export const supportAssignmentsRelations = relations(supportAssignments, ({ one }) => ({
  event: one(events, {
    fields: [supportAssignments.eventId],
    references: [events.id],
  }),
  contact: one(contacts, {
    fields: [supportAssignments.contactId],
    references: [contacts.id],
  }),
}));



