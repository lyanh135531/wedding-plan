'use client';

import * as React from 'react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { TextInput } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { api, jsonBody } from '@/lib/api/request';
import type { BudgetCategory } from './budgetHelpers';

export interface BudgetCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: BudgetCategory | null;
  nextOrder: number;
  onSaved: (message: string) => Promise<void>;
}

export const BudgetCategoryModal: React.FC<BudgetCategoryModalProps> = ({
  isOpen,
  onClose,
  category,
  nextOrder,
  onSaved,
}) => {
  const isEdit = Boolean(category);
  const [name, setName] = React.useState('');
  const [allocatedBudget, setAllocatedBudget] = React.useState<bigint | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lock = React.useRef(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setError(null);
    lock.current = false;
    if (category) {
      setName(category.name);
      setAllocatedBudget(
        category.allocatedAmount !== null ? BigInt(category.allocatedAmount) : 0n
      );
    } else {
      setName('');
      setAllocatedBudget(null);
    }
  }, [isOpen, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current || saving) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Vui lòng nhập tên danh mục.');
      return;
    }

    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const budgetStr = (allocatedBudget ?? 0n).toString();
      if (category) {
        await api('/api/v1/finance/categories', {
          method: 'PATCH',
          body: jsonBody({
            id: category.id,
            expectedUpdatedAt: category.updatedAt,
            name: trimmed,
            allocated_budget: budgetStr,
            default_order: category.defaultOrder ?? 0,
          }),
        });
        await onSaved(`Đã cập nhật danh mục "${trimmed}".`);
      } else {
        await api('/api/v1/finance/categories', {
          method: 'POST',
          body: jsonBody({
            name: trimmed,
            allocated_budget: budgetStr,
            default_order: nextOrder,
          }),
        });
        await onSaved(`Đã thêm danh mục "${trimmed}".`);
      }
      onClose();
    } catch (failure) {
      setError((failure as Error).message || 'Không thể lưu danh mục.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={isEdit ? 'Sửa danh mục ngân sách' : 'Thêm danh mục ngân sách'}
      description="Đặt hạn mức dự kiến để theo dõi chi tiêu theo từng nhóm hạng mục."
      maxWidth="sm"
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="submit"
            form="budget-category-form"
            variant="primary"
            loading={saving}
          >
            {isEdit ? 'Lưu thay đổi' : 'Tạo danh mục'}
          </Button>
        </>
      }
    >
      <form id="budget-category-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <TextInput
          label="Tên danh mục *"
          placeholder="Ví dụ: Nhà hàng tiệc cưới, Váy cưới & Trang điểm..."
          value={name}
          disabled={saving}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />

        <CurrencyInput
          label="Ngân sách phân bổ (VND)"
          value={allocatedBudget}
          disabled={saving}
          onChange={(val) => {
            setAllocatedBudget(val);
            setError(null);
          }}
          placeholder="Nhập hạn mức (VD: 150.000.000)"
          helperText="Có thể để trống (0 ₫) nếu chưa chốt hạn mức cho danh mục này."
        />
      </form>
    </ModalDialog>
  );
};
