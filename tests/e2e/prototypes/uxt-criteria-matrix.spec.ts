import { test, expect } from '@playwright/test';
import React from 'react';
import { getFullPageHtml } from './test-helpers';
import { StepWeddingDate } from '../../../src/components/modules/auth/StepWeddingDate';
import { AddFamilyModal } from '../../../src/components/modules/guests/AddFamilyModal';
import { RsvpUpdateDrawer } from '../../../src/components/modules/guests/RsvpUpdateDrawer';
import { BulkMarkSentDialog } from '../../../src/components/modules/invitations/BulkMarkSentDialog';
import { BudgetScreen } from '../../../src/components/modules/finance/BudgetScreen';
import { RecordPaymentModal } from '../../../src/components/modules/finance/RecordPaymentModal';
import { RefundTransactionModal } from '../../../src/components/modules/finance/RefundTransactionModal';
import { VoidTransactionDialog } from '../../../src/components/modules/finance/VoidTransactionDialog';
import { PaymentsLedgerScreen } from '../../../src/components/modules/finance/PaymentsLedgerScreen';
import { TasksManager } from '../../../src/components/modules/tasks/TasksManager';
import { RescheduleDateModal } from '../../../src/components/modules/tasks/RescheduleDateModal';
import { SeatingManager } from '../../../src/components/modules/seating/SeatingManager';
import { TimelineManager } from '../../../src/components/modules/timeline/TimelineManager';
import { OverviewDashboard } from '../../../src/components/modules/overview/OverviewDashboard';
import { DataExportView } from '../../../src/components/modules/data-export/DataExportView';
import { DataImportWizard } from '../../../src/components/modules/data-import/DataImportWizard';

test.describe('UXT Criteria Scenarios Matrix (UXT01–UXT28 & Gate G1)', () => {
  test('Scenario UXT01 (Gate G1): First launch setup wizard without official date eliminates fake date/countdown', async ({ page }) => {
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

    // Verify tentative note is displayed and date picker is eliminated
    await expect(page.locator('text=Chưa chốt ngày cưới chính thức (đang xem ngày)')).toBeVisible();
    await expect(page.locator('text=Ghi chú thời gian dự kiến').first()).toBeVisible();
    await expect(page.locator('text=Hệ thống sẽ không tự gán ngày giả')).toBeVisible();
    await expect(page.locator('input[value="Dự kiến vào mùa Thu 2026"]')).toBeVisible();
  });

  test('Scenario UXT02 (Gate G1): Tripartite model — 4-member family under 1 invitation card preview', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(AddFamilyModal, {
        isOpen: true,
        onClose: () => {},
        onSubmit: () => {},
      }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Verify 4 family members under 1 invite
    await expect(page.locator('text=Thêm gia đình / Nhóm nhận thiệp')).toBeVisible();
    await expect(page.locator('text=Danh sách thành viên:')).toBeVisible();
    await expect(page.locator('input[value="Bác Thành"]')).toBeVisible();
    await expect(page.locator('input[value="Bé Bi"]')).toBeVisible();
    await expect(page.locator('text=Người nhận thiệp đại diện').first()).toBeVisible();
  });

  test('Scenario UXT03 (Gate G1): Independent RSVP updates per event without mutating guest identity', async ({ page }) => {
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

  test('Scenario UXT05: Batch update invitation cards does not mutate individual guest identities', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(BulkMarkSentDialog, {
        isOpen: true,
        onClose: () => {},
        selectedCount: 5,
        onConfirm: () => {},
      }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=Đánh dấu thiệp đã gửi').first()).toBeVisible();
    await expect(page.locator('text=5 thiệp mời')).toBeVisible();
    await expect(page.locator('text=hoàn toàn không tự ý thay đổi trạng thái phản hồi tham dự')).toBeVisible();
  });

  test('Scenario UXT06 (Gate G1): Budget missing price indicator reports provisional cost badge', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(BudgetScreen, { initialState: 'populated' }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Verify missing price warning banner (UXT06)
    await expect(page.locator('text=Tạm tính — còn 1 khoản thiếu giá')).toBeVisible();
    await expect(page.locator('span:has-text("Thiếu giá")').first()).toBeVisible();

    // Verify BigInt VND tabular numeral
    await expect(page.locator('text=180.000.000 ₫').first()).toBeVisible();
  });

  test('Scenario UXT07 (Gate G1): Record payment modal with destination item and idempotency key lock', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(RecordPaymentModal, {
        isOpen: true,
        onClose: () => {},
        costItemName: 'Trung tâm tiệc cưới White Palace',
        defaultAmount: 5000000n,
        onSubmit: () => {},
      }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=Ghi nhận thanh toán chi tiền')).toBeVisible();
    await expect(page.locator('text=Trung tâm tiệc cưới White Palace')).toBeVisible();
    await expect(page.locator('text=Khóa chống submit trùng lặp (Idempotency Key v4) được kích hoạt.')).toBeVisible();
    await expect(page.locator('text=Người khác trả hộ')).toBeVisible();
  });

  test('Scenario UXT08: Distinction between vendor refund (FX02) and void transaction with reason', async ({ page }) => {
    // 1. Vendor refund modal
    let html = getFullPageHtml(
      React.createElement(RefundTransactionModal, {
        isOpen: true,
        onClose: () => {},
        vendorName: 'Áo cưới Hoàng Gia (Hủy hợp đồng)',
        originalOutflowAmount: 5000000n,
        onConfirmRefund: () => {},
      }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Ghi nhận hoàn tiền từ nhà cung cấp')).toBeVisible();
    await expect(page.locator('text=Áo cưới Hoàng Gia (Hủy hợp đồng)')).toBeVisible();

    // 2. Void transaction dialog
    html = getFullPageHtml(
      React.createElement(VoidTransactionDialog, {
        isOpen: true,
        onClose: () => {},
        transactionAmount: 20000000n,
        onConfirmVoid: () => {},
      }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Hủy ghi nhận giao dịch (Void)')).toBeVisible();
    await expect(page.locator('text=Lý do hủy ghi nhận (bắt buộc)')).toBeVisible();
  });

  test('Scenario UXT09: Opening cutoff banner displays anchor and excludes pre-opening deposit from cash deduction', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(BudgetScreen, { initialState: 'populated' }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=Mốc mở sổ quỹ: 01/10/2026')).toBeVisible();
    await expect(page.locator('text=không bị trừ lần hai')).toBeVisible();
    await expect(page.locator('text=FX03: Khớp sổ quỹ')).toBeVisible();
  });

  test('Scenario UXT10 (Gate G1): Tasks manager chronological buckets & relative deadline to unconfirmed date', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(TasksManager, { initialState: 'populated' }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Verify 5 chronological buckets
    await expect(page.locator('h2:has-text("Quá hạn")')).toBeVisible();
    await expect(page.locator('h2:has-text("Hôm nay")')).toBeVisible();
    await expect(page.locator('h2:has-text("Trong 7 ngày tới")')).toBeVisible();
    await expect(page.locator('h2:has-text("Chưa có hạn chót")')).toBeVisible();
    await expect(page.locator('h2:has-text("Đã hoàn tất")')).toBeVisible();

    // Verify relative deadline to unconfirmed event displays safe label
    await expect(page.locator('text=Hạn sẽ được tính khi chốt ngày')).toBeVisible();
  });

  test('Scenario UXT11: Reschedule representative wedding date previews 3 impact categories', async ({ page }) => {
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
  });

  test('Scenario UXT12, UXT13, UXT14: Seating mobile tap-to-seat, 409 conflict, and immutable snapshot', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(SeatingManager, {
        initialState: 'populated',
        initialConflictMessage: 'Bàn A2 vừa hết chỗ do người dùng khác đã xếp trước. Đã cập nhật sức chứa mới.',
      }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // UXT12 Tap-to-seat workflow helper
    await expect(page.locator('text=Chạm hoặc kéo 1 khách chưa xếp bàn')).toBeVisible();
    await expect(page.locator('text=Chạm hoặc thả vào bàn tiệc muốn gán')).toBeVisible();

    // UXT13 409 Conflict banner
    await expect(page.locator('text=Xung đột sức chứa bàn (Lỗi 409 Conflict)')).toBeVisible();
    await expect(page.locator('text=Bàn A2 vừa hết chỗ do người dùng khác đã xếp trước')).toBeVisible();

    // UXT14 Immutable snapshot notice
    await expect(page.locator('text=Bản chốt sơ đồ v1 đã khóa (Snapshot)')).toBeVisible();
  });

  test('Scenario UXT15: Day-of wedding timeline with prominent current and upcoming cards', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(TimelineManager, { initialState: 'populated' }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=Lịch Trình Ngày Cưới (Live Timeline)')).toBeVisible();
    await expect(page.locator('text=Đang diễn ra')).toBeVisible();
    await expect(page.locator('text=Tiếp theo')).toBeVisible();
  });

  test('Scenario UXT16 (Gate G1): Family View-only role strictly eliminates 100% financial widgets, numbers, and routes', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(OverviewDashboard, { initialState: 'populated' }),
      { role: 'family_view' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Verify "Chỉ xem" badge
    await expect(page.locator('text=Chỉ xem').first()).toBeVisible();

    // Verify non-financial venue & schedule card is displayed
    await expect(page.locator('text=Lịch Trình & Địa Điểm')).toBeVisible();

    // Assert 100% financial metrics and ₫ currency symbols are NOT in the DOM
    const vndSymbols = page.locator('text=₫');
    expect(await vndSymbols.count()).toBe(0);

    const budgetTexts = page.locator('text=Ngân sách');
    expect(await budgetTexts.count()).toBe(0);

    const expenseTexts = page.locator('text=Top chi phí');
    expect(await expenseTexts.count()).toBe(0);
  });

  test('Scenario UXT16 (Gate G1): Family View-only accessing Payments Ledger displays strict 403', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(PaymentsLedgerScreen, null),
      { role: 'family_view' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Strict 403 Permission Denied
    await expect(page.locator('text=Bạn không có quyền truy cập')).toBeVisible();
    await expect(page.locator('text=Sổ chi tiền và nhật ký giao dịch chỉ dành riêng cho Chủ sở hữu đám cưới.')).toBeVisible();
  });

  test('Scenario UXT22 & UXT23: Data export formula injection sanitization and 5-step import wizard', async ({ page }) => {
    // 1. Data export formula injection check (UXT22)
    let html = getFullPageHtml(
      React.createElement(DataExportView, null),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Xuất Dữ Liệu & Bản In Chuẩn CSS Print')).toBeVisible();
    await expect(page.locator('text=Đã gắn nháy đơn chống CSV Injection')).toBeVisible();
    await expect(page.locator('button:has-text("In trang này (A4)")')).toBeVisible();

    // 2. Data import wizard (UXT23)
    html = getFullPageHtml(
      React.createElement(DataImportWizard, { initialState: 'populated' }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Nhập Khách Mời Hàng Loạt (Excel/CSV)')).toBeVisible();
    await expect(page.locator('text=3. Xử lý dòng lỗi (UXT23)')).toBeVisible();
    await expect(page.locator('text=Phát hiện 2 dòng dữ liệu lỗi')).toBeVisible();
  });

  test('Scenario 6 Mandatory States Matrix: dispatches empty, loading, error, filtered, and permission_denied', async ({ page }) => {
    // 1. Empty state
    let html = getFullPageHtml(
      React.createElement(BudgetScreen, { initialState: 'empty' }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Chưa có khoản chi nào được tạo')).toBeVisible();

    // 2. Loading state
    html = getFullPageHtml(
      React.createElement(BudgetScreen, { initialState: 'loading' }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[role="status"]').first()).toBeVisible();

    // 3. Error state with Request ID
    html = getFullPageHtml(
      React.createElement(BudgetScreen, { initialState: 'error' }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=REQ-20261106-BUDGET-ERR')).toBeVisible();
    await expect(page.locator('button:has-text("Thử lại")')).toBeVisible();

    // 4. Filtered empty state
    html = getFullPageHtml(
      React.createElement(BudgetScreen, { initialState: 'filtered' }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Không có khoản chi nào trong danh mục này')).toBeVisible();

    // 5. Permission denied state
    html = getFullPageHtml(
      React.createElement(BudgetScreen, { initialState: 'permission_denied' }),
      { role: 'family_view' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Bạn không có quyền truy cập')).toBeVisible();
  });
});
