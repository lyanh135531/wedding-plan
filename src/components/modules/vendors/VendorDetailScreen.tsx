'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/layout/PageShell';
import { useRole } from '@/context/RoleContext';
import { VendorDto, QuoteDto } from '@/schemas/vendors';
import { vendorsApi } from '@/lib/vendors/api-client';
import { Toast, ToastMessage } from '@/components/ui/toast';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Trash2, Loader2 } from 'lucide-react';
import { VendorProfileHeader } from './VendorProfileHeader';
import { VendorInfoCards } from './VendorInfoCards';
import { QuotesManager } from './QuotesManager';
import { EditVendorModal } from './EditVendorModal';
import { AddQuoteModal } from './AddQuoteModal';
import { FIXTURE_VENDORS, FIXTURE_QUOTES } from './fixtures';

export interface VendorDetailScreenProps {
  vendorId: string;
  initialVendor?: VendorDto;
  initialQuotes?: QuoteDto[];
}

export const VendorDetailScreen: React.FC<VendorDetailScreenProps> = ({
  vendorId,
  initialVendor,
  initialQuotes,
}) => {
  const router = useRouter();
  const { isOwner, isFamily } = useRole();

  const [vendor, setVendor] = React.useState<VendorDto | null>(
    initialVendor ||
      FIXTURE_VENDORS.find((v) => v.id === vendorId) ||
      FIXTURE_VENDORS[0]
  );
  const [quotes, setQuotes] = React.useState<QuoteDto[]>(
    initialQuotes ||
      FIXTURE_QUOTES.filter((q) => q.vendor_id === vendorId)
  );

  const [loading, setLoading] = React.useState(!initialVendor);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isAddQuoteModalOpen, setIsAddQuoteModalOpen] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const addToast = (msg: string, variant: 'success' | 'info' | 'warning' | 'danger' = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message: msg, variant }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadVendorData = React.useCallback(async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      setErrorMsg(null);

      // Load vendor detail
      const vendorRes = await vendorsApi.getById(vendorId);
      setVendor(vendorRes.data);

      // If Owner, load quotes with all superseded versions
      if (isOwner) {
        try {
          const quotesRes = await vendorsApi.listQuotes(vendorId, true);
          setQuotes(quotesRes.data);
        } catch {
          // If quotes endpoint fails or offline, filter local fixtures
          setQuotes(FIXTURE_QUOTES.filter((q) => q.vendor_id === vendorId));
        }
      }
    } catch {
      // Offline / fallback to fixture
      const found = FIXTURE_VENDORS.find((v) => v.id === vendorId);
      if (found) {
        setVendor(found);
        setQuotes(FIXTURE_QUOTES.filter((q) => q.vendor_id === vendorId));
      } else {
        setErrorMsg('Không tìm thấy thông tin nhà cung cấp này trong hệ thống.');
      }
    } finally {
      setLoading(false);
    }
  }, [vendorId, isOwner]);

  React.useEffect(() => {
    loadVendorData();
  }, [loadVendorData]);

  // Safe delete handler (AT23: Check if vendor has active costs or selected quotes)
  const handleDeleteVendor = async () => {
    if (!vendor) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await vendorsApi.delete(vendor.id);
      addToast(`Đã xóa nhà cung cấp "${vendor.name}" thành công!`, 'success');
      setIsDeleteConfirmOpen(false);
      router.push('/vendors');
    } catch (err: any) {
      // Catch HTTP 400 VendorHasActiveCostItemsError
      setDeleteError(
        err.message ||
          'Không thể xóa nhà cung cấp đã có báo giá được chọn hoặc khoản chi đang hoạt động (AT23).'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return React.createElement(
      PageShell,
      {
        title: 'Hồ Sơ Nhà Cung Cấp',
        breadcrumbs: [
          { label: 'Trang chủ', href: '/overview' },
          { label: 'Nhà cung cấp', href: '/vendors' },
          { label: 'Đang tải...' },
        ],
      },
      React.createElement(
        'div',
        { className: 'py-24 flex flex-col items-center justify-center space-y-3' },
        React.createElement(Loader2, { className: 'w-10 h-10 animate-spin text-primary', 'aria-hidden': 'true' }),
        React.createElement('p', { className: 'text-sm text-text-muted' }, 'Đang tải hồ sơ nhà cung cấp...')
      )
    );
  }

  if (errorMsg || !vendor) {
    return React.createElement(
      PageShell,
      {
        title: 'Lỗi Tải Dữ Liệu',
        breadcrumbs: [
          { label: 'Trang chủ', href: '/overview' },
          { label: 'Nhà cung cấp', href: '/vendors' },
          { label: 'Không tìm thấy' },
        ],
      },
      React.createElement(
        'div',
        {
          className:
            'p-8 text-center bg-surface rounded-card border border-danger/30 space-y-4 max-w-lg mx-auto my-12',
        },
        React.createElement(AlertCircle, {
          className: 'w-12 h-12 text-danger mx-auto',
          'aria-hidden': 'true',
        }),
        React.createElement(
          'h2',
          { className: 'text-xl font-bold text-text-main' },
          'Không tìm thấy nhà cung cấp'
        ),
        React.createElement(
          'p',
          { className: 'text-sm text-text-muted' },
          errorMsg || 'Nhà cung cấp này không tồn tại hoặc đã bị xóa.'
        ),
        React.createElement(
          Button,
          { variant: 'primary', onClick: () => router.push('/vendors') },
          'Quay lại danh sách nhà cung cấp'
        )
      )
    );
  }

  return React.createElement(
    PageShell,
    {
      title: vendor.name,
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Nhà cung cấp', href: '/vendors' },
        { label: vendor.name },
      ],
      maxWidth: 'standard',
    },
    React.createElement(
      'div',
      { className: 'space-y-6 pb-20' },
      // Header
      React.createElement(VendorProfileHeader, {
        vendor,
        isOwner,
        onEditClick: () => setIsEditModalOpen(true),
        onDeleteClick: () => {
          setDeleteError(null);
          setIsDeleteConfirmOpen(true);
        },
        onAddQuoteClick: () => setIsAddQuoteModalOpen(true),
      }),

      // Info Cards (Contact info, Venue specs, Private notes)
      React.createElement(VendorInfoCards, {
        vendor,
        isOwner,
      }),

      // Quotes & Contract History Manager (Strict AT03, AT41: Owner only)
      isOwner &&
        React.createElement(QuotesManager, {
          quotes,
          vendorId: vendor.id,
          vendorName: vendor.name,
          isOwner,
          onQuotesUpdated: (newQuotes) => setQuotes(newQuotes),
          onOpenAddQuote: () => setIsAddQuoteModalOpen(true),
        }),

      // Edit Vendor Modal (AT30 optimistic locking)
      isOwner &&
        isEditModalOpen &&
        React.createElement(EditVendorModal, {
          isOpen: isEditModalOpen,
          onClose: () => setIsEditModalOpen(false),
          vendor,
          onSuccess: (updated) => {
            setVendor(updated);
            addToast('Cập nhật thông tin nhà cung cấp thành công!', 'success');
          },
          onReloadRequested: loadVendorData,
        }),

      // Add Quote Modal
      isOwner &&
        isAddQuoteModalOpen &&
        React.createElement(AddQuoteModal, {
          isOpen: isAddQuoteModalOpen,
          onClose: () => setIsAddQuoteModalOpen(false),
          vendorId: vendor.id,
          vendorName: vendor.name,
          onSuccess: (newQuote) => {
            setQuotes((prev) => [...prev, newQuote]);
            addToast(`Tạo báo giá "${newQuote.quote_name}" thành công!`, 'success');
          },
        }),

      // Safe Delete Confirmation Modal (AT23)
      isOwner &&
        React.createElement(
          ModalDialog,
          {
            isOpen: isDeleteConfirmOpen,
            onClose: () => setIsDeleteConfirmOpen(false),
            title: 'Xác Nhận Xóa Nhà Cung Cấp',
            description: `Thao tác xóa đối tác "${vendor.name}" không thể hoàn tác.`,
            maxWidth: 'sm',
          },
          React.createElement(
            'div',
            { className: 'space-y-4 pt-2' },
            deleteError &&
              React.createElement(
                'div',
                {
                  className:
                    'p-3 bg-danger-bg text-danger border border-danger/30 rounded-control text-xs flex items-start gap-2',
                  role: 'alert',
                },
                React.createElement(AlertCircle, { className: 'w-4 h-4 shrink-0 mt-0.5', 'aria-hidden': 'true' }),
                React.createElement('span', null, deleteError)
              ),
            React.createElement(
              'p',
              { className: 'text-sm text-text-muted leading-relaxed' },
              'Bạn có chắc chắn muốn xóa đối tác này? Nếu đối tác đã có báo giá được chọn hoặc có khoản chi ngân sách liên kết, hệ thống sẽ từ chối để bảo vệ toàn vẹn tài chính (AT23).'
            ),
            React.createElement(
              'div',
              { className: 'pt-4 flex items-center justify-end gap-3 border-t border-border-subtle' },
              React.createElement(
                Button,
                {
                  variant: 'secondary',
                  onClick: () => setIsDeleteConfirmOpen(false),
                  disabled: isDeleting,
                },
                'Hủy bỏ'
              ),
              React.createElement(
                Button,
                {
                  variant: 'danger',
                  onClick: handleDeleteVendor,
                  loading: isDeleting,
                  loadingText: 'Đang xóa...',
                  leftIcon: React.createElement(Trash2, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
                },
                'Xóa đối tác'
              )
            )
          )
        ),

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
