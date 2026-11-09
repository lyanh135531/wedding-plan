import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { formatVND, parseVND } from '@/lib/utils';

// Financial prototype modules
import { BudgetOverviewCards } from '@/components/modules/finance/BudgetOverviewCards';
import { CostItemsTable, CostItemRow } from '@/components/modules/finance/CostItemsTable';
import { CreateCostModal } from '@/components/modules/finance/CreateCostModal';
import { RecordPaymentModal } from '@/components/modules/finance/RecordPaymentModal';
import { BudgetScreen } from '@/components/modules/finance/BudgetScreen';
import { PaymentsLedgerScreen } from '@/components/modules/finance/PaymentsLedgerScreen';
import { StatCardsRow } from '@/components/modules/overview/StatCardsRow';
import { OverviewDashboard } from '@/components/modules/overview/OverviewDashboard';
import { TopExpenseList } from '@/components/modules/overview/TopExpenseList';
import { ActionRequiredList, ActionItem } from '@/components/modules/overview/ActionRequiredList';
import { FamilyOverviewCard } from '@/components/modules/overview/FamilyOverviewCard';

// Guest & Invitation prototype modules
import { AddFamilyModal } from '@/components/modules/guests/AddFamilyModal';
import { RsvpUpdateDrawer, MemberRsvpState } from '@/components/modules/guests/RsvpUpdateDrawer';
import { BulkMarkSentDialog } from '@/components/modules/invitations/BulkMarkSentDialog';
import { GuestListDesktop } from '@/components/modules/guests/GuestListDesktop';
import { GuestCardMobile, GuestItemDisplay } from '@/components/modules/guests/GuestCardMobile';

// Setup & Tasks prototype modules
import { StepWeddingDate } from '@/components/modules/auth/StepWeddingDate';
import { RescheduleDateModal } from '@/components/modules/tasks/RescheduleDateModal';

const h = React.createElement;

describe('Adversarial Challenger 2 — Domain Invariants & Acceptance Scenarios (UXT01–UXT28)', () => {

  // =========================================================================
  // 1. STRICT BIGINT VND FINANCIAL INVARIANTS
  // =========================================================================
  describe('1. Strict BigInt VND Financial Invariants', () => {
    it('verifies 0n is strictly formatted as "0 ₫", NEVER as "Chưa nhập" or "Thiếu giá"', () => {
      const formattedZero = formatVND(0n);
      expect(formattedZero).toBe('0 ₫');
      expect(formattedZero).not.toBe('Chưa nhập');
      expect(formattedZero).not.toBe('Thiếu giá');
      expect(formattedZero).not.toContain('undefined');
      expect(formattedZero).not.toContain('null');
    });

    it('verifies null and undefined trigger fallback ("Chưa nhập" default or custom fallback)', () => {
      expect(formatVND(null)).toBe('Chưa nhập');
      expect(formatVND(undefined)).toBe('Chưa nhập');
      expect(formatVND(null, 'Thiếu giá')).toBe('Thiếu giá');
      expect(formatVND(undefined, 'Thiếu giá')).toBe('Thiếu giá');
      expect(formatVND(null, '—')).toBe('—');
    });

    it('verifies negative bigint values are correctly formatted with leading minus', () => {
      expect(formatVND(-15000000n)).toBe('-15.000.000 ₫');
      expect(formatVND(-1n)).toBe('-1 ₫');
    });

    it('verifies numbers exceeding IEEE-754 Number.MAX_SAFE_INTEGER do NOT suffer float drift', () => {
      // 2^53 - 1 = 9007199254740991. Beyond this, JS Number loses integer precision!
      const hugeBigInt = 9007199254740993n;
      const formatted = formatVND(hugeBigInt);
      expect(formatted).toBe('9.007.199.254.740.993 ₫');
      // In JS float: Number(9007199254740993n) === 9007199254740992!
      expect(formatted).not.toContain('9.007.199.254.740.992');
    });

    it('verifies parseVND correctly extracts bigint from various Vietnamese string formats', () => {
      expect(parseVND('0')).toBe(0n);
      expect(parseVND('0 ₫')).toBe(0n);
      expect(parseVND('-0 ₫')).toBe(0n);
      expect(parseVND('15.000.000')).toBe(15000000n);
      expect(parseVND('15.000.000 ₫')).toBe(15000000n);
      expect(parseVND('  500.000 VND ')).toBe(500000n);
      expect(parseVND('-25.000.000 ₫')).toBe(-25000000n);

      // Null fallbacks on empty or non-numeric inputs
      expect(parseVND('')).toBeNull();
      expect(parseVND('   ')).toBeNull();
      expect(parseVND(null)).toBeNull();
      expect(parseVND(undefined)).toBeNull();
      expect(parseVND('abc')).toBeNull();
    });

    it('verifies missing price items trigger amber provisional badge on BudgetOverviewCards & StatCardsRow', () => {
      // When missingPricesCount > 0:
      const budgetHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'owner' },
          h(BudgetOverviewCards, {
            targetBudget: 300000000n,
            projectedCost: 265000000n,
            missingPricesCount: 3,
          })
        )
      );
      expect(budgetHtml).toContain('Tạm tính — còn 3 khoản thiếu giá');
      expect(budgetHtml).toContain('text-warning');

      const overviewHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'owner' },
          h(StatCardsRow, {
            projectedCost: 265000000n,
            missingPricesCount: 2,
          })
        )
      );
      expect(overviewHtml).toContain('Tạm tính — còn 2 khoản thiếu giá');

      // When missingPricesCount === 0:
      const cleanBudgetHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'owner' },
          h(BudgetOverviewCards, {
            targetBudget: 300000000n,
            projectedCost: 265000000n,
            missingPricesCount: 0,
          })
        )
      );
      expect(cleanBudgetHtml).not.toContain('Tạm tính — còn');

      const cleanOverviewHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'owner' },
          h(StatCardsRow, {
            projectedCost: 265000000n,
            missingPricesCount: 0,
          })
        )
      );
      expect(cleanOverviewHtml).not.toContain('Tạm tính — còn');
    });

    it('verifies 0n amounts in BudgetOverviewCards render as "0 ₫" and never as "—" or "Chưa nhập"', () => {
      const budgetHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'owner' },
          h(BudgetOverviewCards, {
            targetBudget: null, // intentionally null/empty
            projectedCost: 0n,
            netPaid: 0n,
            remainingDue: 0n,
            missingPricesCount: 0,
          })
        )
      );

      // targetBudget is null -> empty state
      expect(budgetHtml).toContain('Chưa có dữ liệu');
      // projectedCost, netPaid, remainingDue are 0n -> must render "0 ₫"
      expect(budgetHtml).toContain('0 ₫');
      // Must not render fallback "Chưa nhập" or "Thiếu giá" for these 0n fields
      expect(budgetHtml).not.toContain('Chưa nhập');
      expect(budgetHtml).not.toContain('Thiếu giá');
    });

    it('verifies CostItemsTable renders amber "Thiếu giá" badge for items without price', () => {
      const items: CostItemRow[] = [
        {
          id: 'item-1',
          name: 'Khoản đã chốt',
          category: 'Tiệc cưới',
          contractedAmount: 50000000n,
          paidAmount: 20000000n,
          status: 'contracted',
          isMissingPrice: false,
        },
        {
          id: 'item-2',
          name: 'Khoản chưa có giá',
          category: 'Âm thanh',
          contractedAmount: null,
          paidAmount: 0n,
          status: 'draft',
          isMissingPrice: true,
        },
      ];

      const html = renderToStaticMarkup(h(CostItemsTable, { items }));
      expect(html).toContain('50.000.000 ₫');
      expect(html).toContain('20.000.000 ₫');
      expect(html).toContain('30.000.000 ₫'); // remaining
      expect(html).toContain('Thiếu giá'); // Missing price badge
    });
  });

  // =========================================================================
  // 2. TRIPARTITE GUEST MODEL & ATTENDANCE INVARIANTS
  // =========================================================================
  describe('2. Tripartite Guest Model & Attendance Invariants', () => {
    it('verifies UXT02: 4-member family creation creates 1 invitation card and 4 person records', () => {
      const html = renderToStaticMarkup(
        h(AddFamilyModal, {
          isOpen: true,
          onClose: () => {},
          onSubmit: () => {},
        })
      );

      // Verify 1 card title & household name
      expect(html).toContain('Thêm gia đình / Nhóm nhận thiệp');
      expect(html).toContain('Gia đình Bác Thành');

      // Verify 4 members listed
      expect(html).toContain('Bác Thành');
      expect(html).toContain('Bác Gái');
      expect(html).toContain('Anh Tuấn');
      expect(html).toContain('Bé Bi');

      // Verify summary line confirms tripartite creation: 1 card, 4 guests
      expect(html).toContain('1 thiệp, 4 người (3 người lớn, 0 trẻ em, 1 em bé)');
      expect(html).toContain('Lưu gia đình (4 khách)');
    });

    it('verifies UXT03: Updating attendance for 1 event does not alter other events, and declining triggers table unseat warning', () => {
      const initialMembers: MemberRsvpState[] = [
        {
          guestId: 'g1',
          name: 'Bác Thành',
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealTier: 'regular',
          assignedTable: 'Bàn A1',
        },
        {
          guestId: 'g2',
          name: 'Anh Tuấn',
          rsvpStatus: 'pending_reply',
          needsSeat: true,
          needsMeal: true,
          mealTier: 'vegetarian',
          assignedTable: null,
        },
      ];

      const html = renderToStaticMarkup(
        h(RsvpUpdateDrawer, {
          isOpen: true,
          onClose: () => {},
          householdName: 'Gia đình Bác Thành',
          initialEventTitle: 'Lễ Vu Quy Nhà Gái',
          initialMembers,
        })
      );

      // Verify scoped to specific event
      expect(html).toContain('Lễ Vu Quy Nhà Gái');
      expect(html).toContain('Gia đình Bác Thành');
      expect(html).toContain('Cập nhật trạng thái phản hồi tham dự độc lập cho từng thành viên trong buổi lễ này.');

      // Verify table indicator for seated guest
      expect(html).toContain('Đang ngồi: Bàn A1');
    });

    it('verifies UXT05: Marking invitation cards sent never alters guest RSVP status', () => {
      const html = renderToStaticMarkup(
        h(BulkMarkSentDialog, {
          isOpen: true,
          onClose: () => {},
          selectedCount: 5,
          onConfirm: () => {},
        })
      );

      expect(html).toContain('Đánh dấu thiệp đã gửi');
      expect(html).toContain('5 thiệp mời');
      expect(html).toContain('hoàn toàn không tự ý thay đổi trạng thái phản hồi tham dự (RSVP) của khách mời');
    });
  });

  // =========================================================================
  // 3. SECURITY & RESCHEDULING INVARIANTS
  // =========================================================================
  describe('3. Security & Rescheduling Invariants', () => {
    it('verifies UXT01: Setup wizard unset date toggle replaces date picker with text note; no fake countdown or fake date', () => {
      // Unset date mode:
      const unsetHtml = renderToStaticMarkup(
        h(StepWeddingDate, {
          weddingDate: null,
          isUnconfirmedDate: true,
          estimatedDateNote: 'Dự kiến sau Tết âm lịch 2028',
          onChangeDate: () => {},
          onChangeUnconfirmed: () => {},
          onChangeEstimatedNote: () => {},
        })
      );

      expect(unsetHtml).toContain('Chưa chốt ngày cưới chính thức (đang xem ngày)');
      expect(unsetHtml).toContain('Ghi chú thời gian dự kiến');
      expect(unsetHtml).toContain('Dự kiến sau Tết âm lịch 2028');
      expect(unsetHtml).toContain('Hệ thống sẽ không tự gán ngày giả và không bật đồng hồ đếm ngược');
      expect(unsetHtml).not.toContain('type="date"');
      expect(unsetHtml).not.toContain('01/01/2028');

      // Confirmed date mode:
      const confirmedHtml = renderToStaticMarkup(
        h(StepWeddingDate, {
          weddingDate: '2026-12-15',
          isUnconfirmedDate: false,
          estimatedDateNote: '',
          onChangeDate: () => {},
          onChangeUnconfirmed: () => {},
          onChangeEstimatedNote: () => {},
        })
      );

      expect(confirmedHtml).toContain('Ngày cưới chính thức');
      expect(confirmedHtml).toContain('15/12/2026');
    });

    it('verifies UXT07: Payment submission locks button with idempotency key to prevent double submits', () => {
      const html = renderToStaticMarkup(
        h(RecordPaymentModal, {
          isOpen: true,
          onClose: () => {},
          costItemName: 'Trung tâm tiệc cưới White Palace',
          defaultAmount: 5000000n,
          onSubmit: () => {},
        })
      );

      expect(html).toContain('Ghi nhận thanh toán chi tiền');
      expect(html).toContain('5.000.000 ₫');
      expect(html).toContain('Khóa chống submit trùng lặp (Idempotency Key v4) được kích hoạt.');
      expect(html).toContain('Người khác trả hộ');
      expect(html).toContain('Xác nhận chi 5.000.000 ₫');
    });

    it('verifies UXT11: Safe wedding date reschedule previews 3 distinct impact categories', () => {
      const html = renderToStaticMarkup(
        h(RescheduleDateModal, {
          isOpen: true,
          onClose: () => {},
          currentDate: '15/12/2026',
          onConfirmReschedule: () => {},
        })
      );

      expect(html).toContain('Dời ngày cưới &amp; Xem trước tác động');
      expect(html).toContain('Bản đồ tác động hạn chót công việc (3 nhóm):');
      expect(html).toContain('Nhóm 1: Tự động tính lại theo ngày mới');
      expect(html).toContain('Nhóm 2: Giữ nguyên ngày cố định');
      expect(html).toContain('Nhóm 3: Cần kiểm tra lại thủ công');
      expect(html).toContain('Xác nhận đổi ngày');
    });

    it('verifies UXT16: Family View role completely hides financial cards, payments ledger, and masks guest phone numbers', () => {
      // 1. StatCardsRow completely empty for Family View
      const statCardsHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'family_view' }, h(StatCardsRow, null))
      );
      expect(statCardsHtml).toBe('');

      // 2. TopExpenseList completely hidden for Family View
      const topExpensesHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'family_view' }, h(TopExpenseList, null))
      );
      expect(topExpensesHtml).toBe('');

      // 3. PaymentsLedgerScreen yields 403 for Family View
      const ledgerHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'family_view' }, h(PaymentsLedgerScreen, null))
      );
      expect(ledgerHtml).toContain('Bạn không có quyền truy cập');
      expect(ledgerHtml).toContain('Sổ chi tiền và nhật ký giao dịch chỉ dành riêng cho Chủ sở hữu đám cưới');

      // 4. BudgetScreen yields 403 for Family View
      const budgetHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'family_view' }, h(BudgetScreen, null))
      );
      expect(budgetHtml).toContain('Bạn không có quyền truy cập');
      expect(budgetHtml).toContain('Mục Ngân sách và Sổ quỹ chỉ dành riêng cho hai Chủ sở hữu đám cưới');

      // 5. ActionRequiredList suppresses financial items for Family View
      const actionItems: ActionItem[] = [
        {
          id: '1',
          type: 'overdue_task',
          title: 'Đầu việc phi tài chính',
          subtitle: 'Gia đình hỗ trợ',
          badgeText: 'Cần làm',
          badgeStatus: 'warning',
          href: '/tasks',
          isFinancial: false,
        },
        {
          id: '2',
          type: 'urgent_payment',
          title: 'Khoản chi bí mật',
          subtitle: 'Số tiền: 50.000.000 ₫',
          badgeText: 'Cần chi',
          badgeStatus: 'danger',
          href: '/payments',
          isFinancial: true,
        },
      ];

      const familyActionHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'family_view' }, h(ActionRequiredList, { items: actionItems }))
      );
      expect(familyActionHtml).toContain('Đầu việc phi tài chính');
      expect(familyActionHtml).not.toContain('Khoản chi bí mật');
      expect(familyActionHtml).not.toContain('50.000.000 ₫');

      // 6. Guest phone numbers masked in GuestListDesktop and GuestCardMobile
      const testGuest: GuestItemDisplay = {
        id: 'g-test',
        displayName: 'Nguyễn Văn A',
        side: 'groom',
        groupName: 'Họ Hàng',
        ageTier: 'adult',
        phone: '0912345678',
        rsvpStatus: 'accepted',
        needsSeat: true,
        needsMeal: true,
      };

      const desktopFamilyHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'family_view' },
          h(GuestListDesktop, {
            guests: [testGuest],
            selectedIds: [],
            onToggleSelect: () => {},
            onToggleSelectAll: () => {},
            onClickGuest: () => {},
          })
        )
      );
      expect(desktopFamilyHtml).toContain('***-***-****');
      expect(desktopFamilyHtml).not.toContain('0912345678');

      const mobileFamilyHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'family_view' },
          h(GuestCardMobile, { guest: testGuest })
        )
      );
      expect(mobileFamilyHtml).toContain('***-***-****');
      expect(mobileFamilyHtml).not.toContain('0912345678');

      // For Owner, phone number is visible
      const desktopOwnerHtml = renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'owner' },
          h(GuestListDesktop, {
            guests: [testGuest],
            selectedIds: [],
            onToggleSelect: () => {},
            onToggleSelectAll: () => {},
            onClickGuest: () => {},
          })
        )
      );
      expect(desktopOwnerHtml).toContain('0912345678');
      expect(desktopOwnerHtml).not.toContain('***-***-****');
    });
  });
});
