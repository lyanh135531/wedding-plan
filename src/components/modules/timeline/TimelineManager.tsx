'use client';

import * as React from 'react';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { Button } from '@/components/ui/button';
import { Clock, Play, CheckCircle2, AlertTriangle, ArrowRight, FastForward } from 'lucide-react';

const h = React.createElement;

export interface TimelineMilestone {
  id: string;
  timeRange: string;
  scheduledStart: string;
  actualStart?: string;
  title: string;
  location: string;
  personInCharge: string;
  status: 'completed' | 'in_progress' | 'delayed' | 'upcoming';
  delayMinutes?: number;
}

export const INITIAL_TIMELINE: TimelineMilestone[] = [
  {
    id: 'tl-1',
    timeRange: '07:30 — 08:30',
    scheduledStart: '07:30',
    actualStart: '07:30',
    title: 'Chuẩn bị trang phục, make-up & xe hoa nhà trai',
    location: 'Tư gia Nhà Trai',
    personInCharge: 'Phụ rể & Đội xe',
    status: 'completed',
  },
  {
    id: 'tl-2',
    timeRange: '08:30 — 10:00',
    scheduledStart: '08:30',
    actualStart: '08:40',
    title: 'Lễ Gia Tiên & Trao Duyên tại Nhà Gái',
    location: 'Tư gia Nhà Gái (Q. Tân Bình)',
    personInCharge: 'Trưởng đoàn hai nhà & MC',
    status: 'in_progress',
  },
  {
    id: 'tl-3',
    timeRange: '10:30 — 11:30',
    scheduledStart: '10:30',
    title: 'Lễ Rước Dâu & Nhập Trạch Nhà Trai',
    location: 'Tư gia Nhà Trai',
    personInCharge: 'Mẹ chồng & Phù dâu',
    status: 'upcoming',
  },
  {
    id: 'tl-4',
    timeRange: '17:30 — 18:30',
    scheduledStart: '17:30',
    title: 'Đón khách & Chụp ảnh tại Backdrop sảnh tiệc',
    location: 'Sảnh Grand Ballroom - White Palace',
    personInCharge: 'Cô dâu, Chú rể & Ban lễ tân',
    status: 'upcoming',
  },
  {
    id: 'tl-5',
    timeRange: '18:45 — 20:30',
    scheduledStart: '18:45',
    title: 'Nghi thức khai tiệc, cắt bánh & chúc rượu',
    location: 'Sân khấu chính',
    personInCharge: 'MC & Ban nhạc',
    status: 'upcoming',
  },
];

export interface TimelineManagerProps {
  initialState?: PrototypeState;
}

export const TimelineManager: React.FC<TimelineManagerProps> = ({
  initialState = 'populated',
}) => {
  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [timeline, setTimeline] = React.useState<TimelineMilestone[]>(INITIAL_TIMELINE);
  const [delayShiftMinutes, setDelayShiftMinutes] = React.useState(15);
  const [isShiftModalOpen, setIsShiftModalOpen] = React.useState(false);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const activeMilestone = timeline.find((m) => m.status === 'in_progress');
  const nextMilestone = timeline.find((m) => m.status === 'upcoming');

  const handleApplyShift = () => {
    setTimeline((prev) =>
      prev.map((m) =>
        m.status === 'upcoming'
          ? {
              ...m,
              delayMinutes: delayShiftMinutes,
              timeRange: `${m.timeRange} (+${delayShiftMinutes}p)`,
            }
          : m
      )
    );
    setIsShiftModalOpen(false);
  };

  const loadingSkeleton = h(
    'div',
    { className: 'space-y-4 animate-pulse', role: 'status', 'aria-label': 'Đang tải lịch trình' },
    h('div', { className: 'h-28 bg-border-subtle rounded-card' }),
    h('div', { className: 'space-y-2' },
      [1, 2, 3, 4].map((i) => h('div', { key: i, className: 'h-20 bg-border-subtle rounded-control' }))
    )
  );

  return h(
    StateWrapper,
    {
      state,
      loadingSkeleton,
      emptyTitle: 'Chưa có lịch trình ngày cưới',
      emptyDescription: 'Tạo kịch bản mốc thời gian chi tiết cho ngày cưới chính thức.',
      emptyActionLabel: '+ Thêm mốc lịch trình',
      onEmptyAction: () => {
        setTimeline(INITIAL_TIMELINE);
        setState('populated');
      },
      errorTitle: 'Không thể tải lịch trình ngày cưới',
      errorMessage: 'Lỗi đồng bộ kịch bản ngày cưới từ máy chủ.',
      errorRequestId: 'REQ-20261106-TIMELINE-ERR',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không có sự kiện nào trong buổi này',
      filteredDescription: 'Hãy thử chọn buổi sáng hoặc buổi tối.',
      onClearFilter: () => setState('populated'),
      permissionDeniedMessage: 'Bạn không có quyền chỉnh sửa kịch bản ngày cưới.',
    },
    h(
      'div',
      { className: 'space-y-6 max-w-7xl mx-auto' },
      // Header
      h(
        'div',
        { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Lịch Trình Ngày Cưới (Live Timeline)'),
          h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Theo dõi thời gian thực các mốc nghi lễ và điều chỉnh dời giờ')
        ),
        h(
          Button,
          {
            variant: 'secondary',
            leftIcon: h(FastForward, { className: 'w-4 h-4' }),
            onClick: () => setIsShiftModalOpen(true),
          },
          'Điều chỉnh dời giờ'
        )
      ),

      // Top Highlights: "Đang diễn ra" & "Tiếp theo" (UXT15)
      h(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
        // Active Milestone Card
        activeMilestone &&
          h(
            'div',
            { className: 'p-4 bg-primary text-white rounded-card shadow-md space-y-2' },
            h(
              'div',
              { className: 'flex items-center justify-between' },
              h(
                'span',
                { className: 'text-xs uppercase font-bold tracking-wider bg-white/20 px-2 py-0.5 rounded' },
                '⚡ Đang diễn ra'
              ),
              h('span', { className: 'font-mono text-xs opacity-90' }, activeMilestone.timeRange)
            ),
            h('h2', { className: 'text-lg font-bold text-white' }, activeMilestone.title),
            h('p', { className: 'text-xs text-white/80' }, `📍 ${activeMilestone.location}`),
            h('p', { className: 'text-xs text-white/70' }, `Phụ trách: ${activeMilestone.personInCharge}`)
          ),

        // Next Milestone Card
        nextMilestone &&
          h(
            'div',
            { className: 'p-4 bg-surface border border-border-control rounded-card shadow-sm space-y-2' },
            h(
              'div',
              { className: 'flex items-center justify-between' },
              h(
                'span',
                { className: 'text-xs uppercase font-bold tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded' },
                '➡️ Tiếp theo'
              ),
              h('span', { className: 'font-mono text-xs text-text-muted' }, nextMilestone.timeRange)
            ),
            h('h2', { className: 'text-lg font-bold text-text-main' }, nextMilestone.title),
            h('p', { className: 'text-xs text-text-muted' }, `📍 ${nextMilestone.location}`),
            h('p', { className: 'text-xs text-text-muted' }, `Phụ trách: ${nextMilestone.personInCharge}`)
          )
      ),

      // Milestones timeline list
      h(
        'div',
        { className: 'bg-surface border border-border-subtle rounded-card shadow-sm p-4 sm:p-6 space-y-4' },
        h('h3', { className: 'text-xs font-semibold uppercase text-text-muted tracking-wider' }, 'Dòng thời gian ngày cưới'),
        h(
          'div',
          { className: 'space-y-3' },
          timeline.map((m) =>
            h(
              'div',
              {
                key: m.id,
                className: `p-3.5 rounded-control border flex items-start justify-between gap-3 ${
                  m.status === 'in_progress'
                    ? 'border-primary bg-primary/5'
                    : m.status === 'completed'
                    ? 'border-border-subtle bg-page/50 opacity-80'
                    : 'border-border-subtle bg-surface'
                }`,
              },
              h(
                'div',
                { className: 'flex items-start gap-3 min-w-0' },
                h(
                  'div',
                  { className: 'mt-0.5 shrink-0' },
                  m.status === 'completed'
                    ? h(CheckCircle2, { className: 'w-4 h-4 text-[#2E7D32]' })
                    : m.status === 'in_progress'
                    ? h(Play, { className: 'w-4 h-4 text-primary fill-primary' })
                    : h(Clock, { className: 'w-4 h-4 text-text-muted' })
                ),
                h(
                  'div',
                  { className: 'min-w-0' },
                  h('p', { className: 'font-semibold text-sm text-text-main truncate' }, m.title),
                  h('p', { className: 'text-xs text-text-muted mt-0.5' }, `📍 ${m.location} • ${m.personInCharge}`),
                  m.delayMinutes &&
                    h(
                      'span',
                      { className: 'inline-flex items-center gap-1 text-[11px] text-[#D97706] mt-1 font-medium' },
                      h(AlertTriangle, { className: 'w-3 h-3' }),
                      `Đã dời +${m.delayMinutes} phút`
                    )
                )
              ),
              h(
                'span',
                { className: 'font-mono text-xs font-semibold text-text-muted shrink-0' },
                m.timeRange
              )
            )
          )
        )
      ),

      // Shift Modal
      isShiftModalOpen &&
        h(
          'div',
          {
            className:
              'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm',
            role: 'dialog',
            'aria-modal': 'true',
          },
          h(
            'div',
            { className: 'bg-surface w-full max-w-sm rounded-card border border-border-control p-6 space-y-4' },
            h('h3', { className: 'text-base font-bold text-text-main' }, 'Dời giờ các mốc tiếp theo'),
            h(
              'p',
              { className: 'text-xs text-text-muted' },
              'Chọn số phút muốn tịnh tiến dời lịch cho toàn bộ các nghi lễ chưa bắt đầu.'
            ),
            h(
              'div',
              { className: 'grid grid-cols-3 gap-2' },
              [15, 30, 45].map((mins) =>
                h(
                  'button',
                  {
                    key: mins,
                    type: 'button',
                    onClick: () => setDelayShiftMinutes(mins),
                    className: `h-9 text-xs rounded border font-medium ${
                      delayShiftMinutes === mins
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface text-text-main border-border-control'
                    }`,
                  },
                  `+${mins} phút`
                )
              )
            ),
            h(
              'div',
              { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
              h(Button, { variant: 'secondary', onClick: () => setIsShiftModalOpen(false) }, 'Hủy'),
              h(Button, { variant: 'primary', onClick: handleApplyShift }, 'Áp dụng dời giờ')
            )
          )
        )
    )
  );
};
