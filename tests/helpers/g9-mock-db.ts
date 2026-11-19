import { vi } from 'vitest';
import * as crypto from 'node:crypto';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { TxDb } from '@/lib/preparation';

export interface MockG9Store {
  preparationItems?: Array<any>;
  supportAssignments?: Array<any>;
  tables?: Array<any>;
  seatAssignments?: Array<any>;
  menus?: Array<any>;
  cateringSnapshots?: Array<any>;
  accommodations?: Array<any>;
  roomAssignments?: Array<any>;
  transportTrips?: Array<any>;
  tripPassengers?: Array<any>;
  vendorQuotes?: Array<any>;
  costItems?: Array<any>;
  events?: Array<any>;
  handoverPackets?: Array<any>;
  attendance?: Array<any>;
}

function extractFilters(sqlObj: any, target: Record<string, any> = {}): Record<string, any> {
  if (!sqlObj || !sqlObj.queryChunks) return target;
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
  return target;
}

export function createMockG9TxDb(initialStore: MockG9Store = {}) {
  const store: Required<MockG9Store> = {
    preparationItems: [...(initialStore.preparationItems || [])],
    supportAssignments: [...(initialStore.supportAssignments || [])],
    tables: [...(initialStore.tables || [])],
    seatAssignments: [...(initialStore.seatAssignments || [])],
    menus: [...(initialStore.menus || [])],
    cateringSnapshots: [...(initialStore.cateringSnapshots || [])],
    accommodations: [...(initialStore.accommodations || [])],
    roomAssignments: [...(initialStore.roomAssignments || [])],
    transportTrips: [...(initialStore.transportTrips || [])],
    tripPassengers: [...(initialStore.tripPassengers || [])],
    vendorQuotes: [...(initialStore.vendorQuotes || [])],
    costItems: [...(initialStore.costItems || [])],
    events: [...(initialStore.events || [])],
    handoverPackets: [...(initialStore.handoverPackets || [])],
    attendance: [...(initialStore.attendance || [])],
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
      case 'attendance':
        return store.attendance;
      case 'preparation_items':
        return store.preparationItems;
      case 'support_assignments':
        return store.supportAssignments;
      case 'tables':
        return store.tables;
      case 'seat_assignments':
        return store.seatAssignments;
      case 'menus':
        return store.menus;
      case 'catering_snapshots':
        return store.cateringSnapshots;
      case 'accommodations':
        return store.accommodations;
      case 'room_assignments':
        return store.roomAssignments;
      case 'transport_trips':
        return store.transportTrips;
      case 'trip_passengers':
        return store.tripPassengers;
      case 'vendor_quotes':
        return store.vendorQuotes;
      case 'cost_items':
        return store.costItems;
      case 'handover_packets': return store.handoverPackets;
      case 'events':
        return store.events;
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
        where: vi.fn().mockImplementation((condition: any) => {
          filters = extractFilters(condition, {});
          currentRows = currentRows.filter((row) => {
            for (const [key, expected] of Object.entries(filters)) {
              if (expected && typeof expected === 'object' && 'in' in expected) {
                if (!expected.in.includes(row[key])) return false;
              } else if (expected !== undefined) {
                if (row[key] !== expected) return false;
              }
            }
            return true;
          });
          return queryBuilder;
        }),
        orderBy: vi.fn().mockImplementation((_orderCol: any) => {
          return queryBuilder;
        }),
        then: (resolve: (val: any) => void) => {
          if (selectFields && typeof selectFields === 'object') {
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

      queryBuilder.for = vi.fn().mockReturnValue(queryBuilder);
      queryBuilder.limit = vi.fn().mockReturnValue(queryBuilder);
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
