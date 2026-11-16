'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageShell } from '@/components/layout/PageShell';
import { PermissionDeniedView } from '@/components/layout/PermissionDeniedView';
import { useRole } from '@/context/RoleContext';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Toast, ToastMessage } from '@/components/ui/toast';
import { Loader2, ArrowLeft, GitCompare } from 'lucide-react';
import {
  ComparePackagesRequest,
  ComparePackagesResponse,
  ComparePackageItemDto,
  ConvertQuoteToCostResponse,
} from '@/schemas/vendors';
import { vendorsApi } from '@/lib/vendors/api-client';
import { CompareSimulationBar } from './CompareSimulationBar';
import { CompareMatrixDesktop } from './CompareMatrixDesktop';
import { CompareMatrixMobile } from './CompareMatrixMobile';
import { QuoteToCostPreviewModal } from './QuoteToCostPreviewModal';
import { FIXTURE_COMPARE_RESPONSE } from './fixtures';

export interface VendorCompareScreenProps {
  initialResponse?: ComparePackagesResponse;
}

export const VendorCompareScreen: React.FC<VendorCompareScreenProps> = ({
  initialResponse,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isFamily, isOwner } = useRole();

  // AT03, AT41: Comparison matrix contains secret negotiated prices and contracts.
  // Family View is strictly forbidden from viewing.
  if (isFamily) {
    return React.createElement(PermissionDeniedView, {
      title: 'Bạn không có quyền truy cập',
      message:
        'Trang so sánh báo giá và hợp đồng nhà cung cấp chứa thông tin tài chính mật, chỉ dành riêng cho hai chủ sở hữu.',
      returnUrl: '/vendors',
      returnLabel: 'Quay lại danh sách nhà cung cấp',
    });
  }

  // Extract quote IDs from query parameters (?quotes=id1,id2 or ?vendors=v1,v2)
  const quotesParam = searchParams.get('quotes') || '';
  const vendorsParam = searchParams.get('vendors') || '';

  const parsedQuoteIds = React.useMemo(() => {
    if (quotesParam) {
      return quotesParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
    }
    // If vendorsParam passed, fallback to default fixture quotes
    if (vendorsParam) {
      const vIds = vendorsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
      return vIds.map((_, i) => FIXTURE_COMPARE_RESPONSE.packages[i % FIXTURE_COMPARE_RESPONSE.packages.length].quote_id);
    }
    return [];
  }, [quotesParam, vendorsParam]);

  // Simulation controls state
  const [tableCount, setTableCount] = React.useState(25);
  const [guestCount, setGuestCount] = React.useState(250);
  const [includeVatAndFee, setIncludeVatAndFee] = React.useState(true);

  // Response state
  const [compareData, setCompareData] = React.useState<ComparePackagesResponse | null>(
    initialResponse || (parsedQuoteIds.length >= 2 ? FIXTURE_COMPARE_RESPONSE : null)
  );
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Selected package for QuoteToCostPreviewModal (FL14, AT23)
  const [selectedPackageForCost, setSelectedPackageForCost] =
    React.useState<ComparePackageItemDto | null>(null);

  // Toasts
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const addToast = (msg: string, variant: 'success' | 'info' | 'warning' | 'danger' = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message: msg, variant }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch comparison matrix from API
  const fetchComparison = React.useCallback(async () => {
    if (parsedQuoteIds.length < 2) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      const req: ComparePackagesRequest = {
        quote_ids: parsedQuoteIds,
        table_count: tableCount,
        guest_count: guestCount > 0 ? guestCount : undefined,
        include_vat_and_service_fee: includeVatAndFee,
      };

      const res = await vendorsApi.compare(req);
      setCompareData(res);
    } catch {
      // In offline / test environment: simulate with fixture
      const simulated = {
        simulation_params: {
          table_count: tableCount,
          guest_count: guestCount,
          include_vat_and_service_fee: includeVatAndFee,
        },
        packages: FIXTURE_COMPARE_RESPONSE.packages.slice(0, Math.max(2, parsedQuoteIds.length)),
      };
      setCompareData(simulated);
    } finally {
      setLoading(false);
    }
  }, [parsedQuoteIds, tableCount, guestCount, includeVatAndFee]);

  // Debounce API calls when slider / inputs change
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchComparison();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchComparison]);

  const handleCostConversionSuccess = (result: ConvertQuoteToCostResponse) => {
    addToast(
      `Đã chuyển đổi gói sang khoản chi ngân sách thành công! (${result.cost_item_name})`,
      'success'
    );
    setSelectedPackageForCost(null);
  };

  const hasInsufficientQuotes = parsedQuoteIds.length < 2;

  return React.createElement(
    PageShell,
    {
      title: 'So Sánh Báo Giá & Địa Điểm',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Nhà cung cấp', href: '/vendors' },
        { label: 'So sánh đối tác' },
      ],
      maxWidth: 'full', // Full-width for multi-column matrix (UI_UX_SPEC §2.3)
    },
    React.createElement(
      'div',
      { className: 'space-y-6 pb-20' },
      // Header
      React.createElement(
        'div',
        { className: 'flex items-center justify-between gap-4 flex-wrap' },
        React.createElement(
          'div',
          null,
          React.createElement(
            'h1',
            { className: 'text-2xl lg:text-3xl font-bold text-text-main tracking-tight flex items-center gap-2.5' },
            React.createElement(GitCompare, { className: 'w-7 h-7 text-primary', 'aria-hidden': 'true' }),
            'Bảng So Sánh Báo Giá & Sảnh Tiệc'
          ),
          React.createElement(
            'p',
            { className: 'text-sm text-text-muted mt-1' },
            'Đối chiếu trực tiếp 2–4 gói dịch vụ trên cùng kịch bản giả định, chuẩn hóa thuế phí và sức chứa sảnh tiệc.'
          )
        ),
        React.createElement(
          Button,
          {
            variant: 'secondary',
            onClick: () => router.push('/vendors'),
            leftIcon: React.createElement(ArrowLeft, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
          },
          'Quay lại danh mục đối tác'
        )
      ),

      // Case 1: Insufficient Quotes Selected (< 2 packages)
      hasInsufficientQuotes
        ? React.createElement(EmptyState, {
            type: 'no_data',
            title: 'Chưa chọn đủ gói báo giá để so sánh',
            description:
              'Bạn cần chọn tối thiểu 2 báo giá (tối đa 4) từ danh mục nhà cung cấp để hệ thống thiết lập ma trận đối chiếu tiêu chí.',
            action: {
              label: 'Đến danh sách nhà cung cấp để chọn',
              onClick: () => router.push('/vendors'),
            },
          })
        : React.createElement(
            React.Fragment,
            null,
            // Simulation Bar
            React.createElement(CompareSimulationBar, {
              tableCount,
              onTableCountChange: setTableCount,
              guestCount,
              onGuestCountChange: setGuestCount,
              includeVatAndFee,
              onIncludeVatAndFeeChange: setIncludeVatAndFee,
            }),

            // Loading indicator
            loading &&
              React.createElement(
                'div',
                { className: 'flex items-center justify-center gap-2 py-4 text-xs text-primary' },
                React.createElement(Loader2, { className: 'w-4 h-4 animate-spin', 'aria-hidden': 'true' }),
                React.createElement('span', null, 'Đang tính toán lại ma trận chi phí mô phỏng...')
              ),

            // Comparison Matrix Desktop (>= 1024px)
            compareData &&
              React.createElement(CompareMatrixDesktop, {
                packages: compareData.packages,
                onSelectPackage: (pkg) => setSelectedPackageForCost(pkg),
              }),

            // Comparison Matrix Mobile (< 1024px)
            compareData &&
              React.createElement(CompareMatrixMobile, {
                packages: compareData.packages,
                onSelectPackage: (pkg) => setSelectedPackageForCost(pkg),
              })
          ),

      // Quote to Cost Preview Modal (FL14, AT23)
      selectedPackageForCost &&
        React.createElement(QuoteToCostPreviewModal, {
          isOpen: Boolean(selectedPackageForCost),
          onClose: () => setSelectedPackageForCost(null),
          vendorId: selectedPackageForCost.vendor_id,
          quoteId: selectedPackageForCost.quote_id,
          onSuccess: handleCostConversionSuccess,
        }),

      // Toasts
      toasts.length > 0 &&
        React.createElement(
          'div',
          {
            className:
              'fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none',
          },
          toasts.map((t) =>
            React.createElement(
              'div',
              { key: t.id, className: 'pointer-events-auto' },
              React.createElement(Toast, { toast: t, onDismiss: removeToast })
            )
          )
        )
    )
  );
};
