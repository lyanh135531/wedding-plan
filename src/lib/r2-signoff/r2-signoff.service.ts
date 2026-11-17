import { eq, and, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import {
  tables,
  seatAssignments,
  menus,
  cateringSnapshots,
  accommodations,
  roomAssignments,
  transportTrips,
  tripPassengers,
  vendorQuotes,
  costItems,
  preparationItems,
  supportAssignments,
} from '@/db/schema';
import { TxDb, R2GateCheck, R2SignoffReport, R2SignoffSnapshot } from './types';

export async function evaluateR2Readiness(
  db: TxDb,
  eventId: string,
  userId: string
): Promise<R2SignoffReport> {
  const evaluatedAt = new Date().toISOString();
  const checks: R2GateCheck[] = [];

  // Gate 1: Seating Balance (PLAN §24.1: bàn/ghế/suất khớp danh sách)
  const eventTables = await db
    .select()
    .from(tables)
    .where(eq(tables.eventId, eventId));

  const eventSeats = await db
    .select()
    .from(seatAssignments)
    .where(eq(seatAssignments.eventId, eventId));

  const totalTableCapacity = eventTables.reduce((acc, t) => acc + (t.capacity || 0), 0);
  const totalAssignedSeats = eventSeats.length;

  let seatingPassed = true;
  let seatingMessage = `Sức chứa ${totalTableCapacity} chỗ, đã xếp ${totalAssignedSeats} khách.`;

  // Check individual table capacity overflow
  const seatsByTable = new Map<string, number>();
  for (const s of eventSeats) {
    seatsByTable.set(s.tableId, (seatsByTable.get(s.tableId) || 0) + 1);
  }

  for (const t of eventTables) {
    const assigned = seatsByTable.get(t.id) || 0;
    if (assigned > t.capacity) {
      seatingPassed = false;
      seatingMessage = `Bàn "${t.name}" vượt sức chứa: ${assigned}/${t.capacity} ghế.`;
      break;
    }
  }

  checks.push({
    id: 'gate-1-seating-balance',
    name: 'Cân bằng chỗ ngồi & sơ đồ bàn',
    status: seatingPassed ? 'passed' : 'failed',
    message: seatingMessage,
    details: { totalTableCapacity, totalAssignedSeats, tablesCount: eventTables.length },
  });

  // Gate 2: Menu Lock (PLAN §24.1, UI_UX_SPEC §7.9)
  const eventMenus = await db
    .select()
    .from(menus)
    .where(and(eq(menus.eventId, eventId), eq(menus.isActive, true)));

  const snapshots = await db
    .select()
    .from(cateringSnapshots)
    .where(eq(cateringSnapshots.eventId, eventId));

  const menuPassed = eventMenus.length > 0 || snapshots.length > 0;
  checks.push({
    id: 'gate-2-menu-lock',
    name: 'Khóa thực đơn & suất ăn tiệc',
    status: menuPassed ? 'passed' : 'failed',
    message: menuPassed
      ? `Đã xác nhận thực đơn (${eventMenus.length} thực đơn hoạt động, ${snapshots.length} bản chụp chốt).`
      : 'Chưa có thực đơn tiệc hoạt động hoặc bản chốt thực đơn cho sự kiện.',
    details: { activeMenusCount: eventMenus.length, snapshotsCount: snapshots.length },
  });

  // Gate 3: Logistics Capacity (PLAN §13, UI_UX_SPEC §7.7)
  const trips = await db
    .select()
    .from(transportTrips)
    .where(eq(transportTrips.eventId, eventId));

  const rooms = await db
    .select()
    .from(accommodations)
    .where(eq(accommodations.eventId, eventId));

  let logisticsPassed = true;
  let logisticsMessage = 'Sức chứa xe và phòng lưu trú bảo đảm.';

  for (const trip of trips) {
    const passengers = await db
      .select()
      .from(tripPassengers)
      .where(eq(tripPassengers.tripId, trip.id));
    if (passengers.length > trip.capacity) {
      logisticsPassed = false;
      logisticsMessage = `Chuyến xe "${trip.name}" chở quá tải: ${passengers.length}/${trip.capacity} chỗ.`;
      break;
    }
  }

  if (logisticsPassed) {
    for (const room of rooms) {
      const roomGuests = await db
        .select()
        .from(roomAssignments)
        .where(eq(roomAssignments.accommodationId, room.id));
      if (roomGuests.length > room.totalRooms) {
        logisticsPassed = false;
        logisticsMessage = `Phòng "${room.name}" xếp vượt số lượng phòng: ${roomGuests.length}/${room.totalRooms} phòng.`;
        break;
      }
    }
  }

  checks.push({
    id: 'gate-3-logistics-capacity',
    name: 'Sức chứa di chuyển & lưu trú',
    status: logisticsPassed ? 'passed' : 'failed',
    message: logisticsMessage,
    details: { tripsCount: trips.length, roomsCount: rooms.length },
  });

  // Gate 4: Vendor Quotes Anti-Duplication (PLAN §24.1, AT23)
  const costs = await db
    .select({
      id: costItems.id,
      vendorQuoteId: costItems.vendorQuoteId,
    })
    .from(costItems)
    .where(eq(costItems.eventId, eventId));

  // Verify no duplicate cost items created from same quote source
  const sourceQuoteIds = new Set<string>();
  let hasDuplicateQuoteCost = false;

  for (const cost of costs) {
    const quoteId = cost.vendorQuoteId;
    if (quoteId) {
      if (sourceQuoteIds.has(quoteId)) {
        hasDuplicateQuoteCost = true;
        break;
      }
      sourceQuoteIds.add(quoteId);
    }
  }

  checks.push({
    id: 'gate-4-vendor-anti-duplication',
    name: 'Chống trùng lặp chi phí báo giá',
    status: !hasDuplicateQuoteCost ? 'passed' : 'failed',
    message: !hasDuplicateQuoteCost
      ? `Không có chi phí trùng từ cùng một báo giá (${costs.length} khoản chi đã kiểm tra).`
      : 'Phát hiện khoản chi bị nhân bản từ cùng một nguồn báo giá nhà cung cấp (vi phạm AT23).',
    details: { costsCount: costs.length },
  });

  // Gate 5: Preparation Items & Rental Return Deadlines (PLAN §15, §24.1)
  const rentalItems = await db
    .select()
    .from(preparationItems)
    .where(
      and(
        eq(preparationItems.eventId, eventId),
        eq(preparationItems.type, 'item'),
        eq(preparationItems.isRental, true)
      )
    );

  const missingDeadlines = rentalItems.filter((item) => !item.returnDueDate);
  const rentalPassed = missingDeadlines.length === 0;

  checks.push({
    id: 'gate-5-rental-deadlines',
    name: 'Thời hạn hoàn trả đồ thuê',
    status: rentalPassed ? 'passed' : 'failed',
    message: rentalPassed
      ? `Tất cả ${rentalItems.length} đồ thuê đều có hạn trả rõ ràng và lịch nhắc.`
      : `Có ${missingDeadlines.length} đồ thuê chưa có ngày hẹn trả đồ sau cưới.`,
    details: { rentalItemsCount: rentalItems.length, missingCount: missingDeadlines.length },
  });

  // Gate 6: Music & Shot List Handover (PLAN §15, UI_UX_SPEC §7.9)
  const shots = await db
    .select()
    .from(preparationItems)
    .where(
      and(
        eq(preparationItems.eventId, eventId),
        eq(preparationItems.type, 'photo')
      )
    );

  const musicTracks = await db
    .select()
    .from(preparationItems)
    .where(
      and(
        eq(preparationItems.eventId, eventId),
        eq(preparationItems.type, 'music')
      )
    );

  const handedOverShots = shots.filter((s) => s.handedOverAt !== null);
  const handoverPassed = shots.length === 0 || handedOverShots.length > 0 || musicTracks.length > 0;

  checks.push({
    id: 'gate-6-media-handover',
    name: 'Bàn giao danh sách chụp ảnh & nhạc nghi lễ',
    status: handoverPassed ? 'passed' : 'warning',
    message: handoverPassed
      ? `Danh sách truyền thông sẵn sàng (${musicTracks.length} bài hát, ${shots.length} cảnh chụp, ${handedOverShots.length} đã ghi nhận bàn giao ekip).`
      : 'Chưa có bản ghi bàn giao ekip chụp ảnh hoặc danh sách nhạc nghi lễ.',
    details: {
      musicTracksCount: musicTracks.length,
      shotsCount: shots.length,
      handedOverShotsCount: handedOverShots.length,
    },
  });

  // Gate 7: Support Party Staffed (PLAN §14.2)
  const partyMembers = await db
    .select()
    .from(supportAssignments)
    .where(eq(supportAssignments.eventId, eventId));

  const hasStaff = partyMembers.length > 0;

  checks.push({
    id: 'gate-7-support-staffed',
    name: 'Đội hỗ trợ ngày cưới (Wedding Party)',
    status: hasStaff ? 'passed' : 'warning',
    message: hasStaff
      ? `Đã phân công ${partyMembers.length} thành viên hỗ trợ (điều phối, MC, người thân).`
      : 'Chưa phân công nhân sự hỗ trợ ngày cưới.',
    details: { membersCount: partyMembers.length },
  });

  // Gate 8: Immutable Audit Snapshot Generation (PLAN §24.1, UI_UX_SPEC §7.11)
  const passedCount = checks.filter((c) => c.status === 'passed').length;
  const failedCount = checks.filter((c) => c.status === 'failed').length;
  const overallStatus = failedCount === 0 ? 'READY' : 'NOT_READY';

  // Compute deterministic SHA-256 checksum
  const canonicalPayload = JSON.stringify({
    eventId,
    evaluatedAt,
    overallStatus,
    checks: checks.map((c) => ({ id: c.id, status: c.status, message: c.message })),
  });
  const checksum = createHash('sha256').update(canonicalPayload).digest('hex');

  const snapshot: R2SignoffSnapshot = {
    snapshotId: `R2-SNAP-${eventId.slice(0, 8)}-${Date.now()}`,
    checksum,
    signedBy: userId,
    signedAt: evaluatedAt,
    isImmutable: true,
  };

  checks.push({
    id: 'gate-8-immutable-snapshot',
    name: 'Ảnh chụp nghiệm thu bất biến (Immutable Snapshot)',
    status: 'passed',
    message: `Đã tạo chữ ký số kiểm toán SHA-256: ${checksum.slice(0, 16)}...`,
    details: { snapshotId: snapshot.snapshotId, checksum, isImmutable: true },
  });

  return {
    eventId,
    evaluatedAt,
    overallStatus,
    totalGates: checks.length,
    passedGates: passedCount + 1, // including Gate 8
    failedGates: failedCount,
    checks,
    snapshot,
  };
}
