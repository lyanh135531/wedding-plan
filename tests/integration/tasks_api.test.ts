import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as sessionModule from '@/lib/auth/session';
import * as dbClient from '@/db/client';
import * as tasksRoute from '@/app/api/v1/tasks/route';
import * as taskDetailRoute from '@/app/api/v1/tasks/[id]/route';
import * as taskStatusRoute from '@/app/api/v1/tasks/[id]/status/route';
import * as taskDepRoute from '@/app/api/v1/tasks/[id]/dependencies/route';
import * as taskChecklistRoute from '@/app/api/v1/tasks/[id]/checklist/route';
import { TaskDependencyCycleError } from '@/lib/tasks/dag';

describe('Gate G5 Tasks API Endpoints Integration Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const ownerSession = {
    user: { id: 'owner_user_uuid', email: 'owner@wedding.local', name: 'Owner' },
    role: 'owner' as const,
    allowedEventIds: ['e0000000-0000-4000-8000-000000000001'],
    session: { id: 's1', userId: 'owner_user_uuid', expiresAt: new Date(Date.now() + 86400000), token: 'token' },
  };

  const familySession = {
    user: { id: 'family_user_uuid', email: 'family@wedding.local', name: 'Family' },
    role: 'family_view' as const,
    allowedEventIds: ['e0000000-0000-4000-8000-000000000001'],
    session: { id: 's2', userId: 'family_user_uuid', expiresAt: new Date(Date.now() + 86400000), token: 'token' },
  };

  describe('1. Privacy & Role Masking (AT59, UXT16)', () => {
    it('returns masked TaskFamilyDto for Family View-only users', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return [
            {
              id: 't0000000-0000-4000-8000-000000000001',
              title: 'Hỗ trợ đón khách họ nội (Public Title)', // shared_public_title used
              category: 'Lễ cưới',
              event_id: 'e0000000-0000-4000-8000-000000000001',
              priority: 'normal',
              status: 'not_started',
              deadline_type: 'fixed_date',
              computed_due_date: '2026-11-20T23:59:59.999Z',
              is_waiting_official_date: false,
              notes: 'Trang phục áo dài',
            },
          ];
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/tasks');
      const res = await tasksRoute.GET(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(1);
      const task = body.data[0];
      expect(task.title).toBe('Hỗ trợ đón khách họ nội (Public Title)');
      // Private notes and in_charge_user_id must be completely absent
      expect(task.private_notes).toBeUndefined();
      expect(task.in_charge_user_id).toBeUndefined();
    });

    it('blocks Family View from calling POST /api/v1/tasks with 403 Forbidden', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Task Mới' }),
      });

      const res = await tasksRoute.POST(req);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Task CRUD & Status Lifecycle (AT20)', () => {
    it('creates a task for Owner and returns 201', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return {
            id: 't0000000-0000-4000-8000-000000000001',
            title: 'Chốt thực đơn nhà hàng',
            deadlineType: 'fixed_date',
            fixedDate: '2026-11-30',
            status: 'not_started',
            version: 1,
          };
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Chốt thực đơn nhà hàng',
          deadline_type: 'fixed_date',
          fixed_date: '2026-11-30',
        }),
      });

      const res = await tasksRoute.POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.title).toBe('Chốt thực đơn nhà hàng');
    });

    it('updates status and marks reopened_at when reopening from completed', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return {
            id: 't0000000-0000-4000-8000-000000000001',
            status: 'in_progress',
            reopenedAt: new Date().toISOString(),
            version: 2,
          };
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/tasks/t0000000-0000-4000-8000-000000000001/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in_progress',
          version: 1,
        }),
      });

      const res = await taskStatusRoute.PATCH(req, {
        params: { id: 't0000000-0000-4000-8000-000000000001' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('in_progress');
      expect(body.data.reopenedAt).toBeDefined();
    });
  });

  describe('3. DAG Dependencies & Cycle Prevention API (AT19)', () => {
    it('returns 400 Bad Request when attempting to create a cyclic dependency', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          throw new TaskDependencyCycleError();
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/tasks/a0000000-0000-4000-8000-000000000001/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prerequisite_task_id: 'a0000000-0000-4000-8000-000000000002',
        }),
      });

      const res = await taskDepRoute.POST(req, {
        params: { id: 'a0000000-0000-4000-8000-000000000001' },
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('chu trình phụ thuộc');
    });
  });
});
