import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getMenuById,
  addMenuItem,
  listMenuItems,
  MenuNotFoundError,
} from '@/lib/catering';
import { addMenuItemSchema } from '@/schemas/catering';
import { enforceOwnerRole, handleG8Error } from '../../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã thực đơn không hợp lệ.' });

const createItemBodySchema = z.object({
  eventId: z.string().uuid().optional(),
  courseOrder: z.number().int().default(1),
  courseType: z.enum(['appetizer', 'main', 'dessert', 'beverage']).default('main'),
  name: z.string().trim().min(1, { message: 'Tên món ăn không được để trống' }).max(255),
  dietaryFlags: z.array(z.string()).default([]),
  allergens: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
});

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

/**
 * GET /api/v1/menus/[id]/items
 * Danh sách các món ăn trong thực đơn.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã thực đơn không hợp lệ.' },
        { status: 400 }
      );
    }

    const session = await getCurrentSession(req);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' },
        { status: 401 }
      );
    }

    const items = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return listMenuItems(scopedDb, id);
      }
    );

    return NextResponse.json({
      data: items,
      total: items.length,
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * POST /api/v1/menus/[id]/items
 * Thêm món ăn vào thực đơn.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã thực đơn không hợp lệ.' },
        { status: 400 }
      );
    }

    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
    if (authError) return authError;

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Dữ liệu yêu cầu không hợp lệ (JSON invalid).' },
        { status: 400 }
      );
    }

    const parseResult = createItemBodySchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu món ăn không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const created = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        let eventId = parseResult.data.eventId;
        if (!eventId) {
          const menu = await getMenuById(scopedDb, id);
          if (!menu) {
            throw new MenuNotFoundError();
          }
          eventId = menu.eventId;
        }

        return addMenuItem(scopedDb, {
          menuId: id,
          eventId,
          courseOrder: parseResult.data.courseOrder,
          courseType: parseResult.data.courseType,
          name: parseResult.data.name,
          dietaryFlags: parseResult.data.dietaryFlags,
          allergens: parseResult.data.allergens,
          notes: parseResult.data.notes,
        });
      }
    );

    return NextResponse.json(
      {
        data: created,
        message: 'Thêm món ăn thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
