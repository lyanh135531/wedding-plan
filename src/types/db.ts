import { InferSelectModel, InferInsertModel } from "drizzle-orm";
import * as schema from "../db/schema";

// Auth & Access
export type User = InferSelectModel<typeof schema.users>;
export type NewUser = InferInsertModel<typeof schema.users>;

export type Session = InferSelectModel<typeof schema.sessions>;
export type NewSession = InferInsertModel<typeof schema.sessions>;

export type Account = InferSelectModel<typeof schema.accounts>;
export type NewAccount = InferInsertModel<typeof schema.accounts>;

export type Verification = InferSelectModel<typeof schema.verifications>;
export type NewVerification = InferInsertModel<typeof schema.verifications>;

export type MemberInvite = InferSelectModel<typeof schema.memberInvites>;
export type NewMemberInvite = InferInsertModel<typeof schema.memberInvites>;

export type MemberEventAccess = InferSelectModel<typeof schema.memberEventAccess>;
export type NewMemberEventAccess = InferInsertModel<typeof schema.memberEventAccess>;

// Events & Settings
export type Event = InferSelectModel<typeof schema.events>;
export type NewEvent = InferInsertModel<typeof schema.events>;

export type WeddingSettings = InferSelectModel<typeof schema.weddingSettings>;
export type NewWeddingSettings = InferInsertModel<typeof schema.weddingSettings>;

// Guests & Attendance
export type GuestGroup = InferSelectModel<typeof schema.guestGroups>;
export type NewGuestGroup = InferInsertModel<typeof schema.guestGroups>;

export type Guest = InferSelectModel<typeof schema.guests>;
export type NewGuest = InferInsertModel<typeof schema.guests>;

export type Invitation = InferSelectModel<typeof schema.invitations>;
export type NewInvitation = InferInsertModel<typeof schema.invitations>;

export type InvitationMember = InferSelectModel<typeof schema.invitationMembers>;
export type NewInvitationMember = InferInsertModel<typeof schema.invitationMembers>;

export type Attendance = InferSelectModel<typeof schema.attendance>;
export type NewAttendance = InferInsertModel<typeof schema.attendance>;

export type ContactFollowup = InferSelectModel<typeof schema.contactFollowups>;
export type NewContactFollowup = InferInsertModel<typeof schema.contactFollowups>;

// Finance & Budget
export type BudgetCategory = InferSelectModel<typeof schema.budgetCategories>;
export type NewBudgetCategory = InferInsertModel<typeof schema.budgetCategories>;

export type CategoryBudget = InferSelectModel<typeof schema.categoryBudgets>;
export type NewCategoryBudget = InferInsertModel<typeof schema.categoryBudgets>;

export type CostItem = InferSelectModel<typeof schema.costItems>;
export type NewCostItem = InferInsertModel<typeof schema.costItems>;

export type PaymentSchedule = InferSelectModel<typeof schema.paymentSchedules>;
export type NewPaymentSchedule = InferInsertModel<typeof schema.paymentSchedules>;

export type FundSettings = InferSelectModel<typeof schema.fundSettings>;
export type NewFundSettings = InferInsertModel<typeof schema.fundSettings>;

export type FundingEntry = InferSelectModel<typeof schema.fundingEntries>;
export type NewFundingEntry = InferInsertModel<typeof schema.fundingEntries>;

export type Payment = InferSelectModel<typeof schema.payments>;
export type NewPayment = InferInsertModel<typeof schema.payments>;

export type PaymentAllocation = InferSelectModel<typeof schema.paymentAllocations>;
export type NewPaymentAllocation = InferInsertModel<typeof schema.paymentAllocations>;

// Tasks & Schedule
export type Task = InferSelectModel<typeof schema.tasks>;
export type NewTask = InferInsertModel<typeof schema.tasks>;

export type TaskChecklistItem = InferSelectModel<typeof schema.taskChecklistItems>;
export type NewTaskChecklistItem = InferInsertModel<typeof schema.taskChecklistItems>;

export type TaskDependency = InferSelectModel<typeof schema.taskDependencies>;
export type NewTaskDependency = InferInsertModel<typeof schema.taskDependencies>;

export type Appointment = InferSelectModel<typeof schema.appointments>;
export type NewAppointment = InferInsertModel<typeof schema.appointments>;

// Files & Storage
export type Attachment = InferSelectModel<typeof schema.attachments>;
export type NewAttachment = InferInsertModel<typeof schema.attachments>;

export type AttachmentVariant = InferSelectModel<typeof schema.attachmentVariants>;
export type NewAttachmentVariant = InferInsertModel<typeof schema.attachmentVariants>;

// System & Audit
export type AuditLog = InferSelectModel<typeof schema.auditLogs>;
export type NewAuditLog = InferInsertModel<typeof schema.auditLogs>;

export type Notification = InferSelectModel<typeof schema.notifications>;
export type NewNotification = InferInsertModel<typeof schema.notifications>;

export type IdempotencyRecord = InferSelectModel<typeof schema.idempotencyRecords>;
export type NewIdempotencyRecord = InferInsertModel<typeof schema.idempotencyRecords>;

export type ImportBatch = InferSelectModel<typeof schema.importBatches>;
export type NewImportBatch = InferInsertModel<typeof schema.importBatches>;

export type ImportRow = InferSelectModel<typeof schema.importRows>;
export type NewImportRow = InferInsertModel<typeof schema.importRows>;
