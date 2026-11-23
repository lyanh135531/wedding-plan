'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Checkbox } from '@/components/ui/checkbox';
import { ModalDialog } from '@/components/ui/dialog';
import { PlusCircle } from 'lucide-react';

const h = React.createElement;

export interface CreateCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (costData: {
    name: string;
    category: string;
    contractedAmount: bigint | null;
    isMissingPrice: boolean;
  }) => void;
}

export const CreateCostModal: React.FC<CreateCostModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('Ban nhạc & Âm thanh');
  const [isMissingPrice, setIsMissingPrice] = React.useState(false);
  const [amount, setAmount] = React.useState<bigint | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name,
      category,
      contractedAmount: isMissingPrice ? null : amount,
      isMissingPrice: isMissingPrice || amount === null,
    });
    onClose();
  };

  return h(
    ModalDialog,
    {
      isOpen,
      onClose,
      title: 'Thêm khoản chi mới',
      maxWidth: 'sm',
      footer: h(
        'div',
        { className: 'flex items-center justify-end gap-3 w-full' },
        h(
          Button,
          {
            type: 'button',
            variant: 'secondary',
            onClick: onClose,
          },
          'Hủy bỏ'
        ),
        h(
          Button,
          {
            type: 'submit',
            form: 'create-cost-form',
            variant: 'primary',
          },
          'Lưu khoản chi'
        )
      ),
    },
    h(
      'form',
      { id: 'create-cost-form', onSubmit: handleSubmit, className: 'space-y-4' },
      h(TextInput, {
        label: 'Tên khoản chi / Dịch vụ',
        value: name,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
        placeholder: 'Ví dụ: Ban nhạc acoustic & hòa tấu',
        required: true,
      }),

      h(
        'div',
        null,
        h('label', { className: 'block text-xs font-medium text-text-muted mb-1' }, 'Danh mục chi tiêu:'),
        h(
          'select',
          {
            value: category,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value),
            className:
              'w-full h-10 px-3 text-sm bg-surface border border-border-control rounded-control focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
          },
          h('option', { value: 'Tiệc cưới' }, 'Tiệc cưới & Địa điểm'),
          h('option', { value: 'Trang phục' }, 'Trang phục & Make-up'),
          h('option', { value: 'Chụp ảnh' }, 'Chụp ảnh & Quay phim'),
          h('option', { value: 'Trang trí' }, 'Trang trí gia tiên & Rạp'),
          h('option', { value: 'Ban nhạc & Âm thanh' }, 'Ban nhạc & Âm thanh'),
          h('option', { value: 'Khác' }, 'Chi phí khác')
        )
      ),

      // Missing price checkbox (UXT06)
      h(
        'div',
        { className: 'p-3 bg-page border border-border-subtle rounded-control' },
        h(Checkbox, {
          checked: isMissingPrice,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            const checked = e.target.checked;
            setIsMissingPrice(checked);
            if (checked) setAmount(null);
          },
          label: 'Chưa có giá / Đang khảo sát thương lượng',
        })
      ),

      // Currency input (disabled if isMissingPrice)
      !isMissingPrice &&
        h(CurrencyInput, {
          label: 'Giá dự kiến / Giá hợp đồng',
          value: amount,
          onChange: setAmount,
          placeholder: 'Nhập số tiền (VND)...',
          required: !isMissingPrice,
        })
    )
  );
};
