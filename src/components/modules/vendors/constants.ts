import { VendorServiceType, VendorStatus, CapacityFit } from '@/schemas/vendors';

export const SERVICE_TYPE_LABELS: Record<VendorServiceType, string> = {
  venue: 'Địa điểm & Sảnh tiệc',
  catering: 'Tiệc & Ẩm thực',
  photography: 'Chụp ảnh',
  videography: 'Quay phim',
  decoration: 'Trang trí tiệc',
  attire: 'Váy cưới & Trang phục',
  makeup: 'Trang điểm & Làm đẹp',
  invitation: 'Thiệp cưới',
  music_entertainment: 'Âm thanh & Ban nhạc',
  transportation: 'Xe hoa & Vận chuyển',
  accommodation: 'Khách sạn & Lưu trú',
  other: 'Dịch vụ khác',
};

export const STATUS_CONFIG: Record<
  VendorStatus,
  { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }
> = {
  researching: { label: 'Đang tìm hiểu', variant: 'neutral' },
  contacted: { label: 'Đã liên hệ', variant: 'info' },
  quoted: { label: 'Đã nhận báo giá', variant: 'warning' },
  shortlisted: { label: 'Danh sách rút gọn', variant: 'info' },
  selected: { label: 'Đã chốt hợp đồng', variant: 'success' },
  rejected: { label: 'Đã từ chối', variant: 'danger' },
  cancelled: { label: 'Đã hủy', variant: 'neutral' },
};

export const CAPACITY_FIT_CONFIG: Record<
  CapacityFit,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral'; description: string }
> = {
  optimal: {
    label: 'Phù hợp sức chứa',
    variant: 'success',
    description: 'Quy mô giả định nằm trong khoảng tiếp đón tối ưu của sảnh.',
  },
  below_min: {
    label: 'Dưới mức tối thiểu',
    variant: 'warning',
    description: 'Số khách giả định thấp hơn yêu cầu tối thiểu của sảnh.',
  },
  exceeds_max: {
    label: 'Vượt quá sức chứa tối đa',
    variant: 'danger',
    description: 'Số lượng khách hoặc bàn vượt quá sức chứa an toàn của sảnh tiệc.',
  },
  unspecified: {
    label: 'Chưa rõ sức chứa',
    variant: 'neutral',
    description: 'Nhà cung cấp chưa thiết lập thông số sức chứa sảnh.',
  },
};
