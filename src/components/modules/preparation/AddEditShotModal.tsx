'use client';

import * as React from 'react';
import { PhotoShot, ShotPriority } from './types';
import { X, Camera, AlertCircle } from 'lucide-react';

const h = React.createElement;

export interface AddEditShotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<PhotoShot, 'id' | 'completed' | 'version'>) => void;
  initialData?: PhotoShot | null;
}

export const AddEditShotModal: React.FC<AddEditShotModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [sceneTitle, setSceneTitle] = React.useState(
    () => initialData?.sceneTitle || ''
  );
  const [subjectGroup, setSubjectGroup] = React.useState(
    () => initialData?.subjectGroup || ''
  );
  const [session, setSession] = React.useState(() => initialData?.session || '');
  const [priority, setPriority] = React.useState<ShotPriority>(
    () => initialData?.priority || 'must_have'
  );
  const [gatheringLead, setGatheringLead] = React.useState(
    () => initialData?.gatheringLead || ''
  );
  const [notes, setNotes] = React.useState(() => initialData?.notes || '');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (initialData) {
      setSceneTitle(initialData.sceneTitle || '');
      setSubjectGroup(initialData.subjectGroup || '');
      setSession(initialData.session || '');
      setPriority(initialData.priority || 'must_have');
      setGatheringLead(initialData.gatheringLead || '');
      setNotes(initialData.notes || '');
    } else {
      setSceneTitle('');
      setSubjectGroup('');
      setSession('');
      setPriority('must_have');
      setGatheringLead('');
      setNotes('');
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sceneTitle.trim()) {
      setError('Vui lòng nhập tên cảnh chụp');
      return;
    }
    if (!gatheringLead.trim()) {
      setError('Vui lòng chỉ định người tập hợp để hỗ trợ ekip');
      return;
    }

    onSubmit({
      sceneTitle: sceneTitle.trim(),
      subjectGroup: subjectGroup.trim() || 'Cô dâu chú rể & Khách',
      session: session.trim() || 'Tại sảnh tiệc',
      priority,
      gatheringLead: gatheringLead.trim(),
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150',
      'data-testid': 'add-edit-shot-modal',
    },
    h(
      'div',
      {
        className:
          'bg-surface rounded-xl shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]',
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
          h(Camera, { className: 'w-5 h-5 text-primary' }),
          h(
            'h2',
            { className: 'text-base font-semibold text-gray-900' },
            initialData ? 'Chỉnh sửa cảnh chụp' : 'Thêm cảnh chụp mới'
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
        // Title
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Tên cảnh chụp *'),
          h('input', {
            type: 'text',
            required: true,
            value: sceneTitle,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSceneTitle(e.target.value),
            placeholder: 'Ví dụ: First Look chú rể, Chụp hình họ hàng 2 bên...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // Subject Group & Session
        h(
          'div',
          { className: 'grid grid-cols-2 gap-4' },
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Nhóm người chụp'),
            h('input', {
              type: 'text',
              value: subjectGroup,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSubjectGroup(e.target.value),
              placeholder: 'Ví dụ: Cha mẹ hai bên, Phù dâu phù rể...',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          ),
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Thời điểm / Buổi chụp'),
            h('input', {
              type: 'text',
              value: session,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSession(e.target.value),
              placeholder: 'Ví dụ: Trước lễ cưới 10:30, Sau nghi lễ...',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          )
        ),
        // Priority & Gathering Lead
        h(
          'div',
          { className: 'grid grid-cols-2 gap-4' },
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Mức độ ưu tiên'),
            h(
              'select',
              {
                value: priority,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                  setPriority(e.target.value as ShotPriority),
                className:
                  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary bg-surface',
              },
              h('option', { value: 'must_have' }, 'Bắt buộc (Must-have)'),
              h('option', { value: 'nice_to_have' }, 'Nên có (Nice-to-have)')
            )
          ),
          h(
            'div',
            { className: 'space-y-1' },
            h(
              'label',
              { className: 'block text-xs font-semibold text-gray-700' },
              'Người tập hợp nhân sự *'
            ),
            h('input', {
              type: 'text',
              required: true,
              value: gatheringLead,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setGatheringLead(e.target.value),
              placeholder: 'Ví dụ: Phù dâu Mai, Bác Thành...',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          )
        ),
        // Notes
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Ghi chú góc máy / khoảnh khắc'),
          h('textarea', {
            rows: 2,
            value: notes,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value),
            placeholder: 'Góc chụp bắt cảm xúc, ánh sáng hoặc yêu cầu đặc biệt...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
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
            initialData ? 'Lưu thay đổi' : 'Thêm cảnh chụp'
          )
        )
      )
    )
  );
};
