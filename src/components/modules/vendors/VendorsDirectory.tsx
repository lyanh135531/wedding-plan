'use client';

import * as React from 'react';
import { Plus, Users } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Toast, ToastMessage } from '@/components/ui/toast';
import { VendorDto, VendorSummaryDto } from '@/schemas/vendors';
import { vendorsApi } from '@/lib/vendors/api-client';
import { VendorCountersBar } from './VendorCountersBar';
import { VendorFilterBar } from './VendorFilterBar';
import { VendorListDesktop } from './VendorListDesktop';
import { VendorCardMobile } from './VendorCardMobile';
import { VendorQuickCompareBar } from './VendorQuickCompareBar';
import { AddVendorModal } from './AddVendorModal';

export interface VendorsDirectoryProps {
  initialVendors?: (VendorDto | VendorSummaryDto)[];
}

export const VendorsDirectory: React.FC<VendorsDirectoryProps> = ({
  initialVendors,
}) => {
  const { isOwner, isFamily } = useRole();

  const [vendors, setVendors] = React.useState<(VendorDto | VendorSummaryDto)[]>(
    initialVendors || []
  );
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [totalCount, setTotalCount] = React.useState(
    (initialVendors || []).length
  );

  // Quick Compare state (Owner only)
  const [selectedVendorIds, setSelectedVendorIds] = React.useState<string[]>([]);

  // Modal & Toast states
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const addToast = (msg: string, variant: 'success' | 'info' | 'warning' | 'danger' = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message: msg, variant }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch vendors from API
  const fetchVendors = React.useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await vendorsApi.list({
        search: searchQuery || undefined,
        serviceType: serviceTypeFilter || undefined,
        status: statusFilter || undefined,
        page: currentPage,
        limit: pageSize,
      });
      setVendors(res.data);
      setTotalCount(res.pagination.total);
    } catch {
      setLoadError('Không thể tải danh sách nhà cung cấp. Dữ liệu đang hiển thị có thể chưa cập nhật; hãy kiểm tra kết nối và thử lại.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, serviceTypeFilter, statusFilter, currentPage, pageSize]);

  React.useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  // Handle Quick compare selection
  const handleToggleSelectVendor = (id: string) => {
    if (!isOwner) return; // AT03, AT41: Family View cannot select for compare
    setSelectedVendorIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((vId) => vId !== id);
      }
      if (prev.length >= 4) {
        addToast('Chỉ được chọn tối đa 4 đối tác để so sánh cùng lúc.', 'warning');
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleClearSelection = () => {
    setSelectedVendorIds([]);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setServiceTypeFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  const handleVendorCreated = (newVendor: VendorDto) => {
    setVendors((prev) => [newVendor, ...prev]);
    setTotalCount((prev) => prev + 1);
    addToast(`Đã thêm nhà cung cấp "${newVendor.name}" thành công!`, 'success');
  };

  // Filter evaluation
  const hasActiveFilters = Boolean(
    searchQuery.trim() || serviceTypeFilter || statusFilter
  );
  const isListEmpty = vendors.length === 0;

  return React.createElement(
    'div',
    { className: 'space-y-6 pb-20' },
    loadError && React.createElement('p', { role: 'alert', className: 'text-danger' }, loadError),
    // Header action row
    React.createElement(
      'div',
      { className: 'flex items-center justify-between gap-4 flex-wrap' },
      React.createElement(
        'div',
        null,
        React.createElement(
          'h1',
          { className: 'text-2xl lg:text-3xl font-bold text-text-main tracking-tight' },
          'Danh Mục Nhà Cung Cấp & Địa Điểm'
        ),
        React.createElement(
          'p',
          { className: 'text-sm text-text-muted mt-1' },
          isFamily
            ? 'Chế độ Người nhà (Chỉ xem) — Tra cứu danh bạ và đầu mối liên hệ của các đối tác tiệc cưới.'
            : 'Quản lý thông tin đối tác, đàm phán hợp đồng, bảo toàn phiên bản báo giá và chuẩn hóa chi phí.'
        )
      ),

      // Add Vendor Button (Strict AT03, AT41: Hidden for Family View)
      isOwner &&
        React.createElement(
          Button,
          {
            variant: 'primary',
            onClick: () => setIsAddModalOpen(true),
            className: 'min-h-[44px]',
            leftIcon: React.createElement(Plus, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
          },
          'Thêm nhà cung cấp'
        )
    ),

    // Counters Bar
    React.createElement(VendorCountersBar, {
      vendors,
      totalCount,
    }),

    // Filter Bar
    React.createElement(VendorFilterBar, {
      searchQuery,
      onSearchChange: (q) => {
        setSearchQuery(q);
        setCurrentPage(1);
      },
      serviceTypeFilter,
      onServiceTypeChange: (st) => {
        setServiceTypeFilter(st);
        setCurrentPage(1);
      },
      statusFilter,
      onStatusChange: (s) => {
        setStatusFilter(s);
        setCurrentPage(1);
      },
      onClearFilters: handleClearFilters,
      totalFilteredCount: vendors.length,
    }),

    // Main List or Empty States
    isListEmpty
      ? hasActiveFilters
        ? React.createElement(EmptyState, {
            type: 'no_filter_match',
            title: 'Không tìm thấy kết quả phù hợp',
            description:
              'Không có nhà cung cấp nào khớp với bộ lọc hoặc từ khóa tìm kiếm hiện tại.',
            action: {
              label: 'Xóa bộ lọc',
              onClick: handleClearFilters,
            },
          })
        : React.createElement(EmptyState, {
            type: 'no_data',
            title: 'Chưa có nhà cung cấp nào',
            description: isFamily
              ? 'Hiện chưa có đối tác nào được ghi nhận trong danh sách chuẩn bị cưới.'
              : 'Bắt đầu lập danh mục đối tác tiệc cưới, chụp ảnh, trang trí và địa điểm tổ chức.',
            action: isOwner
              ? {
                  label: '+ Thêm nhà cung cấp đầu tiên',
                  onClick: () => setIsAddModalOpen(true),
                }
              : undefined,
          })
      : React.createElement(
          React.Fragment,
          null,
          // Desktop Table
          React.createElement(VendorListDesktop, {
            vendors,
            isOwner,
            selectedVendorIds,
            onToggleSelectVendor: handleToggleSelectVendor,
          }),
          // Mobile Cards
          React.createElement(VendorCardMobile, {
            vendors,
            isOwner,
            selectedVendorIds,
            onToggleSelectVendor: handleToggleSelectVendor,
          }),
          // Pagination
          React.createElement(Pagination, {
            currentPage,
            pageSize,
            totalItems: totalCount,
            onPageChange: setCurrentPage,
            onPageSizeChange: (newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            },
            pageSizeOptions: [25, 50, 100],
            unitLabel: 'nhà cung cấp',
          })
        ),

    // Quick Compare Bar (Strict AT03, AT41: Only for Owner)
    isOwner &&
      React.createElement(VendorQuickCompareBar, {
        selectedVendorIds,
        vendors,
        onClearSelection: handleClearSelection,
      }),

    // Add Vendor Modal (Owner only)
    isOwner &&
      React.createElement(AddVendorModal, {
        isOpen: isAddModalOpen,
        onClose: () => setIsAddModalOpen(false),
        onSuccess: handleVendorCreated,
      }),

    // Toasts container
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
  );
};
