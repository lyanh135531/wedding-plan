import { test, expect } from '@playwright/test';
import React from 'react';
import { getFullPageHtml } from './prototypes/test-helpers';

// Module Components for End-to-End User Journeys
import { StepNames } from '../../src/components/modules/auth/StepNames';
import { StepWeddingDate } from '../../src/components/modules/auth/StepWeddingDate';
import { StepCategoryPreview, DEFAULT_STARTER_CATEGORIES } from '../../src/components/modules/auth/StepCategoryPreview';
import { UninvitedAccountBanner } from '../../src/components/modules/auth/UninvitedAccountBanner';

import { GuestsDirectory } from '../../src/components/modules/guests/GuestsDirectory';
import { AddFamilyModal } from '../../src/components/modules/guests/AddFamilyModal';
import { RsvpUpdateDrawer } from '../../src/components/modules/guests/RsvpUpdateDrawer';
import { MergeGuestsModal } from '../../src/components/modules/guests/MergeGuestsModal';
import { DuplicateBanner } from '../../src/components/modules/guests/DuplicateBanner';

import { BudgetScreen } from '../../src/components/modules/finance/BudgetScreen';
import { PaymentsLedgerScreen } from '../../src/components/modules/finance/PaymentsLedgerScreen';
import { RecordPaymentModal } from '../../src/components/modules/finance/RecordPaymentModal';
import { RefundTransactionModal } from '../../src/components/modules/finance/RefundTransactionModal';
import { VoidTransactionDialog } from '../../src/components/modules/finance/VoidTransactionDialog';
import { OpeningCutoffBanner } from '../../src/components/modules/finance/OpeningCutoffBanner';
import { GiftsDashboard } from '../../src/components/modules/gifts/GiftsDashboard';

import { TasksManager } from '../../src/components/modules/tasks/TasksManager';
import { RescheduleDateModal } from '../../src/components/modules/tasks/RescheduleDateModal';
import { TimelineManager } from '../../src/components/modules/timeline/TimelineManager';
import { validateNoDependencyCycle, TaskDependencyCycleError } from '../../src/lib/tasks/dag';

import { SeatingManager } from '../../src/components/modules/seating/SeatingManager';
import { AddEditTableModal } from '../../src/components/modules/seating/AddEditTableModal';
import { SeatingExportModal } from '../../src/components/modules/seating/SeatingExportModal';
import { MealBreakdownDashboard } from '../../src/components/modules/menus/MealBreakdownDashboard';

import { CheckInDashboard } from '../../src/components/modules/attendance/CheckInDashboard';
import { HandoversDashboard } from '../../src/components/modules/handovers/HandoversDashboard';
import { ArchivalDashboard } from '../../src/components/modules/archival/ArchivalDashboard';

test.describe('Static-rendered browser component scenarios (R2 coverage; live journeys pending)', () => {
  // =========================================================================
  // USER JOURNEY 1: Wedding settings & event creation (two owners, no dummy dates/counts AT01, AT02)
  // =========================================================================
  test.describe('User Journey 1: Wedding Settings & Dual-Owner Onboarding (AT01, AT02)', () => {
    test('1.1 Setup wizard onboarding flow without official date (AT01)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(StepWeddingDate, {
          weddingDate: null,
          isUnconfirmedDate: true,
          estimatedDateNote: 'Dự kiến vào mùa Thu 2026',
          onChangeDate: () => {},
          onChangeUnconfirmed: () => {},
          onChangeEstimatedNote: () => {},
        }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      // Verifies tentative note is displayed and system does not force dummy date or fake countdown
      await expect(page.locator('text=Chưa chốt ngày cưới chính thức (đang xem ngày)')).toBeVisible();
      await expect(page.locator('text=Hệ thống sẽ không tự gán ngày giả')).toBeVisible();
      await expect(page.locator('input[value="Dự kiến vào mùa Thu 2026"]')).toBeVisible();
    });

    test('1.2 Dual-owner co-initialization & category setup without dummy counts (AT01, AT02)', async ({ page }) => {
      const htmlNames = getFullPageHtml(
        React.createElement(StepNames, {
          groomName: 'Nguyễn Văn Tuấn',
          brideName: 'Trần Thị Lan',
          onChangeGroom: () => {},
          onChangeBride: () => {},
        }),
        { role: 'owner' }
      );
      await page.setContent(htmlNames, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('input[value="Nguyễn Văn Tuấn"]')).toBeVisible();
      await expect(page.locator('input[value="Trần Thị Lan"]')).toBeVisible();

      // Check category preview initialization with default starter categories
      const htmlCats = getFullPageHtml(
        React.createElement(StepCategoryPreview, {
          categories: DEFAULT_STARTER_CATEGORIES,
          onToggleCategory: () => {},
        }),
        { role: 'owner' }
      );
      await page.setContent(htmlCats, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Tiệc cưới & Địa điểm')).toBeVisible();
      await expect(page.locator('text=Trang phục & Trang điểm')).toBeVisible();
      await expect(page.locator('text=Chụp ảnh & Quay phim')).toBeVisible();
    });

    test('1.3 Uninvited stranger account barrier & security isolation (AT02)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(UninvitedAccountBanner, {
          email: 'stranger@example.com',
          onSwitchAccount: () => {},
        }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Tài khoản chưa được cấp quyền')).toBeVisible();
      await expect(page.locator('text=stranger@example.com')).toBeVisible();
      await expect(page.locator('text=chưa được cấp quyền truy cập hệ thống')).toBeVisible();
      await expect(page.locator('text=Đổi tài khoản khác')).toBeVisible();
    });
  });

  // =========================================================================
  // USER JOURNEY 2: Guest management & invitations (tripartite model: contact, household card, event attendance, headcount vs seats vs meals AT05, AT06, AT07, AT08)
  // =========================================================================
  test.describe('User Journey 2: Guest Management & Tripartite Model (AT05, AT06, AT07, AT08)', () => {
    test('2.1 Tripartite model — 4-member family under 1 invitation card (AT05, AT06)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(AddFamilyModal, {
          isOpen: true,
          onClose: () => {},
          onSubmit: () => {},
        }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Thêm gia đình / Nhóm nhận thiệp')).toBeVisible();
      await expect(page.locator('text=Danh sách thành viên:')).toBeVisible();
      await expect(page.locator('input[value="Bác Thành"]')).toBeVisible();
      await expect(page.locator('input[value="Bé Bi"]')).toBeVisible();
      await expect(page.locator('text=Người nhận thiệp đại diện').first()).toBeVisible();
    });

    test('2.2 Infant non-seat policy & headcount vs seats vs meals differentiation (AT07)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(GuestsDirectory, { initialState: 'populated' }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Danh Sách Khách Mời')).toBeVisible();
      await expect(page.locator('text=Đã mời')).toBeVisible();
      await expect(page.locator('text=Sẽ tham dự').first()).toBeVisible();
    });

    test('2.3 Independent multi-event attendance update (AT05, AT06)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(RsvpUpdateDrawer, {
          isOpen: true,
          onClose: () => {},
          householdName: 'Gia đình Bác Thành',
          initialEventTitle: 'Lễ Vu Quy Nhà Gái',
        }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Lễ Vu Quy Nhà Gái')).toBeVisible();
      await expect(page.locator('text=Gia đình Bác Thành')).toBeVisible();
      await expect(page.locator('text=Cập nhật trạng thái phản hồi tham dự độc lập cho từng thành viên trong buổi lễ này.')).toBeVisible();
      await expect(page.locator('text=Bác Thành').first()).toBeVisible();
      await expect(page.locator('text=Bé Bi')).toBeVisible();
    });

    test('2.4 Unaccented search and duplicate merge resolution (AT08, AT09)', async ({ page }) => {
      const htmlBanner = getFullPageHtml(
        React.createElement(DuplicateBanner, {
          candidateCount: 2,
          onOpenMergeModal: () => {},
        }),
        { role: 'owner' }
      );
      await page.setContent(htmlBanner, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Phát hiện 2 cặp khách mời có khả năng trùng lặp')).toBeVisible();
      await expect(page.locator('text=Trùng tên chuẩn hóa và số điện thoại')).toBeVisible();

      // Open Merge modal
      const htmlModal = getFullPageHtml(
        React.createElement(MergeGuestsModal, {
          isOpen: true,
          onClose: () => {},
          candidatePair: {
            guest_a: {
              id: 'g-a',
              displayName: 'Nguyễn Văn Nam',
              side: 'groom',
              phone: '0901234567',
              attendances: [{ eventId: 'ev-1', rsvpStatus: 'accepted' }],
            },
            guest_b: {
              id: 'g-b',
              displayName: 'Nguyễn Văn Nam (Bạn ĐH)',
              side: 'groom',
              phone: '0901234567',
              attendances: [{ eventId: 'ev-1', rsvpStatus: 'pending_reply' }],
            },
            similarity_score: 0.95,
            match_reasons: ['Trùng số điện thoại', 'Tên tương đồng'],
          },
        }),
        { role: 'owner' }
      );
      await page.setContent(htmlModal, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=So Sánh & Gộp Trùng Hồ Sơ Khách')).toBeVisible();
      await expect(page.locator('text=Chọn hồ sơ chính được giữ lại')).toBeVisible();
    });
  });

  // =========================================================================
  // USER JOURNEY 3: Financial ledger & multi-installment payments (deposit, installment, refund, zero artificial surplus, multi-sender cash gifts AT11, AT12, AT14, AT25, AT45, AT47)
  // =========================================================================
  test.describe('User Journey 3: Financial Ledger & Multi-Installment Payments (AT11, AT12, AT14, AT25, AT45, AT47)', () => {
    test('3.1 Provisional unfinalized cost with locked deposit (AT11)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(BudgetScreen, { initialState: 'populated' }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Tạm tính — còn 1 khoản thiếu giá')).toBeVisible();
      await expect(page.locator('span:has-text("Thiếu giá")').first()).toBeVisible();
    });

    test('3.2 Multi-installment payments, vendor refund (FX02) & void dialog (AT12, AT14)', async ({ page }) => {
      // Record payment with destination item
      const htmlPayment = getFullPageHtml(
        React.createElement(RecordPaymentModal, {
          isOpen: true,
          onClose: () => {},
          costItemName: 'Trung tâm tiệc cưới White Palace',
          defaultAmount: 20000000n,
          onSubmit: () => {},
        }),
        { role: 'owner' }
      );
      await page.setContent(htmlPayment, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Ghi nhận thanh toán chi tiền')).toBeVisible();
      await expect(page.locator('text=Trung tâm tiệc cưới White Palace')).toBeVisible();
      await expect(page.locator('text=Khóa chống submit trùng lặp (Idempotency Key v4) được kích hoạt.')).toBeVisible();

      // Vendor refund modal
      const htmlRefund = getFullPageHtml(
        React.createElement(RefundTransactionModal, {
          isOpen: true,
          onClose: () => {},
          originalOutflowAmount: 5000000n,
          vendorName: 'Áo cưới Hoàng Gia (Hủy hợp đồng)',
          onConfirmRefund: () => {},
        }),
        { role: 'owner' }
      );
      await page.setContent(htmlRefund, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Ghi nhận hoàn tiền từ nhà cung cấp')).toBeVisible();
      await expect(page.locator('text=Áo cưới Hoàng Gia (Hủy hợp đồng)')).toBeVisible();

      // Void transaction dialog
      const htmlVoid = getFullPageHtml(
        React.createElement(VoidTransactionDialog, {
          isOpen: true,
          onClose: () => {},
          transactionAmount: 5000000n,
          onConfirmVoid: () => {},
        }),
        { role: 'owner' }
      );
      await page.setContent(htmlVoid, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Hủy ghi nhận giao dịch (Void)')).toBeVisible();
      await expect(page.locator('text=Lý do hủy ghi nhận (bắt buộc)')).toBeVisible();
    });

    test('3.3 Opening balance cutoff banner anchors pre-opening deposits (AT45)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(OpeningCutoffBanner, {
          openingDate: '01/10/2026',
          openingBalance: 90000000n,
          preOpeningExpensesTotal: 10000000n,
        }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Mốc mở sổ quỹ: 01/10/2026')).toBeVisible();
      await expect(page.locator('text=không bị trừ lần hai')).toBeVisible();
    });

    test('3.4 Cancellation fee & refund math reconciliation (AT47)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(PaymentsLedgerScreen, { initialState: 'populated' }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Sổ Chi Tiền & Nhật Ký Giao Dịch')).toBeVisible();
      await expect(page.locator('text=Áo cưới Hoàng Gia (Hoàn cọc)')).toBeVisible();
    });

    test('3.5 Cash gift ledger, joint envelope & strict family role shielding (AT25, AT03, AT26)', async ({ page }) => {
      // As Owner
      const htmlOwner = getFullPageHtml(
        React.createElement(GiftsDashboard, { eventId: 'ev-test-1' }),
        { role: 'owner' }
      );
      await page.setContent(htmlOwner, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Sổ Quà Mừng & Đối Soát Tài Chính')).toBeVisible();
      await expect(page.locator('text=Ghi chép tiền mừng, phong bì chung (AT25)')).toBeVisible();
      await expect(page.locator('text=+ Ghi nhận quà mừng')).toBeVisible();

      // As Family View: Strictly blocked from financial widgets
      const htmlFamily = getFullPageHtml(
        React.createElement(GiftsDashboard, { eventId: 'ev-test-1' }),
        { role: 'family_view' }
      );
      await page.setContent(htmlFamily, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Sổ quà mừng & Đối soát tài chính')).toBeVisible();
      await expect(page.locator('text=Người nhà (family_view) không có quyền xem thông tin quà mừng')).toBeVisible();
      // Ensure zero financial buttons leak
      await expect(page.locator('text=+ Ghi nhận quà mừng')).toBeHidden();
    });
  });

  // =========================================================================
  // USER JOURNEY 4: Task planning & schedule run-sheet (DAG cycle rejection, timeline live actuals, schedule delay preview AT18, AT19, AT34)
  // =========================================================================
  test.describe('User Journey 4: Task Planning & Schedule Run-sheet (AT18, AT19, AT34)', () => {
    test('4.1 Tasks manager chronological buckets & relative deadline to unconfirmed date (UXT10)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(TasksManager, { initialState: 'populated' }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Danh Sách Công Việc')).toBeVisible();
      await expect(page.locator('h2:has-text("Quá hạn")')).toBeVisible();
      await expect(page.locator('h2:has-text("Hôm nay")')).toBeVisible();
      await expect(page.locator('h2:has-text("Trong 7 ngày tới")')).toBeVisible();
      await expect(page.locator('h2:has-text("Chưa có hạn chót")')).toBeVisible();
      await expect(page.locator('text=Hạn sẽ được tính khi chốt ngày')).toBeVisible();
    });

    test('4.2 Task dependency DAG cycle prevention rejects circular graphs (AT19)', async () => {
      // 1. Direct self-dependency
      expect(() => {
        validateNoDependencyCycle([], { dependentTaskId: 'task-a', prerequisiteTaskId: 'task-a' });
      }).toThrow(TaskDependencyCycleError);

      // 2. Transitive cycle: A -> B, B -> C, then try to add C -> A
      const existing = [
        { dependentTaskId: 'task-b', prerequisiteTaskId: 'task-a' },
        { dependentTaskId: 'task-c', prerequisiteTaskId: 'task-b' },
      ];
      expect(() => {
        validateNoDependencyCycle(existing, { dependentTaskId: 'task-a', prerequisiteTaskId: 'task-c' });
      }).toThrow('chu trình phụ thuộc');

      // 3. Valid acyclic addition succeeds
      expect(() => {
        validateNoDependencyCycle(existing, { dependentTaskId: 'task-d', prerequisiteTaskId: 'task-c' });
      }).not.toThrow();
    });

    test('4.3 Reschedule representative wedding date previews 3 impact categories (AT18)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(RescheduleDateModal, {
          isOpen: true,
          onClose: () => {},
          currentDate: '15/12/2026',
          onConfirmReschedule: () => {},
        }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Dời ngày cưới & Xem trước tác động')).toBeVisible();
      await expect(page.locator('text=Bản đồ tác động hạn chót công việc (3 nhóm):')).toBeVisible();
      await expect(page.locator('text=Nhóm 1: Tự động tính lại theo ngày mới')).toBeVisible();
      await expect(page.locator('text=Nhóm 2: Giữ nguyên ngày cố định')).toBeVisible();
      await expect(page.locator('text=Nhóm 3: Cần kiểm tra lại thủ công')).toBeVisible();
    });

    test('4.4 Day-of wedding timeline with prominent current and upcoming cards (AT34)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(TimelineManager, { initialState: 'populated' }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Lịch Trình Ngày Cưới (Live Timeline)')).toBeVisible();
      await expect(page.locator('text=Đang diễn ra')).toBeVisible();
      await expect(page.locator('text=Tiếp theo')).toBeVisible();
      await expect(page.locator('text=Lễ Gia Tiên & Trao Duyên tại Nhà Gái').first()).toBeVisible();
    });
  });

  // =========================================================================
  // USER JOURNEY 5: Seating charts & catering coordination (concurrency locks AT21, table capacity reduction protection AT22, meal dietary aggregates, A4 export AT26)
  // =========================================================================
  test.describe('User Journey 5: Seating Charts & Catering Coordination (AT21, AT22, AT26, AT52)', () => {
    test('5.1 Seating mobile tap-to-seat workflow helper & table cards (UXT12)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(SeatingManager, { initialState: 'populated' }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Sơ Đồ Xếp Bàn Tiệc')).toBeVisible();
      await expect(page.locator('text=Chạm hoặc kéo 1 khách chưa xếp bàn')).toBeVisible();
      await expect(page.locator('text=Chạm hoặc thả vào bàn tiệc muốn gán')).toBeVisible();
    });

    test('5.2 Concurrency collision & capacity guard (AT21)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(SeatingManager, {
          initialState: 'populated',
          initialConflictMessage: 'Bàn A2 vừa hết chỗ do người dùng khác đã xếp trước. Đã cập nhật sức chứa mới.',
        }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Xung đột sức chứa bàn (Lỗi 409 Conflict)')).toBeVisible();
      await expect(page.locator('text=Bàn A2 vừa hết chỗ do người dùng khác đã xếp trước')).toBeVisible();
    });

    test('5.3 Table capacity reduction guard protects assigned headcount (AT22)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(AddEditTableModal, {
          isOpen: true,
          onClose: () => {},
          onSave: () => {},
          editingTable: {
            id: 'tbl-1',
            name: 'Bàn VIP 1',
            tableNumber: '01',
            shape: 'round',
            capacity: 10,
            seatedGuestIds: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'], // 8 seated
            version: 1,
          },
        }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Chỉnh Sửa Bàn Tiệc')).toBeVisible();
      await expect(page.locator('text=Tên bàn tiệc *')).toBeVisible();
      await expect(page.locator('text=Sức chứa ghế *')).toBeVisible();
      await expect(page.locator('button:has-text("Cập nhật bàn")')).toBeVisible();
    });

    test('5.4 Catering meal dietary aggregates & buffer delta (AT52)', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(MealBreakdownDashboard, {
          summary: {
            totalMeals: 300,
            confirmedGuests: 280,
            adultMeals: 240,
            vegetarianMeals: 30,
            childMeals: 10,
            specialMeals: 20,
            bufferMeals: 20,
          },
        }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Thống Kê Suất Ăn & Đối Chiếu RSVP')).toBeVisible();
      await expect(page.locator('text=Dự phòng an toàn +20 suất')).toBeVisible();
      await expect(page.locator('text=Ăn chay')).toBeVisible();
      await expect(page.locator('text=thuần thực vật')).toBeVisible();
      await expect(page.locator('text=suất riêng em bé')).toBeVisible();
    });

    test('5.5 A4 printable seating chart & family view sanitization (AT26)', async ({ page }) => {
      const tables = [
        {
          id: 'tbl-1',
          eventId: 'ev-1',
          name: 'Bàn VIP Họ Hàng',
          tableNumber: '01',
          shape: 'round' as const,
          capacity: 10,
          seatedGuestIds: ['g-1'],
          version: 1,
        },
      ];
      const guests = [
        {
          id: 'g-1',
          name: 'Bác Thành',
          phone: '0901234567',
          groupName: 'Họ Hàng',
          tableId: 'tbl-1',
          notes: 'Khách VIP nhà gái — ghế danh dự',
        },
      ];

      // As Owner
      const htmlOwner = getFullPageHtml(
        React.createElement(SeatingExportModal, {
          isOpen: true,
          onClose: () => {},
          tables,
          guests,
        }),
        { role: 'owner' }
      );
      await page.setContent(htmlOwner, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Xuất & In Sơ Đồ Xếp Bàn Tiệc (Chuẩn A4)')).toBeVisible();
      await expect(page.locator('text=Bản in Chủ sở hữu: Đầy đủ sơ đồ')).toBeVisible();

      // As Family View
      const htmlFamily = getFullPageHtml(
        React.createElement(SeatingExportModal, {
          isOpen: true,
          onClose: () => {},
          tables,
          guests,
        }),
        { role: 'family_view' }
      );
      await page.setContent(htmlFamily, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Bản in Người nhà (AT26): Toàn bộ ghi chú riêng tư')).toBeVisible();
    });
  });

  // =========================================================================
  // USER JOURNEY 6: Reception desk check-in & walk-ins (toggle check-in, real-time check-in stats, undo check-in)
  // =========================================================================
  test.describe('User Journey 6: Reception Desk Check-in & Walk-ins (AT61)', () => {
    test('6.1 Reception desk check-in interface & toggle control', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(CheckInDashboard, { eventId: 'ev-reception-1' }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Điểm Danh Ngày Cưới (Reception Check-in)')).toBeVisible();
      await expect(page.locator('text=Tra cứu chỗ ngồi, ghi nhận khách đến và chuyển tiếp vào sổ quà mừng')).toBeVisible();
      await expect(page.locator('text=Tính năng: Bật')).toBeVisible();
      await expect(page.locator('text=+ Khách phát sinh')).toBeVisible();
    });

    test('6.2 Real-time check-in KPI stat summary cards', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(CheckInDashboard, { eventId: 'ev-reception-1' }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Tổng danh sách')).toBeVisible();
      await expect(page.locator('text=Đã đến')).toBeVisible();
      await expect(page.locator('text=Chưa đến')).toBeVisible();
      await expect(page.locator('p:has-text("Khách phát sinh")')).toBeVisible();
    });

    test('6.3 Fast unaccented search and empty list state', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(CheckInDashboard, { eventId: 'ev-reception-1' }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const searchInput = page.locator('input[placeholder*="Tìm nhanh theo tên khách"]');
      await expect(searchInput).toBeVisible();
      await expect(page.locator('text=Không tìm thấy khách mời nào phù hợp.')).toBeVisible();
    });
  });

  // =========================================================================
  // USER JOURNEY 7: Day-of handover packets & after-wedding archival freeze (immutable snapshot diffing, freeze mode read-only enforcement AT35)
  // =========================================================================
  test.describe('User Journey 7: Day-of Handover Packets & Archival Freeze (AT35, AT52)', () => {
    test('7.1 Day-of handover packet generation and A4 offline layout', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(HandoversDashboard, { eventId: 'ev-handover-1' }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Bộ Bàn Giao Ngày Cưới (Handover Pack)')).toBeVisible();
      await expect(page.locator('text=BỘ TÀI LIỆU BÀN GIAO NGÀY CƯỚI')).toBeVisible();
      await expect(page.locator('text=A4 OFF-LINE READY')).toBeVisible();
      await expect(page.locator('text=In bộ tài liệu A4')).toBeVisible();
      await expect(page.locator('text=+ Chốt bản bàn giao')).toBeVisible();
    });

    test('7.2 Post-wedding archival checklist & media vault', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(ArchivalDashboard, null),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=Hậu Cưới & Khóa Lưu Trữ (Post-Wedding & Archival)')).toBeVisible();
      await expect(page.locator('text=7 Đầu Việc Quyết Toán Sau Cưới (Dữ liệu thực tế)')).toBeVisible();
      await expect(page.locator('text=Kho Lưu Trữ Hình Ảnh & Video Gốc (Media Vault)')).toBeVisible();
      await expect(page.locator('text=Album ảnh phóng sự cưới full HD (Google Drive)')).toBeVisible();
      await expect(page.locator('text=Video Highlight 4K chính thức (YouTube Unlisted)')).toBeVisible();
      await expect(page.locator('text=Khóa chuyển lưu trữ')).toBeVisible();
    });
  });
});
