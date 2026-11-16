'use client';

import * as React from 'react';
import {
  Phone,
  Mail,
  MapPin,
  Globe,
  Building,
  Users,
  Clock,
  ShieldCheck,
  AlertCircle,
  FileText,
  Lock,
} from 'lucide-react';
import { VendorDto } from '@/schemas/vendors';
import { formatVND } from '@/lib/utils';

export interface VendorInfoCardsProps {
  vendor: VendorDto;
  isOwner: boolean;
}

export const VendorInfoCards: React.FC<VendorInfoCardsProps> = ({
  vendor,
  isOwner,
}) => {
  const isVenue = vendor.service_type === 'venue';

  return React.createElement(
    'div',
    { className: 'grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8' },
    // Column 1 & 2: Contact Information and Venue Specifications
    React.createElement(
      'div',
      { className: `${isOwner ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-6` },
      // Card 1: Contact details
      React.createElement(
        'div',
        {
          className:
            'bg-surface rounded-card p-6 border border-border-subtle shadow-sm space-y-4',
        },
        React.createElement(
          'h2',
          { className: 'text-lg font-bold text-text-main flex items-center gap-2' },
          React.createElement(Building, { className: 'w-5 h-5 text-primary', 'aria-hidden': 'true' }),
          'Thông Tin Liên Hệ & Trụ Sở'
        ),
        React.createElement(
          'div',
          { className: 'grid grid-cols-1 md:grid-cols-2 gap-4 text-sm' },
          // Contact person
          React.createElement(
            'div',
            { className: 'space-y-1' },
            React.createElement('span', { className: 'text-xs text-text-muted' }, 'Người đại diện:'),
            React.createElement(
              'p',
              { className: 'font-semibold text-text-main' },
              vendor.contact_person || 'Chưa cập nhật đầu mối'
            )
          ),
          // Phone
          React.createElement(
            'div',
            { className: 'space-y-1' },
            React.createElement('span', { className: 'text-xs text-text-muted' }, 'Số điện thoại:'),
            vendor.phone
              ? React.createElement(
                  'a',
                  {
                    href: `tel:${vendor.phone}`,
                    className:
                      'font-semibold text-primary hover:underline flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-focus rounded',
                  },
                  React.createElement(Phone, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
                  vendor.phone
                )
              : React.createElement('p', { className: 'text-text-muted/60' }, 'Chưa có SĐT')
          ),
          // Email
          React.createElement(
            'div',
            { className: 'space-y-1' },
            React.createElement('span', { className: 'text-xs text-text-muted' }, 'Email:'),
            vendor.email
              ? React.createElement(
                  'a',
                  {
                    href: `mailto:${vendor.email}`,
                    className:
                      'font-semibold text-primary hover:underline flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-focus rounded',
                  },
                  React.createElement(Mail, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
                  vendor.email
                )
              : React.createElement('p', { className: 'text-text-muted/60' }, 'Chưa có email')
          ),
          // Website
          React.createElement(
            'div',
            { className: 'space-y-1' },
            React.createElement('span', { className: 'text-xs text-text-muted' }, 'Website / Trang mạng:'),
            vendor.website
              ? React.createElement(
                  'a',
                  {
                    href: vendor.website,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className:
                      'font-semibold text-primary hover:underline flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-focus rounded line-clamp-1',
                  },
                  React.createElement(Globe, { className: 'w-4 h-4 shrink-0', 'aria-hidden': 'true' }),
                  vendor.website
                )
              : React.createElement('p', { className: 'text-text-muted/60' }, 'Chưa có website')
          )
        ),
        // Map Link if available
        vendor.map_url &&
          React.createElement(
            'div',
            { className: 'pt-2 border-t border-border-subtle/80 flex items-center justify-between text-xs' },
            React.createElement(
              'span',
              { className: 'text-text-muted flex items-center gap-1.5' },
              React.createElement(MapPin, { className: 'w-4 h-4 text-primary shrink-0', 'aria-hidden': 'true' }),
              vendor.address || 'Xem bản đồ vị trí'
            ),
            React.createElement(
              'a',
              {
                href: vendor.map_url,
                target: '_blank',
                rel: 'noopener noreferrer',
                className:
                  'text-primary font-semibold hover:underline px-2 py-1 bg-primary/10 rounded',
              },
              'Mở Google Maps'
            )
          )
      ),

      // Card 2: Venue Specifications (Only if service_type === 'venue')
      isVenue &&
        React.createElement(
          'div',
          {
            className:
              'bg-surface rounded-card p-6 border border-border-subtle shadow-sm space-y-4',
          },
          React.createElement(
            'h2',
            { className: 'text-lg font-bold text-text-main flex items-center gap-2' },
            React.createElement(Users, { className: 'w-5 h-5 text-primary', 'aria-hidden': 'true' }),
            'Thông Số Sảnh Tiệc & Quy Định Địa Điểm'
          ),
          React.createElement(
            'div',
            { className: 'grid grid-cols-2 md:grid-cols-4 gap-4 text-sm' },
            React.createElement(
              'div',
              { className: 'space-y-1' },
              React.createElement('span', { className: 'text-xs text-text-muted' }, 'Sức chứa tối đa:'),
              React.createElement(
                'p',
                { className: 'font-semibold text-text-main' },
                vendor.capacity ? `${vendor.capacity} khách` : 'Chưa nhập'
              )
            ),
            React.createElement(
              'div',
              { className: 'space-y-1' },
              React.createElement('span', { className: 'text-xs text-text-muted' }, 'Khách tối thiểu:'),
              React.createElement(
                'p',
                { className: 'font-semibold text-text-main' },
                vendor.min_guests ? `${vendor.min_guests} khách` : 'Không bắt buộc'
              )
            ),
            React.createElement(
              'div',
              { className: 'space-y-1' },
              React.createElement('span', { className: 'text-xs text-text-muted' }, 'Giá bàn tham khảo:'),
              React.createElement(
                'p',
                { className: 'font-semibold text-text-main' },
                vendor.table_price
                  ? `${formatVND(BigInt(vendor.table_price))}/bàn`
                  : 'Chưa báo'
              )
            ),
            React.createElement(
              'div',
              { className: 'space-y-1' },
              React.createElement('span', { className: 'text-xs text-text-muted' }, 'Phí thuê sảnh:'),
              React.createElement(
                'p',
                { className: 'font-semibold text-text-main' },
                vendor.rental_fee
                  ? formatVND(BigInt(vendor.rental_fee))
                  : 'Đã gồm trong gói'
              )
            )
          ),
          // Additional venue details
          React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-3 border-t border-border-subtle' },
            (vendor.prep_time || vendor.end_time) &&
              React.createElement(
                'div',
                { className: 'space-y-1' },
                React.createElement(
                  'span',
                  { className: 'text-text-muted font-medium flex items-center gap-1' },
                  React.createElement(Clock, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' }),
                  'Thời gian sử dụng mặt bằng:'
                ),
                React.createElement(
                  'p',
                  { className: 'text-text-main' },
                  `Bàn giao: ${vendor.prep_time || 'Thỏa thuận'} • Kết thúc: ${
                    vendor.end_time || 'Thỏa thuận'
                  }`
                )
              ),
            React.createElement(
              'div',
              { className: 'space-y-1' },
              React.createElement('span', { className: 'text-text-muted font-medium' }, 'Thuế VAT & Phí phục vụ:'),
              React.createElement(
                'p',
                { className: 'text-text-main' },
                vendor.fees_inclusive
                  ? 'Đã bao gồm đầy đủ trong đơn giá bàn'
                  : 'Chưa bao gồm (sẽ tính thêm 10% VAT & 5% phí phục vụ)'
              )
            )
          ),
          // Rain plan & Decor rules
          (vendor.rain_plan || vendor.decor_audio_rules || vendor.parking_notes) &&
            React.createElement(
              'div',
              { className: 'space-y-2 pt-2 text-xs text-text-muted bg-[#FAF9F5] p-3 rounded' },
              vendor.rain_plan &&
                React.createElement(
                  'p',
                  null,
                  React.createElement('strong', { className: 'text-text-main' }, 'Phương án mưa: '),
                  vendor.rain_plan
                ),
              vendor.decor_audio_rules &&
                React.createElement(
                  'p',
                  null,
                  React.createElement('strong', { className: 'text-text-main' }, 'Quy định âm thanh & trang trí: '),
                  vendor.decor_audio_rules
                ),
              vendor.parking_notes &&
                React.createElement(
                  'p',
                  null,
                  React.createElement('strong', { className: 'text-text-main' }, 'Bãi đậu xe: '),
                  vendor.parking_notes
                )
            )
        )
    ),

    // Column 3: Private Notes & Negotiation (STRICT AT03, AT41: Owner only)
    isOwner &&
      React.createElement(
        'div',
        { className: 'space-y-6' },
        React.createElement(
          'div',
          {
            className:
              'bg-[#FAF9F5] rounded-card p-6 border border-border-control/60 shadow-sm space-y-4',
          },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between' },
            React.createElement(
              'h2',
              { className: 'text-base font-bold text-text-main flex items-center gap-2' },
              React.createElement(Lock, { className: 'w-4 h-4 text-warning', 'aria-hidden': 'true' }),
              'Ghi Chú Riêng Tư'
            ),
            React.createElement(
              'span',
              {
                className:
                  'text-[11px] font-semibold text-warning bg-warning-bg px-2 py-0.5 rounded border border-warning/30',
              },
              'Chỉ Chủ Sở Hữu'
            )
          ),
          React.createElement(
            'p',
            { className: 'text-xs text-text-muted leading-relaxed' },
            'Thông tin đàm phán, thỏa thuận nội bộ và các chi phí phát sinh được bảo mật tuyệt đối, tự động ẩn khỏi vai trò Người nhà.'
          ),
          React.createElement(
            'div',
            { className: 'space-y-3 pt-2 text-sm' },
            React.createElement(
              'div',
              { className: 'space-y-1' },
              React.createElement('span', { className: 'text-xs font-medium text-text-muted' }, 'Ghi chú nội bộ:'),
              React.createElement(
                'p',
                { className: 'text-text-main bg-surface p-3 rounded border border-border-subtle whitespace-pre-wrap text-xs' },
                vendor.notes || 'Chưa có ghi chú đàm phán nào.'
              )
            ),
            vendor.extra_fees_notes &&
              React.createElement(
                'div',
                { className: 'space-y-1' },
                React.createElement('span', { className: 'text-xs font-medium text-text-muted' }, 'Phụ phí cần lưu ý:'),
                React.createElement(
                  'p',
                  { className: 'text-danger bg-danger-bg p-3 rounded border border-danger/20 text-xs' },
                  vendor.extra_fees_notes
                )
              )
          )
        )
      )
  );
};
