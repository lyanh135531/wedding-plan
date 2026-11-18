import { vi } from 'vitest';
import * as crypto from 'node:crypto';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { TxDb } from '@/lib/seating';

export interface MockG8Store {
  tables?: Array<any>;
  seatAssignments?: Array<any>;
  attendance?: Array<any>;
  guests?: Array<any>;
  auditLogs?: Array<any>;
  menus?: Array<any>;
  menuItems?: Array<any>;
  guestMealSelections?: Array<any>;
  cateringSnapshots?: Array<any>;
  accommodations?: Array<any>;
  roomAssignments?: Array<any>;
  transportTrips?: Array<any>;
  tripPassengers?: Array<any>;
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

export function createMockG8TxDb(initialStore: MockG8Store = {}) {
  const store: Required<MockG8Store> = {
    tables: [...(initialStore.tables || [])],
    seatAssignments: [...(initialStore.seatAssignments || [])],
    attendance: [...(initialStore.attendance || [])],
    guests: [...(initialStore.guests || [])],
    auditLogs: [...(initialStore.auditLogs || [])],
    menus: [...(initialStore.menus || [])],
    menuItems: [...(initialStore.menuItems || [])],
    guestMealSelections: [...(initialStore.guestMealSelections || [])],
    cateringSnapshots: [...(initialStore.cateringSnapshots || [])],
    accommodations: [...(initialStore.accommodations || [])],
    roomAssignments: [...(initialStore.roomAssignments || [])],
    transportTrips: [...(initialStore.transportTrips || [])],
    tripPassengers: [...(initialStore.tripPassengers || [])],
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
      case 'tables':
        return store.tables;
      case 'seat_assignments':
        return store.seatAssignments;
      case 'attendance':
        return store.attendance;
      case 'guests':
        return store.guests;
      case 'audit_logs':
        return store.auditLogs;
      case 'menus':
        return store.menus;
      case 'menu_items':
        return store.menuItems;
      case 'guest_meal_selections':
        return store.guestMealSelections;
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
        where: vi.fn().mockImplementation((condition?: any) => {
          if (condition) {
            extractFilters(condition, filters);
          }
          return queryBuilder;
        }),
        orderBy: vi.fn().mockImplementation((_order?: any) => {
          return queryBuilder;
        }),
        limit: vi.fn().mockImplementation((n?: number) => {
          if (n !== undefined) {
            currentRows = currentRows.slice(0, n);
          }
          return queryBuilder;
        }),
        offset: vi.fn().mockImplementation((_n?: number) => {
          return queryBuilder;
        }),
        for: vi.fn().mockImplementation((_lockType?: string) => {
          return queryBuilder;
        }),
        then: (resolve: (val: any) => void) => {
          // Apply filters if any
          let filtered = currentRows;
          const filterKeys = Object.keys(filters);
          if (filterKeys.length > 0) {
            filtered = currentRows.filter((row) => {
              return filterKeys.every((key) => {
                const targetVal = filters[key];
                const snake = key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
                const rowVal = row[key] !== undefined ? row[key] : row[snake];
                if (targetVal && typeof targetVal === 'object' && targetVal.in && Array.isArray(targetVal.in)) {
                  return targetVal.in.includes(rowVal);
                }
                return rowVal === targetVal;
              });
            });
          }

          if (selectFields && typeof selectFields === 'object') {
            const mapped = filtered.map((row) => {
              const res: any = {};
              for (const key of Object.keys(selectFields)) {
                res[key] = row[key];
              }
              return res;
            });
            return Promise.resolve(mapped).then(resolve);
          }
          return Promise.resolve(filtered).then(resolve);
        },
      };

      return queryBuilder;
    }),

    insert: vi.fn().mockImplementation((table: any) => {
      const tableName = getTableName(table);
      const arr = getStoreArray(tableName);
      let valuesToInsert: any = null;

      function doInsert() {
        const items = Array.isArray(valuesToInsert) ? valuesToInsert : [valuesToInsert];
        return items.map((val) => {
          const item = {
            id: val.id || crypto.randomUUID(),
            createdAt: val.createdAt || new Date(),
            updatedAt: val.updatedAt || new Date(),
            version: val.version || 1,
            ...val,
          };
          arr.push(item);
          return item;
        });
      }

      const insertBuilder: any = {
        values: vi.fn().mockImplementation((vals: any) => {
          valuesToInsert = vals;
          return insertBuilder;
        }),
        returning: vi.fn().mockImplementation(() => {
          const inserted = doInsert();
          return Promise.resolve(Array.isArray(valuesToInsert) ? inserted : inserted);
        }),
        then: (resolve: (val: any) => void) => {
          const inserted = doInsert();
          return Promise.resolve(Array.isArray(valuesToInsert) ? inserted : inserted[0]).then(resolve);
        },
      };

      return insertBuilder;
    }),

    update: vi.fn().mockImplementation((table: any) => {
      const tableName = getTableName(table);
      const arr = getStoreArray(tableName);
      let updateValues: any = {};
      let updateFilters: Record<string, any> = {};

      const updateBuilder: any = {
        set: vi.fn().mockImplementation((vals: any) => {
          updateValues = vals;
          return updateBuilder;
        }),
        where: vi.fn().mockImplementation((cond: any) => {
          if (cond) extractFilters(cond, updateFilters);
          return updateBuilder;
        }),
        returning: vi.fn().mockImplementation(() => {
          const filterKeys = Object.keys(updateFilters);
          let target = arr[arr.length - 1];
          if (filterKeys.length > 0) {
            const found = arr.find((row) => filterKeys.every((k) => row[k] === updateFilters[k] || row[k] === undefined));
            if (found) target = found;
          }
          if (target) {
            Object.assign(target, updateValues);
            return Promise.resolve([target]);
          }
          return Promise.resolve([]);
        }),
      };

      return updateBuilder;
    }),

    delete: vi.fn().mockImplementation((table: any) => {
      const tableName = getTableName(table);
      const arr = getStoreArray(tableName);
      let deleteFilters: Record<string, any> = {};

      const deleteBuilder: any = {
        where: vi.fn().mockImplementation((cond: any) => {
          if (cond) extractFilters(cond, deleteFilters);
          return deleteBuilder;
        }),
        returning: vi.fn().mockImplementation(() => {
          const filterKeys = Object.keys(deleteFilters);
          if (filterKeys.length > 0) {
            const idx = arr.findIndex((row) => filterKeys.every((k) => row[k] === deleteFilters[k] || row[k] === undefined));
            if (idx !== -1) {
              const [deleted] = arr.splice(idx, 1);
              return Promise.resolve([deleted]);
            }
          }
          if (arr.length > 0) {
            const popped = arr.pop();
            return Promise.resolve([popped]);
          }
          return Promise.resolve([]);
        }),
      };

      return deleteBuilder;
    }),
  };

  return txDb as TxDb & { _store: Required<MockG8Store> };
}
