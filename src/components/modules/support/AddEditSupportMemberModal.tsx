'use client';

import * as React from 'react';
import { SupportMember, SupportMemberFormData, SupportRole } from './types';
import { ROLE_CONFIG } from './SupportMemberCard';
import { X, Users, AlertCircle, Info } from 'lucide-react';

const h = React.createElement;

export interface AddEditSupportMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SupportMemberFormData) => void;
  initialData?: SupportMember | null;
}

const ALL_ROLES: SupportRole[] = [
  'co_dau',
  'chu_re',
  'phu_dau',
  'phu_re',
  'mc',
  'dieu_phoi',
  'nguoi_than',
  'nha_cung_cap',
  'khac',
];

export const AddEditSupportMemberModal: React.FC<AddEditSupportMemberModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [formData, setFormData] = React.useState<SupportMemberFormData>(() => ({
    name: initialData?.name || '',
    phone: initialData?.phone || '',
    roles: initialData?.roles || ['nguoi_than'],
    arrivalTime: initialData?.arrivalTime || '',
    backupName: initialData?.backupName || '',
    backupPhone: initialData?.backupPhone || '',
    attireNotes: initialData?.attireNotes || '',
    duties: initialData?.duties || '',
    isShared: initialData?.isShared !== undefined ? initialData.isShared : true,
  }));
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        phone: initialData.phone || '',
        roles: initialData.roles || ['nguoi_than'],
        arrivalTime: initialData.arrivalTime || '',
        backupName: initialData.backupName || '',
        backupPhone: initialData.backupPhone || '',
        attireNotes: initialData.attireNotes || '',
        duties: initialData.duties || '',
        isShared: initialData.isShared !== undefined ? initialData.isShared : true,
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        roles: ['nguoi_than'],
        arrivalTime: '',
        backupName: '',
        backupPhone: '',
        attireNotes: '',
        duties: '',
        isShared: true,
      });
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const toggleRole = (role: SupportRole) => {
    const exists = formData.roles.includes(role);
    if (exists) {
      if (formData.roles.length === 1) {
        setError('Thành viên phải có ít nhất một vai trò');
        return;
      }
      setFormData({
        ...formData,
        roles: formData.roles.filter((r) => r !== role),
      });
    } else {
      setFormData({
        ...formData,
        roles: [...formData.roles, role],
      });
    }
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Vui lòng nhập họ và tên');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Vui lòng nhập số điện thoại liên hệ');
      return;
    }
    if (formData.roles.length === 0) {
      setError('Vui lòng chọn ít nhất một vai trò');
      return;
    }

    onSubmit(formData);
    onClose();
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150',
      'data-testid': 'add-edit-support-member-modal',
    },
    h(
      'div',
      {
        className:
          'bg-white rounded-xl shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]',
      },
      // Header
      h(
        'div',
        {
          className:
            'flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50',
        },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(Users, { className: 'w-5 h-5 text-primary' }),
          h(
            'h2',
            { className: 'text-base font-semibold text-gray-900' },
            initialData ? 'Chỉnh sửa thông tin thành viên' : 'Thêm thành viên đội hỗ trợ'
          )
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: onClose,
            className: 'p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition',
          },
          h(X, { className: 'w-4 h-4' })
        )
      ),
      // Invariant Info Banner
      h(
        'div',
        {
          className:
            'px-6 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center gap-2 text-xs text-blue-800',
        },
        h(Info, { className: 'w-4 h-4 text-blue-600 shrink-0' }),
        h(
          'span',
          {},
          'Quy định bất biến: Hồ sơ hỗ trợ dùng để liên lạc vận hành, tuyệt đối không gửi lời mời hay cấp tài khoản đăng nhập.'
        )
      ),
      // Form Body
      h(
        'form',
        { onSubmit: handleSubmit, className: 'p-6 overflow-y-auto space-y-4 flex-1 text-sm' },
        error &&
          h(
            'div',
            {
              className:
                'p-3 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200',
            },
            h(AlertCircle, { className: 'w-4 h-4 shrink-0' }),
            error
          ),
        // Name & Phone
        h(
          'div',
          { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Họ và tên *'),
            h('input', {
              type: 'text',
              required: true,
              value: formData.name,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, name: e.target.value }),
              placeholder: 'Ví dụ: Nguyễn Văn An, MC Tuấn...',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          ),
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Số điện thoại liên hệ *'),
            h('input', {
              type: 'tel',
              required: true,
              value: formData.phone,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, phone: e.target.value }),
              placeholder: '0901234567',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono',
            })
          )
        ),
        // 9 Semantic Roles (Multi-select)
        h(
          'div',
          { className: 'space-y-1.5' },
          h(
            'label',
            { className: 'block text-xs font-semibold text-gray-700' },
            'Vai trò đảm nhiệm (có thể chọn nhiều)'
          ),
          h(
            'div',
            { className: 'flex flex-wrap gap-2 pt-1' },
            ALL_ROLES.map((role) => {
              const isSelected = formData.roles.includes(role);
              const conf = ROLE_CONFIG[role];
              return h(
                'button',
                {
                  key: role,
                  type: 'button',
                  onClick: () => toggleRole(role),
                  className: `px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`,
                },
                conf.label
              );
            })
          )
        ),
        // Arrival Time & Backup
        h(
          'div',
          { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Giờ có mặt'),
            h('input', {
              type: 'text',
              value: formData.arrivalTime,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, arrivalTime: e.target.value }),
              placeholder: 'Ví dụ: 07:00 sáng ngày cưới',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          ),
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Người liên hệ dự phòng'),
            h('input', {
              type: 'text',
              value: formData.backupName,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, backupName: e.target.value }),
              placeholder: 'Tên người dự phòng nếu không gọi được',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          )
        ),
        // Backup phone
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'SĐT dự phòng'),
          h('input', {
            type: 'tel',
            value: formData.backupPhone,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, backupPhone: e.target.value }),
            placeholder: '09xxxxxxxx',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono',
          })
        ),
        // Attire notes
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Ghi chú trang phục (Attire)'),
          h('input', {
            type: 'text',
            value: formData.attireNotes,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, attireNotes: e.target.value }),
            placeholder: 'Ví dụ: Áo dài hồng pastel, sơ mi trắng quần âu...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // Duties
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Nhiệm vụ & Đầu việc được giao'),
          h('textarea', {
            rows: 2,
            value: formData.duties,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFormData({ ...formData, duties: e.target.value }),
            placeholder: 'Mô tả chi tiết đầu việc, trách nhiệm phụ trách...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // Shared toggle
        h(
          'div',
          { className: 'p-3 bg-gray-50 border border-gray-200 rounded-lg' },
          h(
            'label',
            { className: 'flex items-center gap-2 cursor-pointer' },
            h('input', {
              type: 'checkbox',
              checked: formData.isShared,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, isShared: e.target.checked }),
              className: 'rounded text-primary focus:ring-primary w-4 h-4',
            }),
            h(
              'span',
              { className: 'text-xs font-medium text-gray-800' },
              'Chia sẻ liên hệ này cho người nhà (Family View) xem để phối hợp'
            )
          )
        ),
        // Footer buttons
        h(
          'div',
          { className: 'pt-4 border-t border-gray-100 flex items-center justify-end gap-3' },
          h(
            'button',
            {
              type: 'button',
              onClick: onClose,
              className:
                'px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition',
            },
            'Hủy'
          ),
          h(
            'button',
            {
              type: 'submit',
              className:
                'px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition shadow-xs',
            },
            initialData ? 'Lưu thay đổi' : 'Thêm thành viên'
          )
        )
      )
    )
  );
};
