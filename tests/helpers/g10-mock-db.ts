import { vi } from 'vitest';
import * as crypto from 'node:crypto';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { TxDb } from '@/lib/timeline';

export interface MockG10Store {
  timelineItems?: Array<any>;
  attendance?: Array<any>;
  guests?: Array<any>;
  events?: Array<any>;
  weddingSettings?: Array<any>;
  tables?: Array<any>;
  seatAssignments?: Array<any>;
  gifts?: Array<any>;
  giftContributors?: Array<any>;
  giftReturns?: Array<any>;
  handoverPackets?: Array<any>;
  postWeddingTasks?: Array<any>;
  costItems?: Array<any>;
  preparationItems?: Array<any>;
  supportAssignments?: Array<any>;
  auditLogs?: Array<any>;
}

function extractFilters(sqlObj: any, target: Record<string, any> = {}): Record<string, any> {
  if (!sqlObj) return target;
  if (sqlObj.queryChunks) {
    const chunks = sqlObj.queryChunks;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk && chunk.queryChunks) {
        extractFilters(chunk, target);
      } else if (chunk && chunk.name && i + 2 < chunks.length) {
        const opRaw = chunks[i + 1]?.value?.[0];
        const op = typeof opRaw === 'string' ? opRaw.trim().toLowerCase() : '';
        const rawVal = chunks[i + 2];
        const val = Array.isArray(rawVal)
          ? rawVal.flat(2).map((v: any) => (v?.value !== undefined ? v.value : v))
          : rawVal?.value !== undefined
          ? rawVal.value
          : rawVal;
        const camel = chunk.name.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());

        if (op === '=' || op === 'is') {
          target[camel] = val;
        } else if (op === 'in' && Array.isArray(val)) {
          target[camel] = { in: val };
        }
      }
    }
  }
  return target;
}

export function createMockG10TxDb(initialStore: MockG10Store = {}) {
  const store: Required<MockG10Store> = {
    timelineItems: [...(initialStore.timelineItems || [])],
    attendance: [...(initialStore.attendance || [])],
    guests: [...(initialStore.guests || [])],
    events: [...(initialStore.events || [])],
    weddingSettings: [...(initialStore.weddingSettings || [])],
    tables: [...(initialStore.tables || [])],
    seatAssignments: [...(initialStore.seatAssignments || [])],
    gifts: [...(initialStore.gifts || [])],
    giftContributors: [...(initialStore.giftContributors || [])],
    giftReturns: [...(initialStore.giftReturns || [])],
    handoverPackets: [...(initialStore.handoverPackets || [])],
    postWeddingTasks: [...(initialStore.postWeddingTasks || [])],
    costItems: [...(initialStore.costItems || [])],
    preparationItems: [...(initialStore.preparationItems || [])],
    supportAssignments: [...(initialStore.supportAssignments || [])],
    auditLogs: [...(initialStore.auditLogs || [])],
  };

  function getTableName(table: any): string {
    try {
      return getTableConfig(table).name;
    } catch {
      return (table as any)?._?.name || (table as any)?.name || 'unknown';
    }
  }

  function getStoreArray(tableName: string): any[] {
    switch (tableName) {
      case 'timeline_items':
        return store.timelineItems;
      case 'attendance':
        return store.attendance;
      case 'guests':
        return store.guests;
      case 'events':
        return store.events;
      case 'wedding_settings':
        return store.weddingSettings;
      case 'tables':
        return store.tables;
      case 'seat_assignments':
        return store.seatAssignments;
      case 'gifts':
        return store.gifts;
      case 'gift_contributors':
        return store.giftContributors;
      case 'gift_returns':
        return store.giftReturns;
      case 'handover_packets':
        return store.handoverPackets;
      case 'post_wedding_tasks':
        return store.postWeddingTasks;
      case 'cost_items':
        return store.costItems;
      case 'preparation_items':
        return store.preparationItems;
      case 'support_assignments':
        return store.supportAssignments;
      case 'audit_logs':
        return store.auditLogs;
      default:
        return [];
    }
  }

  const txDb: any = {
    _store: store,

    select: vi.fn().mockImplementation((selectFields?: any) => {
      let tableName = '';
      let currentRows: any[] = [];
      let filters: Record<string, any> = {};

      const queryBuilder: any = {
        from: vi.fn().mockImplementation((table: any) => {
          tableName = getTableName(table);
          currentRows = [...getStoreArray(tableName)];
          return queryBuilder;
        }),
        innerJoin: vi.fn().mockImplementation((joinedTable: any, _condition: any) => {
          const joinedName = getTableName(joinedTable);
          const joinedRows = getStoreArray(joinedName);

          if (tableName === 'attendance' && joinedName === 'guests') {
            currentRows = currentRows.map((att) => {
              const guest = joinedRows.find((g) => g.id === att.guestId);
              return { attendance: att, guest };
            }).filter((r) => r.guest !== undefined);
          } else if (tableName === 'seat_assignments' && joinedName === 'tables') {
            currentRows = currentRows.map((seat) => {
              const table = joinedRows.find((t) => t.id === seat.tableId);
              return {
                tableName: table?.name,
                tableNumberStr: table?.tableNumber,
                seatNumber: seat.seatNumber,
                eventId: seat.eventId,
                guestId: seat.guestId,
              };
            });
          }
          return queryBuilder;
        }),
        where: vi.fn().mockImplementation((condition: any) => {
          filters = extractFilters(condition, {});
          currentRows = currentRows.filter((row) => {
            const rowToCheck = row.attendance ? { ...row.attendance, ...row.guest } : row;
            for (const [key, expected] of Object.entries(filters)) {
              if (expected && typeof expected === 'object' && 'in' in expected) {
                if (!expected.in.includes(rowToCheck[key])) return false;
              } else if (expected !== undefined) {
                if (rowToCheck[key] !== expected) return false;
              }
            }
            return true;
          });
          return queryBuilder;
        }),
        orderBy: vi.fn().mockImplementation((..._orderCols: any[]) => {
          return queryBuilder;
        }),
        limit: vi.fn().mockImplementation((limitNum: number) => {
          currentRows = currentRows.slice(0, limitNum);
          return queryBuilder;
        }),
        then: (resolve: (val: any) => void) => {
          if (selectFields && typeof selectFields === 'object' && !currentRows[0]?.attendance) {
            const keys = Object.keys(selectFields);
            const mapped = currentRows.map((r) => {
              const res: Record<string, any> = {};
              for (const k of keys) {
                res[k] = r[k];
              }
              return res;
            });
            resolve(mapped);
          } else {
            resolve(currentRows);
          }
        },
      };

      return queryBuilder;
    }),

    insert: vi.fn().mockImplementation((table: any) => {
      const tableName = getTableName(table);
      const targetArray = getStoreArray(tableName);

      const insertBuilder: any = {
        values: vi.fn().mockImplementation((values: any) => {
          const rowsToInsert = Array.isArray(values) ? values : [values];
          const inserted: any[] = [];

          for (const row of rowsToInsert) {
            const now = new Date();
            const record = {
              id: row.id || crypto.randomUUID(),
              ...row,
              version: row.version || 1,
              createdAt: row.createdAt || now,
              updatedAt: row.updatedAt || now,
            };
            targetArray.push(record);
            inserted.push(record);
          }

          return {
            returning: vi.fn().mockResolvedValue(inserted),
            then: (resolve: (val: any) => void) => resolve(inserted),
          };
        }),
      };
      return insertBuilder;
    }),

    update: vi.fn().mockImplementation((table: any) => {
      const tableName = getTableName(table);
      const targetArray = getStoreArray(tableName);

      const updateBuilder: any = {
        set: vi.fn().mockImplementation((updates: any) => {
          return {
            where: vi.fn().mockImplementation((condition: any) => {
              const filters = extractFilters(condition, {});
              const updated: any[] = [];

              for (let i = 0; i < targetArray.length; i++) {
                const row = targetArray[i];
                let matches = true;

                for (const [key, expected] of Object.entries(filters)) {
                  if (expected !== undefined && row[key] !== expected) {
                    matches = false;
                    break;
                  }
                }

                if (matches) {
                  const now = new Date();
                  const cleaned: Record<string, any> = {};
                  for (const [k, v] of Object.entries(updates)) {
                    if (v !== undefined) cleaned[k] = v;
                  }
                  const newRecord = {
                    ...row,
                    ...cleaned,
                    updatedAt: now,
                  };
                  targetArray[i] = newRecord;
                  updated.push(newRecord);
                }
              }

              return {
                returning: vi.fn().mockResolvedValue(updated),
                then: (resolve: (val: any) => void) => resolve(updated),
              };
            }),
          };
        }),
      };
      return updateBuilder;
    }),

    delete: vi.fn().mockImplementation((table: any) => {
      const tableName = getTableName(table);
      const targetArray = getStoreArray(tableName);

      const deleteBuilder: any = {
        where: vi.fn().mockImplementation((condition: any) => {
          const filters = extractFilters(condition, {});
          const deleted: any[] = [];

          for (let i = targetArray.length - 1; i >= 0; i--) {
            const row = targetArray[i];
            let matches = true;

            for (const [key, expected] of Object.entries(filters)) {
              if (expected !== undefined && row[key] !== expected) {
                matches = false;
                break;
              }
            }

            if (matches) {
              targetArray.splice(i, 1);
              deleted.push(row);
            }
          }

          return {
            returning: vi.fn().mockResolvedValue(deleted),
            then: (resolve: (val: any) => void) => resolve(deleted),
          };
        }),
      };
      return deleteBuilder;
    }),
  };

  return txDb;
}
