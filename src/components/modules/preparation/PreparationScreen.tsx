'use client';

import * as React from 'react';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { useRole } from '@/context/RoleContext';
import {
  PreparationTab,
  PreparationItem,
  MusicTrack,
  PhotoShot,
} from './types';
import {
  INITIAL_PREPARATION_ITEMS,
  INITIAL_MUSIC_TRACKS,
  INITIAL_PHOTO_SHOTS,
} from './fixtures';
import { PreparationItemsTab } from './PreparationItemsTab';
import { MusicPlaylistTab } from './MusicPlaylistTab';
import { PhotoShotListTab } from './PhotoShotListTab';
import { LinkedIdeasTab } from './LinkedIdeasTab';
import { AddEditItemModal } from './AddEditItemModal';
import { AddEditTrackModal } from './AddEditTrackModal';
import { AddEditShotModal } from './AddEditShotModal';
import {
  PackageCheck,
  Music,
  Camera,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

const h = React.createElement;

export interface PreparationScreenProps {
  initialState?: PrototypeState;
  initialTab?: PreparationTab;
  initialItems?: PreparationItem[];
  initialTracks?: MusicTrack[];
  initialShots?: PhotoShot[];
  onTabChange?: (tab: PreparationTab) => void;
  className?: string;
}

export const PreparationScreen: React.FC<PreparationScreenProps> = ({
  initialState = 'populated',
  initialTab = 'items',
  initialItems = INITIAL_PREPARATION_ITEMS,
  initialTracks = INITIAL_MUSIC_TRACKS,
  initialShots = INITIAL_PHOTO_SHOTS,
  onTabChange,
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

  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [activeTab, setActiveTab] = React.useState<PreparationTab>(initialTab);
  const [items, setItems] = React.useState<PreparationItem[]>(initialItems);
  const [tracks, setTracks] = React.useState<MusicTrack[]>(initialTracks);
  const [shots, setShots] = React.useState<PhotoShot[]>(initialShots);

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<PreparationItem | null>(null);

  const [isTrackModalOpen, setIsTrackModalOpen] = React.useState(false);
  const [editingTrack, setEditingTrack] = React.useState<MusicTrack | null>(null);

  const [isShotModalOpen, setIsShotModalOpen] = React.useState(false);
  const [editingShot, setEditingShot] = React.useState<PhotoShot | null>(null);

  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSelectTab = (tab: PreparationTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Item handlers
  const handleSaveItem = (data: Omit<PreparationItem, 'id' | 'version' | 'createdAt'>) => {
    if (!canMutate) return;
    if (editingItem) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id
            ? { ...i, ...data, version: (i.version || 1) + 1 }
            : i
        )
      );
      showToast('Đã cập nhật đồ dùng chuẩn bị');
    } else {
      const newItem: PreparationItem = {
        id: `item_${Date.now()}`,
        ...data,
        version: 1,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [newItem, ...prev]);
      showToast('Đã thêm đồ dùng cần chuẩn bị');
    }
    setEditingItem(null);
  };

  const handleDeleteItem = (id: string) => {
    if (!canMutate) return;
    if (confirm('Bạn có chắc chắn muốn xóa đồ dùng này không?')) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      showToast('Đã xóa đồ dùng');
    }
  };

  // Track handlers
  const handleSaveTrack = (data: Omit<MusicTrack, 'id' | 'orderIndex' | 'version'>) => {
    if (!canMutate) return;
    if (editingTrack) {
      setTracks((prev) =>
        prev.map((t) =>
          t.id === editingTrack.id
            ? { ...t, ...data, version: (t.version || 1) + 1 }
            : t
        )
      );
      showToast('Đã cập nhật bài hát');
    } else {
      const newTrack: MusicTrack = {
        id: `track_${Date.now()}`,
        orderIndex: tracks.length + 1,
        ...data,
        version: 1,
      };
      setTracks((prev) => [...prev, newTrack]);
      showToast('Đã thêm bài hát vào danh sách phát');
    }
    setEditingTrack(null);
  };

  const handleDeleteTrack = (id: string) => {
    if (!canMutate) return;
    if (confirm('Bạn có chắc muốn xóa bài hát này khỏi danh sách?')) {
      setTracks((prev) => prev.filter((t) => t.id !== id));
      showToast('Đã xóa bài hát');
    }
  };

  // Shot handlers
  const handleSaveShot = (data: Omit<PhotoShot, 'id' | 'completed' | 'version'>) => {
    if (!canMutate) return;
    if (editingShot) {
      setShots((prev) =>
        prev.map((s) =>
          s.id === editingShot.id
            ? { ...s, ...data, version: (s.version || 1) + 1 }
            : s
        )
      );
      showToast('Đã cập nhật cảnh chụp');
    } else {
      const newShot: PhotoShot = {
        id: `shot_${Date.now()}`,
        completed: false,
        ...data,
        version: 1,
      };
      setShots((prev) => [...prev, newShot]);
      showToast('Đã thêm cảnh chụp mới');
    }
    setEditingShot(null);
  };

  const handleDeleteShot = (id: string) => {
    if (!canMutate) return;
    if (confirm('Bạn có chắc muốn xóa cảnh chụp này?')) {
      setShots((prev) => prev.filter((s) => s.id !== id));
      showToast('Đã xóa cảnh chụp');
    }
  };

  const TABS_CONFIG: {
    key: PreparationTab;
    label: string;
    icon: any;
    count: number;
  }[] = [
    { key: 'items', label: 'Đồ dùng cần chuẩn bị', icon: PackageCheck, count: items.length },
    { key: 'music', label: 'Nhạc & Khoảnh khắc', icon: Music, count: tracks.length },
    { key: 'shots', label: 'Cảnh chụp & Quay phim', icon: Camera, count: shots.length },
    { key: 'linked-ideas', label: 'Ý tưởng liên kết', icon: Sparkles, count: 3 },
  ];

  return h(
    StateWrapper,
    {
      state,
      emptyDescription: 'Chưa có thông tin chuẩn bị đám cưới.',
      onRetry: () => setState('populated'),
    },
    h(
      'div',
      { className: `space-y-6 ${className}` },
      // Toast message
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
      // 4 Main Tabs Navigation
      h(
        'div',
        { className: 'border-b border-gray-200' },
        h(
          'nav',
          { className: '-mb-px flex space-x-2 sm:space-x-6 overflow-x-auto pb-1' },
          TABS_CONFIG.map((tab) => {
            const isActive = activeTab === tab.key;
            const TabIcon = tab.icon;

            return h(
              'button',
              {
                key: tab.key,
                type: 'button',
                onClick: () => handleSelectTab(tab.key),
                className: `inline-flex items-center gap-2 py-3 px-3 border-b-2 font-medium text-xs sm:text-sm transition shrink-0 ${
                  isActive
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`,
                'data-testid': `tab-button-${tab.key}`,
              },
              h(TabIcon, { className: 'w-4 h-4' }),
              tab.label,
              h(
                'span',
                {
                  className: `ml-1 py-0.5 px-2 rounded-full text-[11px] font-bold ${
                    isActive ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'
                  }`,
                },
                tab.count
              )
            );
          })
        )
      ),
      // Tab Content
      activeTab === 'items' &&
        h(PreparationItemsTab, {
          items,
          onUpdateItem: (updated) =>
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i))),
          onDeleteItem: handleDeleteItem,
          onAddNew: () => {
            setEditingItem(null);
            setIsItemModalOpen(true);
          },
          onEditItem: (item) => {
            setEditingItem(item);
            setIsItemModalOpen(true);
          },
        }),
      activeTab === 'music' &&
        h(MusicPlaylistTab, {
          tracks,
          onUpdateTracks: (newTracks) => setTracks(newTracks),
          onAddNew: () => {
            setEditingTrack(null);
            setIsTrackModalOpen(true);
          },
          onEditTrack: (track) => {
            setEditingTrack(track);
            setIsTrackModalOpen(true);
          },
          onDeleteTrack: handleDeleteTrack,
        }),
      activeTab === 'shots' &&
        h(PhotoShotListTab, {
          shots,
          onUpdateShot: (updated) =>
            setShots((prev) => prev.map((s) => (s.id === updated.id ? updated : s))),
          onAddNew: () => {
            setEditingShot(null);
            setIsShotModalOpen(true);
          },
          onEditShot: (shot) => {
            setEditingShot(shot);
            setIsShotModalOpen(true);
          },
          onDeleteShot: handleDeleteShot,
        }),
      activeTab === 'linked-ideas' && h(LinkedIdeasTab, {}),
      // Modals
      h(AddEditItemModal, {
        isOpen: isItemModalOpen,
        onClose: () => {
          setIsItemModalOpen(false);
          setEditingItem(null);
        },
        onSubmit: handleSaveItem,
        initialData: editingItem,
      }),
      h(AddEditTrackModal, {
        isOpen: isTrackModalOpen,
        onClose: () => {
          setIsTrackModalOpen(false);
          setEditingTrack(null);
        },
        onSubmit: handleSaveTrack,
        initialData: editingTrack,
      }),
      h(AddEditShotModal, {
        isOpen: isShotModalOpen,
        onClose: () => {
          setIsShotModalOpen(false);
          setEditingShot(null);
        },
        onSubmit: handleSaveShot,
        initialData: editingShot,
      })
    )
  );
};
