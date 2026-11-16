'use client';

import * as React from 'react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  VendorServiceType,
  VendorStatus,
  CreateVendorInput,
  createVendorSchema,
  VendorDto,
} from '@/schemas/vendors';
import { vendorsApi } from '@/lib/vendors/api-client';
import { SERVICE_TYPE_LABELS, STATUS_CONFIG } from './constants';

export interface AddVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newVendor: VendorDto) => void;
}

export const AddVendorModal: React.FC<AddVendorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Form states
  const [name, setName] = React.useState('');
  const [serviceType, setServiceType] = React.useState<VendorServiceType>('other');
  const [status, setStatus] = React.useState<VendorStatus>('researching');
  const [contactPerson, setContactPerson] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [mapUrl, setMapUrl] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [rating, setRating] = React.useState<number | null>(null);

  // Venue-specific states
  const [capacity, setCapacity] = React.useState<string>('');
  const [minGuests, setMinGuests] = React.useState<string>('');
  const [tablePrice, setTablePrice] = React.useState<bigint | null>(null);
  const [seatsPerTable, setSeatsPerTable] = React.useState<string>('10');
  const [rentalFee, setRentalFee] = React.useState<bigint | null>(null);
  const [feesInclusive, setFeesInclusive] = React.useState(false);
  const [prepTime, setPrepTime] = React.useState('');
  const [endTime, setEndTime] = React.useState('');
  const [parkingNotes, setParkingNotes] = React.useState('');
  const [rainPlan, setRainPlan] = React.useState('');
  const [decorAudioRules, setDecorAudioRules] = React.useState('');
  const [extraFeesNotes, setExtraFeesNotes] = React.useState('');

  const resetForm = () => {
    setName('');
    setServiceType('other');
    setStatus('researching');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setMapUrl('');
    setWebsite('');
    setNotes('');
    setRating(null);
    setCapacity('');
    setMinGuests('');
    setTablePrice(null);
    setSeatsPerTable('10');
    setRentalFee(null);
    setFeesInclusive(false);
    setPrepTime('');
    setEndTime('');
    setParkingNotes('');
    setRainPlan('');
    setDecorAudioRules('');
    setExtraFeesNotes('');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const isVenue = serviceType === 'venue';

    const rawPayload: CreateVendorInput = {
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
    };

    const parsed = createVendorSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setErrorMsg(firstIssue?.message || 'Dữ liệu nhập chưa hợp lệ');
      return;
    }

    try {
      setLoading(true);
      const res = await vendorsApi.create(parsed.data);
      resetForm();
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tạo nhà cung cấp. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    ModalDialog,
    {
      isOpen,
      onClose: () => {
        resetForm();
        onClose();
      },
      title: 'Thêm Nhà Cung Cấp Mới',
      description: 'Nhập thông tin đối tác dịch vụ hoặc địa điểm tổ chức tiệc cưới.',
      maxWidth: 'lg',
    },
    React.createElement(
      'form',
      { onSubmit: handleSubmit, className: 'space-y-4 pt-2' },
      errorMsg &&
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
          placeholder: 'Ví dụ: Trung tâm Tiệc cưới Riverside',
          required: true,
          autoFocusOnError: true,
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
          placeholder: 'Ví dụ: Anh Hoàng (Quản lý sảnh)',
        }),
        React.createElement(TextInput, {
          label: 'Số điện thoại',
          value: phone,
          onChange: (e) => setPhone(e.target.value),
          placeholder: '0901234567',
        })
      ),

      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
        React.createElement(TextInput, {
          label: 'Email liên hệ',
          value: email,
          onChange: (e) => setEmail(e.target.value),
          placeholder: 'contact@partner.vn',
          type: 'email',
        }),
        React.createElement(TextInput, {
          label: 'Địa chỉ trụ sở / Sảnh tiệc',
          value: address,
          onChange: (e) => setAddress(e.target.value),
          placeholder: 'Số nhà, tên đường, quận/huyện',
        })
      ),

      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
        React.createElement(TextInput, {
          label: 'Đường dẫn Google Maps',
          value: mapUrl,
          onChange: (e) => setMapUrl(e.target.value),
          placeholder: 'https://maps.google.com/?q=...',
        }),
        React.createElement(TextInput, {
          label: 'Website / Fanpage',
          value: website,
          onChange: (e) => setWebsite(e.target.value),
          placeholder: 'https://vendor.com',
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
              placeholder: '500',
            }),
            React.createElement(TextInput, {
              label: 'Số khách tối thiểu',
              type: 'number',
              value: minGuests,
              onChange: (e) => setMinGuests(e.target.value),
              placeholder: '150',
            }),
            React.createElement(TextInput, {
              label: 'Số ghế mỗi bàn',
              type: 'number',
              value: seatsPerTable,
              onChange: (e) => setSeatsPerTable(e.target.value),
              placeholder: '10',
            }),
            React.createElement(CurrencyInput, {
              label: 'Giá bàn tham khảo',
              value: tablePrice,
              onChange: setTablePrice,
              placeholder: '5.000.000',
            })
          ),
          React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-3 gap-3 items-center' },
            React.createElement(CurrencyInput, {
              label: 'Phí thuê sảnh (nếu có)',
              value: rentalFee,
              onChange: setRentalFee,
              placeholder: '20.000.000',
            }),
            React.createElement(TextInput, {
              label: 'Giờ bắt đầu chuẩn bị',
              value: prepTime,
              onChange: (e) => setPrepTime(e.target.value),
              placeholder: '14:00',
            }),
            React.createElement(TextInput, {
              label: 'Giờ kết thúc tiệc',
              value: endTime,
              onChange: (e) => setEndTime(e.target.value),
              placeholder: '22:30',
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
                placeholder: 'Có sảnh kín hoặc rạp bạt che sẵn...',
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
                placeholder: 'Giới hạn âm lượng sau 21h, bãi xe ô tô...',
                className:
                  'w-full p-2 bg-surface border border-border-control rounded-control text-sm focus:outline-2 focus:outline-focus',
              })
            )
          )
        ),

      // Private Notes (AT03, AT41)
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
          placeholder: 'Ghi chú về đàm phán giá, ưu đãi bí mật...',
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
            loadingText: 'Đang lưu đối tác...',
          },
          'Thêm đối tác'
        )
      )
    )
  );
};
