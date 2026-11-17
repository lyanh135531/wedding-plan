'use client';

import * as React from 'react';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { useRole } from '@/context/RoleContext';
import { IdeaItem, IdeaCategory, IdeaStatus, IdeaFormData } from './types';
import { INITIAL_IDEAS } from './fixtures';
import { IdeaCard } from './IdeaCard';
import { AddEditIdeaModal } from './AddEditIdeaModal';
import {
  CreateTaskOrCostPreviewModal,
  TaskOrCostPreviewResult,
} from './CreateTaskOrCostPreviewModal';
import {
  Lightbulb,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  HelpCircle,
  XCircle,
} from 'lucide-react';

const h = React.createElement;

export interface IdeasScreenProps {
  initialState?: PrototypeState;
  initialIdeas?: IdeaItem[];
  onIdeasChange?: (ideas: IdeaItem[]) => void;
  className?: string;
}

export const IdeasScreen: React.FC<IdeasScreenProps> = ({
  initialState = 'populated',
  initialIdeas = INITIAL_IDEAS,
  onIdeasChange,
  className = '',
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default in isolation
  }
  const { isOwner, isFamily, canMutate } = roleContext;

  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [ideas, setIdeas] = React.useState<IdeaItem[]>(initialIdeas);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = React.useState(false);
  const [editingIdea, setEditingIdea] = React.useState<IdeaItem | null>(null);
  const [previewingIdea, setPreviewingIdea] = React.useState<IdeaItem | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const updateIdeas = (newIdeas: IdeaItem[]) => {
    setIdeas(newIdeas);
    onIdeasChange?.(newIdeas);
  };

  // Status Cycle: reference -> considering -> decided -> discarded -> reference
  const handleCycleStatus = (id: string) => {
    if (!canMutate) return;
    const cycleMap: Record<IdeaStatus, IdeaStatus> = {
      reference: 'considering',
      considering: 'decided',
      decided: 'discarded',
      discarded: 'reference',
    };
    const next = ideas.map((idea) => {
      if (idea.id === id) {
        const nextStatus = cycleMap[idea.status];
        return { ...idea, status: nextStatus, updatedAt: new Date().toISOString() };
      }
      return idea;
    });
    updateIdeas(next);
  };

  const handleEdit = (idea: IdeaItem) => {
    if (!canMutate) return;
    setEditingIdea(idea);
    setIsAddEditOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!canMutate) return;
    if (confirm('Bạn có chắc chắn muốn xóa ý tưởng này không?')) {
      const next = ideas.filter((idea) => idea.id !== id);
      updateIdeas(next);
      showToast('Đã xóa ý tưởng thành công');
    }
  };

  const handleSaveIdea = (formData: IdeaFormData) => {
    if (!canMutate) return;
    if (editingIdea) {
      const next = ideas.map((item) =>
        item.id === editingIdea.id
          ? {
              ...item,
              ...formData,
              updatedAt: new Date().toISOString(),
              version: (item.version || 1) + 1,
            }
          : item
      );
      updateIdeas(next);
      showToast('Đã cập nhật ý tưởng');
    } else {
      const newItem: IdeaItem = {
        id: `idea_${Date.now()}`,
        ...formData,
        isShared: true,
        version: 1,
        createdAt: new Date().toISOString(),
      };
      updateIdeas([newItem, ...ideas]);
      showToast('Đã thêm ý tưởng mới');
    }
    setEditingIdea(null);
  };

  const handleCreateTaskOrCost = (idea: IdeaItem) => {
    if (!canMutate) return;
    setPreviewingIdea(idea);
  };

  const handleConfirmTaskOrCost = (result: TaskOrCostPreviewResult) => {
    showToast(
      `Đã tạo ${
        result.createType === 'cost'
          ? 'khoản chi'
          : result.createType === 'task'
          ? 'công việc'
          : 'công việc & khoản chi'
      } liên kết nguồn thành công!`
    );
  };

  // Filter ideas
  const filteredIdeas = ideas.filter((idea) => {
    // If family role, only show shared ideas
    if (isFamily && idea.isShared === false) return false;

    if (categoryFilter !== 'all' && idea.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && idea.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = idea.title.toLowerCase().includes(q);
      const matchNotes = (idea.notes || '').toLowerCase().includes(q);
      const matchVendor = (idea.linkedVendorName || '').toLowerCase().includes(q);
      if (!matchTitle && !matchNotes && !matchVendor) return false;
    }
    return true;
  });

  // Counters
  const decidedCount = ideas.filter((i) => i.status === 'decided').length;
  const consideringCount = ideas.filter((i) => i.status === 'considering').length;
  const referenceCount = ideas.filter((i) => i.status === 'reference').length;
  const discardedCount = ideas.filter((i) => i.status === 'discarded').length;

  return h(
    StateWrapper,
    {
      state,
      emptyDescription: 'Chưa có ý tưởng nào trong sổ tay.',
      onRetry: () => setState('populated'),
    },
    h(
      'div',
      { className: `space-y-6 ${className}` },
      // Toast notification
      toastMessage &&
        h(
          'div',
          {
            className:
              'fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg bg-gray-900 text-white text-xs font-medium shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2',
          },
          h(CheckCircle2, { className: 'w-4 h-4 text-emerald-400' }),
          toastMessage
        ),
      // Stats Ribbon
      h(
        'div',
        { className: 'grid grid-cols-2 sm:grid-cols-4 gap-3' },
        h(
          'div',
          { className: 'p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-3' },
          h(CheckCircle2, { className: 'w-6 h-6 text-emerald-600 shrink-0' }),
          h(
            'div',
            {},
            h('div', { className: 'text-lg font-bold text-emerald-900 leading-none' }, decidedCount),
            h('div', { className: 'text-xs text-emerald-700 mt-1 font-medium' }, 'Đã chốt ý tưởng')
          )
        ),
        h(
          'div',
          { className: 'p-3.5 rounded-xl bg-amber-50 border border-amber-100 flex items-center gap-3' },
          h(Clock, { className: 'w-6 h-6 text-amber-600 shrink-0' }),
          h(
            'div',
            {},
            h('div', { className: 'text-lg font-bold text-amber-900 leading-none' }, consideringCount),
            h('div', { className: 'text-xs text-amber-700 mt-1 font-medium' }, 'Đang cân nhắc')
          )
        ),
        h(
          'div',
          { className: 'p-3.5 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-3' },
          h(HelpCircle, { className: 'w-6 h-6 text-blue-600 shrink-0' }),
          h(
            'div',
            {},
            h('div', { className: 'text-lg font-bold text-blue-900 leading-none' }, referenceCount),
            h('div', { className: 'text-xs text-blue-700 mt-1 font-medium' }, 'Tham khảo')
          )
        ),
        h(
          'div',
          { className: 'p-3.5 rounded-xl bg-gray-100 border border-gray-200 flex items-center gap-3' },
          h(XCircle, { className: 'w-6 h-6 text-gray-500 shrink-0' }),
          h(
            'div',
            {},
            h('div', { className: 'text-lg font-bold text-gray-800 leading-none' }, discardedCount),
            h('div', { className: 'text-xs text-gray-600 mt-1 font-medium' }, 'Đã bỏ qua')
          )
        )
      ),
      // Controls & Filter Header
      h(
        'div',
        {
          className:
            'flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-2xs',
        },
        // Search & Filters
        h(
          'div',
          { className: 'flex flex-wrap items-center gap-2.5 flex-1' },
          h(
            'div',
            { className: 'relative min-w-[200px] flex-1 max-w-xs' },
            h(Search, {
              className:
                'w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none',
            }),
            h('input', {
              type: 'text',
              value: searchQuery,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value),
              placeholder: 'Tìm kiếm ý tưởng, ghi chú...',
              className:
                'w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          ),
          // Category select
          h(
            'select',
            {
              value: categoryFilter,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                setCategoryFilter(e.target.value),
              className:
                'px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-700',
            },
            h('option', { value: 'all' }, 'Tất cả phân loại'),
            h('option', { value: 'style' }, 'Phong cách'),
            h('option', { value: 'decor' }, 'Trang trí'),
            h('option', { value: 'attire' }, 'Trang phục'),
            h('option', { value: 'other' }, 'Khác')
          ),
          // Status select
          h(
            'select',
            {
              value: statusFilter,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                setStatusFilter(e.target.value),
              className:
                'px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-700',
            },
            h('option', { value: 'all' }, 'Tất cả trạng thái'),
            h('option', { value: 'decided' }, 'Đã chốt'),
            h('option', { value: 'considering' }, 'Cân nhắc'),
            h('option', { value: 'reference' }, 'Tham khảo'),
            h('option', { value: 'discarded' }, 'Đã bỏ')
          )
        ),
        // Add Button (owner only)
        canMutate &&
          h(
            'button',
            {
              type: 'button',
              onClick: () => {
                setEditingIdea(null);
                setIsAddEditOpen(true);
              },
              className:
                'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition shadow-xs shrink-0',
            },
            h(Plus, { className: 'w-4 h-4' }),
            'Thêm ý tưởng'
          )
      ),
      // Masonry / Grid Display: 1 col mobile, 2 col tablet, 3-4 col desktop
      filteredIdeas.length === 0
        ? h(
            'div',
            {
              className:
                'p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300',
            },
            h(Lightbulb, { className: 'w-10 h-10 text-gray-400 mx-auto mb-2' }),
            h(
              'h3',
              { className: 'text-sm font-semibold text-gray-700' },
              'Không tìm thấy ý tưởng phù hợp'
            ),
            h(
              'p',
              { className: 'text-xs text-gray-500 mt-1' },
              'Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm của bạn.'
            )
          )
        : h(
            'div',
            {
              className:
                'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5',
            },
            filteredIdeas.map((idea) =>
              h(IdeaCard, {
                key: idea.id,
                idea,
                onCycleStatus: handleCycleStatus,
                onEdit: handleEdit,
                onDelete: handleDelete,
                onCreateTaskOrCost: handleCreateTaskOrCost,
              })
            )
          ),
      // Modals
      h(AddEditIdeaModal, {
        isOpen: isAddEditOpen,
        onClose: () => {
          setIsAddEditOpen(false);
          setEditingIdea(null);
        },
        onSubmit: handleSaveIdea,
        initialData: editingIdea,
      }),
      h(CreateTaskOrCostPreviewModal, {
        isOpen: Boolean(previewingIdea),
        onClose: () => setPreviewingIdea(null),
        idea: previewingIdea,
        onConfirm: handleConfirmTaskOrCost,
      })
    )
  );
};
