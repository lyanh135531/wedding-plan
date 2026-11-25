'use client';

import React, { useState } from 'react';
import { api, jsonBody } from '@/lib/api/request';
import { RecordEditor, RecordData, Field } from '@/components/common/ResourceWorkspace';
import { GuestOwnerDto } from '@/schemas/guests';
import { Pencil, Trash2 } from 'lucide-react';

const fields: Field[] = [
  { key: 'display_name', label: 'Họ và tên', required: true },
  {
    key: 'side',
    label: 'Bên mời',
    type: 'select',
    required: true,
    options: [
      { value: 'groom', label: 'Nhà trai' },
      { value: 'bride', label: 'Nhà gái' },
      { value: 'mutual', label: 'Chung' },
      { value: 'unassigned', label: 'Chưa phân loại' },
    ],
  },
  {
    key: 'age_tier',
    label: 'Độ tuổi',
    type: 'select',
    required: true,
    options: [
      { value: 'adult', label: 'Người lớn' },
      { value: 'child', label: 'Trẻ em' },
      { value: 'baby', label: 'Em bé' },
    ],
  },
  { key: 'phone', label: 'Số điện thoại', type: 'tel' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'sub_tags', label: 'Nhãn', type: 'tags' },
  { key: 'private_notes', label: 'Ghi chú riêng', type: 'textarea' },
  { key: 'is_placeholder', label: 'Khách đại diện tạm', type: 'checkbox' },
  { key: 'placeholder_for', label: 'Đại diện cho' },
];

/**
 * Compact row actions (edit profile and permanent delete) for an owner-managed guest.
 */
export function GuestActions({ guest, reload }: { guest: GuestOwnerDto; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (
      busy ||
      !window.confirm(
        `Xóa vĩnh viễn khách mời "${guest.display_name}"? Toàn bộ thiệp mời, RSVP và chỗ ngồi của khách này sẽ bị xóa và không thể khôi phục.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/api/v1/guests/${guest.id}`, {
        method: 'DELETE',
      });
      await reload();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Sửa hồ sơ"
        title="Sửa hồ sơ"
        className="inline-flex items-center justify-center h-9 w-9 md:h-8 md:w-8 rounded-control border border-border-subtle bg-surface text-text-muted hover:text-primary hover:border-primary/40 hover:bg-page transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleDelete()}
        aria-label="Xóa khách mời"
        title="Xóa khách mời"
        className="inline-flex items-center justify-center h-9 w-9 md:h-8 md:w-8 rounded-control border border-border-subtle bg-surface text-text-muted hover:text-danger hover:border-danger/40 hover:bg-danger-bg/40 transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {error && (
        <span role="alert" className="text-xs text-danger max-w-[180px] truncate" title={error}>
          {error}
        </span>
      )}

      {open && (
        <RecordEditor
          title="Sửa hồ sơ khách"
          fields={fields}
          record={guest as unknown as RecordData}
          close={() => setOpen(false)}
          save={async (body) => {
            await api(`/api/v1/guests/${guest.id}`, {
              method: 'PATCH',
              body: jsonBody({ ...body, version: guest.version }),
            });
            await reload();
          }}
        />
      )}
    </div>
  );
}
