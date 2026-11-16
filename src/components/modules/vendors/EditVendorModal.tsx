'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  VendorDto,
  VendorServiceType,
  VendorStatus,
  UpdateVendorInput,
  updateVendorSchema,
} from '@/schemas/vendors';
import { vendorsApi } from '@/lib/vendors/api-client';
import { SERVICE_TYPE_LABELS, STATUS_CONFIG } from './constants';

export interface EditVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: VendorDto;
  onSuccess: (updatedVendor: VendorDto) => void;
  onReloadRequested: () => void;
}

export const EditVendorModal: React.FC<EditVendorModalProps> = ({
  isOpen,
  onClose,
  vendor,
  onSuccess,
  onReloadRequested,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isVersionConflict, setIsVersionConflict] = React.useState(false);

  // Form states populated from vendor
  const [name, setName] = React.useState(vendor.name);
  const [serviceType, setServiceType] = React.useState<VendorServiceType>(vendor.service_type);
  const [status, setStatus] = React.useState<VendorStatus>(vendor.status);
  const [contactPerson, setContactPerson] = React.useState(vendor.contact_person || '');
  const [phone, setPhone] = React.useState(vendor.phone || '');
  const [email, setEmail] = React.useState(vendor.email || '');
  const [address, setAddress] = React.useState(vendor.address || '');
  const [mapUrl, setMapUrl] = React.useState(vendor.map_url || '');
  const [website, setWebsite] = React.useState(vendor.website || '');
  const [notes, setNotes] = React.useState(vendor.notes || '');
  const [rating, setRating] = React.useState<number | null>(vendor.rating || null);

  // Venue-specific states
  const [capacity, setCapacity] = React.useState<string>(
    vendor.capacity ? String(vendor.capacity) : ''
  );
  const [minGuests, setMinGuests] = React.useState<string>(
    vendor.min_guests ? String(vendor.min_guests) : ''
  );
  const [tablePrice, setTablePrice] = React.useState<bigint | null>(
    vendor.table_price ? BigInt(vendor.table_price) : null
  );
  const [seatsPerTable, setSeatsPerTable] = React.useState<string>(
    vendor.seats_per_table ? String(vendor.seats_per_table) : '10'
  );
  const [rentalFee, setRentalFee] = React.useState<bigint | null>(
    vendor.rental_fee ? BigInt(vendor.rental_fee) : null
  );
  const [feesInclusive, setFeesInclusive] = React.useState(vendor.fees_inclusive);
  const [prepTime, setPrepTime] = React.useState(vendor.prep_time || '');
  const [endTime, setEndTime] = React.useState(vendor.end_time || '');
  const [parkingNotes, setParkingNotes] = React.useState(vendor.parking_notes || '');
  const [rainPlan, setRainPlan] = React.useState(vendor.rain_plan || '');
  const [decorAudioRules, setDecorAudioRules] = React.useState(vendor.decor_audio_rules || '');
  const [extraFeesNotes, setExtraFeesNotes] = React.useState(vendor.extra_fees_notes || '');

  // Reset form when vendor changes
  React.useEffect(() => {
    setName(vendor.name);
    setServiceType(vendor.service_type);
    setStatus(vendor.status);
    setContactPerson(vendor.contact_person || '');
    setPhone(vendor.phone || '');
    setEmail(vendor.email || '');
    setAddress(vendor.address || '');
    setMapUrl(vendor.map_url || '');
    setWebsite(vendor.website || '');
    setNotes(vendor.notes || '');
    setRating(vendor.rating || null);
    setCapacity(vendor.capacity ? String(vendor.capacity) : '');
    setMinGuests(vendor.min_guests ? String(vendor.min_guests) : '');
    setTablePrice(vendor.table_price ? BigInt(vendor.table_price) : null);
    setSeatsPerTable(vendor.seats_per_table ? String(vendor.seats_per_table) : '10');
    setRentalFee(vendor.rental_fee ? BigInt(vendor.rental_fee) : null);
    setFeesInclusive(vendor.fees_inclusive);
    setPrepTime(vendor.prep_time || '');
    setEndTime(vendor.end_time || '');
    setParkingNotes(vendor.parking_notes || '');
    setRainPlan(vendor.rain_plan || '');
    setDecorAudioRules(vendor.decor_audio_rules || '');
    setExtraFeesNotes(vendor.extra_fees_notes || '');
    setErrorMsg(null);
    setIsVersionConflict(false);
  }, [vendor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsVersionConflict(false);

    const isVenue = serviceType === 'venue';

    const rawPayload: UpdateVendorInput = {
      name: name.trim(),
      service_type: serviceType,
      status,
      contact_person: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      map_url: mapUrl.trim() || null,
      website: website.trim() || null,
      notes: notes.trim() || null,
      rating: rating ? Number(rating) : null,

      capacity: isVenue && capacity ? Number(capacity) : null,
      min_guests: isVenue && minGuests ? Number(minGuests) : null,
      table_price: isVenue && tablePrice !== null ? tablePrice.toString() : null,
      seats_per_table: isVenue && seatsPerTable ? Number(seatsPerTable) : null,
      rental_fee: isVenue && rentalFee !== null ? rentalFee.toString() : null,
      fees_inclusive: isVenue ? feesInclusive : false,
      prep_time: isVenue && prepTime.trim() ? prepTime.trim() : null,
      end_time: isVenue && endTime.trim() ? endTime.trim() : null,
      parking_notes: isVenue && parkingNotes.trim() ? parkingNotes.trim() : null,
      rain_plan: isVenue && rainPlan.trim() ? rainPlan.trim() : null,
      decor_audio_rules: isVenue && decorAudioRules.trim() ? decorAudioRules.trim() : null,
      extra_fees_notes: isVenue && extraFeesNotes.trim() ? extraFeesNotes.trim() : null,

      // AT30: Optimistic locking version
      version: vendor.version,
    };

    const parsed = updateVendorSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setErrorMsg(firstIssue?.message || 'Dữ liệu nhập chưa hợp lệ');
      return;
    }

    try {
      setLoading(true);
      const res = await vendorsApi.update(vendor.id, parsed.data);
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      if (err.status === 409 || err.code === 'CONFLICT') {
        // AT30: Optimistic locking version conflict
        setIsVersionConflict(true);
        setErrorMsg('Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại');
      } else {
        setErrorMsg(err.message || 'Không thể cập nhật nhà cung cấp. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    ModalDialog,
    {
      isOpen,
      onClose,
      title: 'Chỉnh Sửa Hồ Sơ Nhà Cung Cấp',
      description: `Cập nhật thông tin chi tiết cho ${vendor.name} (Phiên bản ${vendor.version})`,
      maxWidth: 'lg',
    },
    React.createElement(
      'form',
      { onSubmit: handleSubmit, className: 'space-y-4 pt-2' },
      // AT30: Optimistic locking conflict banner
      isVersionConflict &&
        React.createElement(
          'div',
          {
            className:
              'p-4 bg-warning-bg border border-warning/40 rounded-control space-y-2',
            role: 'alert',
          },
          React.createElement(
            'div',
            { className: 'flex items-center gap-2 text-warning font-semibold text-sm' },
            React.createElement(AlertTriangle, { className: 'w-4 h-4 shrink-0', 'aria-hidden': 'true' }),
            'Xung đột phiên bản dữ liệu (HTTP 409 Conflict)'
          ),
          React.createElement(
            'p',
            { className: 'text-xs text-text-main' },
            'Hồ sơ này đã được chỉnh sửa bởi một người dùng khác hoặc trên một phiên làm việc khác. Để đảm bảo không ghi đè mất mát dữ liệu, vui lòng bấm "Tải lại dữ liệu" để xem nội dung mới nhất.'
          ),
          React.createElement(
            Button,
            {
              type: 'button',
              variant: 'secondary',
              onClick: () => {
                onReloadRequested();
                onClose();
              },
              size: 'sm',
              leftIcon: React.createElement(RefreshCw, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' }),
            },
            'Tải lại dữ liệu mới nhất'
          )
        ),

      errorMsg &&
        !isVersionConflict &&
        React.createElement(
          'div',
          {
            className:
              'p-3 bg-danger-bg text-danger border border-danger/30 rounded-control text-sm',
            role: 'alert',
          },
          errorMsg
        ),

      // Basic Information
      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
        React.createElement(TextInput, {
          label: 'Tên nhà cung cấp *',
          value: name,
          onChange: (e) => setName(e.target.value),
          required: true,
        }),
        React.createElement(
          'div',
          { className: 'space-y-1' },
          React.createElement(
            'label',
            { className: 'block text-sm font-medium text-text-main' },
            'Loại dịch vụ *'
          ),
          React.createElement(
            'select',
            {
              value: serviceType,
              onChange: (e) => setServiceType(e.target.value as VendorServiceType),
              className:
                'w-full py-2.5 px-3 bg-[#FAF9F5] border border-border-control rounded-control text-base text-text-main focus:outline-2 focus:outline-focus min-h-[44px]',
              required: true,
            },
            (Object.keys(SERVICE_TYPE_LABELS) as VendorServiceType[]).map((st) =>
              React.createElement(
                'option',
                { key: st, value: st },
                SERVICE_TYPE_LABELS[st]
              )
            )
          )
        )
      ),

      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
        React.createElement(
          'div',
          { className: 'space-y-1' },
          React.createElement(
            'label',
            { className: 'block text-sm font-medium text-text-main' },
            'Trạng thái'
          ),
          React.createElement(
            'select',
            {
              value: status,
              onChange: (e) => setStatus(e.target.value as VendorStatus),
              className:
                'w-full py-2.5 px-3 bg-[#FAF9F5] border border-border-control rounded-control text-base text-text-main focus:outline-2 focus:outline-focus min-h-[44px]',
            },
            (Object.keys(STATUS_CONFIG) as VendorStatus[]).map((st) =>
              React.createElement(
                'option',
                { key: st, value: st },
                STATUS_CONFIG[st].label
              )
            )
          )
        ),
        React.createElement(TextInput, {
          label: 'Người đại diện / liên hệ',
          value: contactPerson,
          onChange: (e) => setContactPerson(e.target.value),
        }),
        React.createElement(TextInput, {
          label: 'Số điện thoại',
          value: phone,
          onChange: (e) => setPhone(e.target.value),
        })
      ),

      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
        React.createElement(TextInput, {
          label: 'Email liên hệ',
          value: email,
          onChange: (e) => setEmail(e.target.value),
          type: 'email',
        }),
        React.createElement(TextInput, {
          label: 'Địa chỉ trụ sở / Sảnh tiệc',
          value: address,
          onChange: (e) => setAddress(e.target.value),
        })
      ),

      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
        React.createElement(TextInput, {
          label: 'Đường dẫn Google Maps',
          value: mapUrl,
          onChange: (e) => setMapUrl(e.target.value),
        }),
        React.createElement(TextInput, {
          label: 'Website / Fanpage',
          value: website,
          onChange: (e) => setWebsite(e.target.value),
        })
      ),

      // VENUE SPECIFIC FIELDS (FL14, PLAN §11.2)
      serviceType === 'venue' &&
        React.createElement(
          'fieldset',
          {
            className:
              'p-4 bg-[#FAF9F5] border border-border-control/60 rounded-control space-y-3.5',
          },
          React.createElement(
            'legend',
            { className: 'text-sm font-semibold text-primary px-1' },
            'Thông số Sảnh tiệc & Địa điểm cưới'
          ),
          React.createElement(
            'div',
            { className: 'grid grid-cols-2 md:grid-cols-4 gap-3' },
            React.createElement(TextInput, {
              label: 'Sức chứa tối đa (khách)',
              type: 'number',
              value: capacity,
              onChange: (e) => setCapacity(e.target.value),
            }),
            React.createElement(TextInput, {
              label: 'Số khách tối thiểu',
              type: 'number',
              value: minGuests,
              onChange: (e) => setMinGuests(e.target.value),
            }),
            React.createElement(TextInput, {
              label: 'Số ghế mỗi bàn',
              type: 'number',
              value: seatsPerTable,
              onChange: (e) => setSeatsPerTable(e.target.value),
            }),
            React.createElement(CurrencyInput, {
              label: 'Giá bàn tham khảo',
              value: tablePrice,
              onChange: setTablePrice,
            })
          ),
          React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-3 gap-3 items-center' },
            React.createElement(CurrencyInput, {
              label: 'Phí thuê sảnh (nếu có)',
              value: rentalFee,
              onChange: setRentalFee,
            }),
            React.createElement(TextInput, {
              label: 'Giờ bắt đầu chuẩn bị',
              value: prepTime,
              onChange: (e) => setPrepTime(e.target.value),
            }),
            React.createElement(TextInput, {
              label: 'Giờ kết thúc tiệc',
              value: endTime,
              onChange: (e) => setEndTime(e.target.value),
            })
          ),
          React.createElement(Checkbox, {
            label: 'Đơn giá đã bao gồm VAT (10%) & Phí phục vụ (5%)',
            checked: feesInclusive,
            onChange: (e) => setFeesInclusive(e.target.checked),
          }),
          React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-2 gap-3 text-sm' },
            React.createElement(
              'div',
              { className: 'space-y-1' },
              React.createElement(
                'label',
                { className: 'font-medium text-xs text-text-muted' },
                'Phương án dự phòng mưa / Thời tiết'
              ),
              React.createElement('textarea', {
                value: rainPlan,
                onChange: (e) => setRainPlan(e.target.value),
                rows: 2,
                className:
                  'w-full p-2 bg-surface border border-border-control rounded-control text-sm focus:outline-2 focus:outline-focus',
              })
            ),
            React.createElement(
              'div',
              { className: 'space-y-1' },
              React.createElement(
                'label',
                { className: 'font-medium text-xs text-text-muted' },
                'Quy định trang trí, âm thanh & bãi xe'
              ),
              React.createElement('textarea', {
                value: decorAudioRules,
                onChange: (e) => setDecorAudioRules(e.target.value),
                rows: 2,
                className:
                  'w-full p-2 bg-surface border border-border-control rounded-control text-sm focus:outline-2 focus:outline-focus',
              })
            )
          )
        ),

      // Private Notes
      React.createElement(
        'div',
        { className: 'space-y-1' },
        React.createElement(
          'label',
          { className: 'block text-sm font-medium text-text-main' },
          'Ghi chú nội bộ (Chỉ Chủ sở hữu xem được)'
        ),
        React.createElement('textarea', {
          value: notes,
          onChange: (e) => setNotes(e.target.value),
          rows: 3,
          className:
            'w-full p-2.5 bg-[#FAF9F5] border border-border-control rounded-control text-base focus:outline-2 focus:outline-focus',
        })
      ),

      // Footer Actions
      React.createElement(
        'div',
        { className: 'pt-4 flex items-center justify-end gap-3 border-t border-border-subtle' },
        React.createElement(
          Button,
          {
            type: 'button',
            variant: 'secondary',
            onClick: onClose,
            disabled: loading,
          },
          'Hủy bỏ'
        ),
        React.createElement(
          Button,
          {
            type: 'submit',
            variant: 'primary',
            loading,
            disabled: isVersionConflict,
            loadingText: 'Đang lưu thay đổi...',
          },
          'Lưu thay đổi'
        )
      )
    )
  );
};
