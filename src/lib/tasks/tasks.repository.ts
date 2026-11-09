import { eq, and, sql, desc, asc } from 'drizzle-orm';
import {
  tasks,
  taskChecklistItems,
  taskDependencies,
} from '@/db/schema/tasks';
import { events } from '@/db/schema/events';
import { auditLogs } from '@/db/schema/system';
import {
  CreateTaskInput,
  UpdateTaskInput,
  TaskPriority,
  TaskStatus,
  toTaskFamilyDto,
} from '@/schemas/tasks';
import { computeEffectiveDueDate, EventDateInfo } from './deadlines';
import { validateNoDependencyCycle } from './dag';
import { TxOrDb } from '@/lib/finance/costs.repository';

export class TaskNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy công việc') {
    super(message);
    this.name = 'TaskNotFoundError';
  }
}

export class TaskVersionConflictError extends Error {
  readonly statusCode = 409;
  constructor(message = 'Công việc đã bị thay đổi bởi người khác, vui lòng tải lại') {
    super(message);
    this.name = 'TaskVersionConflictError';
  }
}

export interface ListTasksParams {
  status?: TaskStatus;
  priority?: TaskPriority;
  categoryId?: string;
  eventId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  role: 'owner' | 'family_view';
  allowedEventIds?: string[];
}

export async function listTasks(txDb: TxOrDb, params: ListTasksParams) {
  const { status, priority, categoryId, eventId, search, limit = 100, offset = 0, role, allowedEventIds = [] } = params;

  // 1. Fetch events to build eventsMap for deadline computation
  const allEvents = await txDb
    .select({
      id: events.id,
      startTime: events.startTime,
      status: events.status,
    })
    .from(events);

  const eventsMap = new Map<string, EventDateInfo>();
  for (const e of allEvents) {
    const solarDateStr = e.startTime ? new Date(e.startTime).toISOString().slice(0, 10) : null;
    eventsMap.set(e.id, {
      id: e.id,
      solarDate: solarDateStr,
      isDateConfirmed: e.status === 'confirmed' && Boolean(solarDateStr),
    });
  }

  // 2. Build query
  let query = txDb
    .select()
    .from(tasks)
    .$dynamic();

  const conditions = [];

  // Family role masking: ONLY shared_with_family = true, and scoped to allowed events (AT59)
  if (role === 'family_view') {
    conditions.push(eq(tasks.sharedWithFamily, true));
    if (allowedEventIds.length > 0) {
      conditions.push(sql`${tasks.eventId} IS NULL OR ${tasks.eventId} IN ${allowedEventIds}`);
    }
  }

  if (status) {
    conditions.push(eq(tasks.status, status as any));
  }
  if (priority) {
    conditions.push(eq(tasks.priority, priority as any));
  }
  if (categoryId) {
    conditions.push(eq(tasks.category, categoryId));
  }
  if (eventId) {
    conditions.push(eq(tasks.eventId, eventId));
  }
  if (search && search.trim() !== '') {
    const clean = search.trim();
    conditions.push(
      sql`public.immutable_unaccent(${tasks.title}) ILIKE public.immutable_unaccent(${'%' + clean + '%'})`
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const rawTasks = await query
    .orderBy(desc(tasks.priority), desc(tasks.createdAt))
    .limit(limit)
    .offset(offset);

  // 3. Compute effective deadlines
  const computedList = rawTasks.map((t: any) => {
    const metrics = computeEffectiveDueDate(t, eventsMap);
    return {
      ...t,
      computed_due_date: metrics.effectiveDueDateString,
      is_waiting_official_date: metrics.isWaitingOfficialDate,
      is_overdue: metrics.isOverdue,
    };
  });

  // 4. Transform for Family View if needed (AT59)
  if (role === 'family_view') {
    return computedList.map((t: any) => toTaskFamilyDto(t));
  }

  return computedList;
}

export async function getTaskById(
  txDb: TxOrDb,
  id: string,
  role: 'owner' | 'family_view',
  allowedEventIds: string[] = []
) {
  const [task] = await txDb
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!task) return null;

  if (role === 'family_view') {
    if (!task.sharedWithFamily) {
      return null; // Hidden from family
    }
    if (task.eventId && !allowedEventIds.includes(task.eventId)) {
      return null;
    }
  }

  // Fetch checklist items
  const checklist = await txDb
    .select()
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, id))
    .orderBy(asc(taskChecklistItems.sortOrder));

  // Fetch dependencies
  const dependencies = await txDb
    .select({
      id: taskDependencies.id,
      prerequisiteTaskId: taskDependencies.prerequisiteTaskId,
      prerequisiteTitle: tasks.title,
      prerequisiteStatus: tasks.status,
    })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.prerequisiteTaskId, tasks.id))
    .where(eq(taskDependencies.dependentTaskId, id));

  // Compute deadline
  const allEvents = await txDb
    .select({ id: events.id, startTime: events.startTime, status: events.status })
    .from(events);
  const eventsMap = new Map<string, EventDateInfo>();
  for (const e of allEvents) {
    const solarDateStr = e.startTime ? new Date(e.startTime).toISOString().slice(0, 10) : null;
    eventsMap.set(e.id, {
      id: e.id,
      solarDate: solarDateStr,
      isDateConfirmed: e.status === 'confirmed' && Boolean(solarDateStr),
    });
  }

  const metrics = computeEffectiveDueDate(task, eventsMap);
  const fullTask = {
    ...task,
    computed_due_date: metrics.effectiveDueDateString,
    is_waiting_official_date: metrics.isWaitingOfficialDate,
    is_overdue: metrics.isOverdue,
    checklist,
    dependencies,
  };

  if (role === 'family_view') {
    return toTaskFamilyDto(fullTask);
  }

  return fullTask;
}

export async function createTask(
  txDb: TxOrDb,
  input: CreateTaskInput,
  userId: string
) {
  const [created] = await txDb
    .insert(tasks)
    .values({
      title: input.title,
      category: input.category || null,
      eventId: input.event_id || null,
      inChargeUserId: input.in_charge_user_id || null,
      supportContacts: input.support_contacts || [],
      priority: input.priority as any,
      status: input.status as any,
      deadlineType: input.deadline_type as any,
      fixedDate: input.fixed_date || null,
      fixedDatetime: input.fixed_datetime ? new Date(input.fixed_datetime) : null,
      relativeEventId: input.relative_event_id || null,
      relativeOffsetDays: input.relative_offset_days ?? null,
      relativeDirection: (input.relative_direction as any) || 'before',
      pinnedManual: input.pinned_manual || false,
      privateNotes: input.private_notes || null,
      sharedWithFamily: input.shared_with_family || false,
      sharedPublicTitle: input.shared_public_title || null,
      sharedPublicNotes: input.shared_public_notes || null,
      version: 1,
    })
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'CREATE',
    entityType: 'tasks',
    entityId: created.id,
    afterState: created,
  });

  return created;
}

export async function updateTask(
  txDb: TxOrDb,
  id: string,
  input: UpdateTaskInput,
  userId: string
) {
  const [existing] = await txDb
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!existing) {
    throw new TaskNotFoundError();
  }

  if (existing.version !== input.version) {
    throw new TaskVersionConflictError();
  }

  // Reopening check
  let reopenedAt = existing.reopenedAt;
  if (existing.status === 'completed' && input.status !== 'completed') {
    reopenedAt = new Date();
  }

  const [updated] = await txDb
    .update(tasks)
    .set({
      title: input.title,
      category: input.category || null,
      eventId: input.event_id || null,
      inChargeUserId: input.in_charge_user_id || null,
      supportContacts: input.support_contacts || [],
      priority: input.priority as any,
      status: input.status as any,
      deadlineType: input.deadline_type as any,
      fixedDate: input.fixed_date || null,
      fixedDatetime: input.fixed_datetime ? new Date(input.fixed_datetime) : null,
      relativeEventId: input.relative_event_id || null,
      relativeOffsetDays: input.relative_offset_days ?? null,
      relativeDirection: (input.relative_direction as any) || 'before',
      pinnedManual: input.pinned_manual ?? existing.pinnedManual,
      privateNotes: input.private_notes || null,
      sharedWithFamily: input.shared_with_family ?? existing.sharedWithFamily,
      sharedPublicTitle: input.shared_public_title || null,
      sharedPublicNotes: input.shared_public_notes || null,
      reopenedAt,
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.version, input.version)))
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'UPDATE',
    entityType: 'tasks',
    entityId: id,
    beforeState: existing,
    afterState: updated,
  });

  return updated;
}

export async function updateTaskStatus(
  txDb: TxOrDb,
  id: string,
  status: TaskStatus,
  version: number,
  userId: string
) {
  const [existing] = await txDb
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!existing) {
    throw new TaskNotFoundError();
  }

  if (existing.version !== version) {
    throw new TaskVersionConflictError();
  }

  let reopenedAt = existing.reopenedAt;
  if (existing.status === 'completed' && status !== 'completed') {
    reopenedAt = new Date();
  }

  const [updated] = await txDb
    .update(tasks)
    .set({
      status: status as any,
      reopenedAt,
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.version, version)))
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'UPDATE_STATUS',
    entityType: 'tasks',
    entityId: id,
    beforeState: existing,
    afterState: updated,
  });

  return updated;
}

export async function deleteTask(txDb: TxOrDb, id: string, userId: string) {
  const [existing] = await txDb
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!existing) {
    throw new TaskNotFoundError();
  }

  await txDb.delete(taskDependencies).where(sql`${taskDependencies.dependentTaskId} = ${id} OR ${taskDependencies.prerequisiteTaskId} = ${id}`);
  await txDb.delete(taskChecklistItems).where(eq(taskChecklistItems.taskId, id));
  await txDb.delete(tasks).where(eq(tasks.id, id));

  await txDb.insert(auditLogs).values({
    userId,
    action: 'DELETE',
    entityType: 'tasks',
    entityId: id,
    beforeState: existing,
  });

  return { success: true };
}

/**
 * Adds task prerequisite dependency with DAG cycle prevention (AT19).
 */
export async function addTaskDependency(
  txDb: TxOrDb,
  dependentTaskId: string,
  prerequisiteTaskId: string,
  userId: string
) {
  // 1. Fetch all existing dependencies
  const existingEdges = await txDb
    .select({
      dependentTaskId: taskDependencies.dependentTaskId,
      prerequisiteTaskId: taskDependencies.prerequisiteTaskId,
    })
    .from(taskDependencies);

  // 2. Validate cycle (throws TaskDependencyCycleError if cyclic)
  validateNoDependencyCycle(existingEdges, {
    dependentTaskId,
    prerequisiteTaskId,
  });

  // 3. Insert dependency
  const [created] = await txDb
    .insert(taskDependencies)
    .values({
      dependentTaskId,
      prerequisiteTaskId,
    })
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'ADD_DEPENDENCY',
    entityType: 'task_dependencies',
    entityId: created.id,
    afterState: created,
  });

  return created;
}

export async function removeTaskDependency(txDb: TxOrDb, id: string, userId: string) {
  const [existing] = await txDb
    .select()
    .from(taskDependencies)
    .where(eq(taskDependencies.id, id))
    .limit(1);

  if (!existing) return { success: true };

  await txDb.delete(taskDependencies).where(eq(taskDependencies.id, id));

  await txDb.insert(auditLogs).values({
    userId,
    action: 'REMOVE_DEPENDENCY',
    entityType: 'task_dependencies',
    entityId: id,
    beforeState: existing,
  });

  return { success: true };
}

export async function addChecklistItem(
  txDb: TxOrDb,
  taskId: string,
  title: string,
  sortOrder = 0
) {
  const [created] = await txDb
    .insert(taskChecklistItems)
    .values({
      taskId,
      title,
      isCompleted: false,
      sortOrder,
    })
    .returning();

  return created;
}

export async function toggleChecklistItem(
  txDb: TxOrDb,
  itemId: string,
  isCompleted: boolean
) {
  const [updated] = await txDb
    .update(taskChecklistItems)
    .set({
      isCompleted,
      updatedAt: new Date(),
    })
    .where(eq(taskChecklistItems.id, itemId))
    .returning();

  return updated;
}
