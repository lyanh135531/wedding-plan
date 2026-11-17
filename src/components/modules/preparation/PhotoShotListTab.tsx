'use client';

import * as React from 'react';
import { PhotoShot, ShotPriority } from './types';
import { useRole } from '@/context/RoleContext';
import {
  Camera,
  Printer,
  CheckCircle2,
  Circle,
  AlertCircle,
  UserCheck,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Check,
} from 'lucide-react';

const h = React.createElement;

export interface PhotoShotListTabProps {
  shots: PhotoShot[];
  onUpdateShot: (shot: PhotoShot) => void;
  onAddNew: () => void;
  onEditShot: (shot: PhotoShot) => void;
  onDeleteShot: (id: string) => void;
  className?: string;
}

export const PhotoShotListTab: React.FC<PhotoShotListTabProps> = ({
  shots,
  onUpdateShot,
  onAddNew,
  onEditShot,
  onDeleteShot,
  className = '',
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default in isolation
  }
  const { canMutate } = roleContext;

  const [photographerMode, setPhotographerMode] = React.useState(false);
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [sessionFilter, setSessionFilter] = React.useState<string>('all');

  const filteredShots = shots.filter((s) => {
    if (priorityFilter !== 'all' && s.priority !== priorityFilter) return false;
    if (sessionFilter !== 'all' && s.session !== sessionFilter) return false;
    return true;
  });

  const handleToggleComplete = (shot: PhotoShot) => {
    if (!canMutate) return;
    onUpdateShot({
      ...shot,
      completed: !shot.completed,
      version: (shot.version || 1) + 1,
    });
  };

  const handleRecordHandover = (shot: PhotoShot) => {
    if (!canMutate) return;
    const now = new Date().toISOString();
    onUpdateShot({
      ...shot,
      handedOverAt: now,
      version: (shot.version || 1) + 1,
    });
  };

  const handlePrintA4 = () => {
    window.print();
  };

  const completedCount = shots.filter((s) => s.completed).length;
  const mustHaveCount = shots.filter((s) => s.priority === 'must_have').length;

  return h(
    'div',
    { className: `space-y-6 ${className}` },
    // Controls & Actions Bar (hidden when printing)
    h(
      'div',
      {
        className:
          'flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-2xs print:hidden',
      },
      // Left filters
      h(
        'div',
        { className: 'flex flex-wrap items-center gap-3' },
        // Priority filter
        h(
          'select',
          {
            value: priorityFilter,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              setPriorityFilter(e.target.value),
            className:
              'px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-700',
          },
          h('option', { value: 'all' }, 'Tất cả mức ưu tiên'),
          h('option', { value: 'must_have' }, 'Bắt buộc (Must-have)'),
          h('option', { value: 'nice_to_have' }, 'Nên có (Nice-to-have)')
        ),
        // Photographer View Toggle
        h(
          'button',
          {
            type: 'button',
            onClick: () => setPhotographerMode(!photographerMode),
            className: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              photographerMode
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`,
          },
          h(Eye, { className: 'w-3.5 h-3.5' }),
          photographerMode ? 'Đang bật chế độ Ekip' : 'Chế độ Ekip chụp (Photographer View)'
        ),
        // A4 Print View Button
        h(
          'button',
          {
            type: 'button',
            onClick: handlePrintA4,
            className:
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition',
          },
          h(Printer, { className: 'w-3.5 h-3.5' }),
          'In A4 Shot List'
        )
      ),
      // Right action
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h(
          'span',
          { className: 'text-xs text-gray-500' },
          `Đã chụp: ${completedCount}/${shots.length} (${mustHaveCount} cảnh bắt buộc)`
        ),
        canMutate &&
          h(
            'button',
            {
              type: 'button',
              onClick: onAddNew,
              className:
                'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition shadow-xs',
            },
            h(Plus, { className: 'w-4 h-4' }),
            'Thêm cảnh chụp'
          )
      )
    ),
    // Photographer View Banner (if active)
    photographerMode &&
      h(
        'div',
        {
          className:
            'p-3 bg-gray-900 text-white rounded-xl flex items-center justify-between text-xs',
        },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(Camera, { className: 'w-4 h-4 text-emerald-400' }),
          h(
            'span',
            { className: 'font-semibold' },
            'Chế độ Ekip chụp: Giao diện độ tương phản cao, tối ưu hiển thị nhanh ngoài hiện trường.'
          )
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: () => setPhotographerMode(false),
            className: 'text-gray-300 hover:text-white underline text-xs',
          },
          'Thoát'
        )
      ),
    // Print-Only Header
    h(
      'div',
      { className: 'hidden print:block pb-4 mb-4 border-b border-gray-300' },
      h(
        'h1',
        { className: 'text-xl font-bold text-gray-900' },
        'DANH SÁCH CẢNH CHỤP ẢNH & QUAY PHIM NGÀY CƯỚI (PHOTO SHOT LIST)'
      ),
      h(
        'p',
        { className: 'text-xs text-gray-600 mt-1' },
        `Bản in ngày: ${new Date().toLocaleDateString('vi-VN')} | Tổng số cảnh: ${shots.length} | Cảnh bắt buộc: ${mustHaveCount}`
      )
    ),
    // Shot list cards / items
    filteredShots.length === 0
      ? h(
          'div',
          {
            className:
              'p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300',
          },
          h(Camera, { className: 'w-10 h-10 text-gray-400 mx-auto mb-2' }),
          h(
            'h3',
            { className: 'text-sm font-semibold text-gray-700' },
            'Chưa có cảnh chụp nào'
          ),
          h(
            'p',
            { className: 'text-xs text-gray-500 mt-1' },
            'Thêm danh sách cảnh chụp để ekip nắm bắt góc máy và người tập hợp.'
          )
        )
      : h(
          'div',
          { className: 'space-y-3' },
          filteredShots.map((shot) =>
            h(
              'div',
              {
                key: shot.id,
                className: `p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  photographerMode
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : shot.completed
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-white border-gray-200 shadow-2xs'
                }`,
                'data-testid': `photo-shot-${shot.id}`,
              },
              // Left: checkbox & details
              h(
                'div',
                { className: 'flex items-start gap-3.5 flex-1' },
                // Complete toggle
                canMutate
                  ? h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => handleToggleComplete(shot),
                        className:
                          'mt-0.5 p-1 text-gray-400 hover:text-emerald-600 transition print:hidden',
                        title: shot.completed ? 'Đánh dấu chưa chụp' : 'Đánh dấu đã chụp xong',
                      },
                      shot.completed
                        ? h(CheckCircle2, { className: 'w-5 h-5 text-emerald-600' })
                        : h(Circle, { className: 'w-5 h-5 text-gray-300' })
                    )
                  : h(
                      'div',
                      { className: 'mt-0.5 p-1' },
                      shot.completed
                        ? h(CheckCircle2, { className: 'w-5 h-5 text-emerald-600' })
                        : h(Circle, { className: 'w-5 h-5 text-gray-300' })
                    ),
                // Content info
                h(
                  'div',
                  { className: 'space-y-1.5 flex-1' },
                  h(
                    'div',
                    { className: 'flex items-center gap-2 flex-wrap' },
                    h(
                      'h4',
                      {
                        className: `font-semibold text-sm ${
                          photographerMode
                            ? 'text-white'
                            : shot.completed
                            ? 'line-through text-gray-500'
                            : 'text-gray-900'
                        }`,
                      },
                      shot.sceneTitle
                    ),
                    // Priority Badge
                    shot.priority === 'must_have'
                      ? h(
                          'span',
                          {
                            className:
                              'px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300',
                          },
                          'Bắt buộc'
                        )
                      : h(
                          'span',
                          {
                            className:
                              'px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200',
                          },
                          'Nên có'
                        )
                  ),
                  // Group, Session & Gathering lead
                  h(
                    'div',
                    {
                      className: `flex flex-wrap items-center gap-3 text-xs ${
                        photographerMode ? 'text-gray-300' : 'text-gray-600'
                      }`,
                    },
                    h(
                      'span',
                      { className: 'font-medium' },
                      `Nhóm: ${shot.subjectGroup}`
                    ),
                    h('span', {}, '•'),
                    h('span', {}, `Thời điểm: ${shot.session}`),
                    h('span', {}, '•'),
                    h(
                      'div',
                      { className: 'flex items-center gap-1 font-semibold text-primary' },
                      h(UserCheck, { className: 'w-3.5 h-3.5' }),
                      `Người tập hợp: ${shot.gatheringLead}`
                    )
                  ),
                  // Notes
                  shot.notes &&
                    h(
                      'p',
                      {
                        className: `text-xs ${
                          photographerMode ? 'text-gray-400' : 'text-gray-500'
                        }`,
                      },
                      shot.notes
                    ),
                  // Handover timestamp indicator
                  shot.handedOverAt &&
                    h(
                      'div',
                      {
                        className: `inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono ${
                          photographerMode
                            ? 'bg-gray-700 text-emerald-400'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`,
                      },
                      h(Clock, { className: 'w-3 h-3 text-emerald-600' }),
                      `Đã bàn giao ekip lúc: ${new Date(shot.handedOverAt).toLocaleString('vi-VN')}`
                    )
                )
              ),
              // Right: Handover button & actions (hidden when printing)
              h(
                'div',
                { className: 'flex items-center gap-2 self-end md:self-center shrink-0 print:hidden' },
                canMutate &&
                  !shot.handedOverAt &&
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => handleRecordHandover(shot),
                      className:
                        'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition font-medium',
                      title: 'Ghi nhận thời điểm đã bàn giao cảnh này cho ekip chụp',
                    },
                    h(Check, { className: 'w-3.5 h-3.5 text-emerald-600' }),
                    'Ghi nhận đã bàn giao'
                  ),
                canMutate &&
                  h(
                    'div',
                    { className: 'flex items-center gap-1 pl-2 border-l border-gray-200' },
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => onEditShot(shot),
                        className:
                          'p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition',
                        title: 'Sửa cảnh chụp',
                      },
                      h(Edit2, { className: 'w-3.5 h-3.5' })
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => onDeleteShot(shot.id),
                        className:
                          'p-1.5 text-red-400 hover:text-red-700 rounded-lg hover:bg-red-50 transition',
                        title: 'Xóa cảnh chụp',
                      },
                      h(Trash2, { className: 'w-3.5 h-3.5' })
                    )
                  )
              )
            )
          )
        )
  );
};
