import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import {
  PreparationScreen,
  PreparationItemsTab,
  MusicPlaylistTab,
  PhotoShotListTab,
  LinkedIdeasTab,
  AddEditItemModal,
  AddEditTrackModal,
  AddEditShotModal,
  PreparationItem,
  MusicTrack,
  PhotoShot,
} from '@/components/modules/preparation';

const h = React.createElement;

describe('S23: Preparation Screen & Tabs Unit Tests', () => {
  const mockItems: PreparationItem[] = [
    {
      id: 'item_01',
      title: 'Hộp nhẫn cưới & Khay nhẫn hoa tươi',
      quantity: 1,
      status: 'packed',
      keeper: 'Phù rể Thành',
      location: 'Cốp xe dâu',
      bringTime: '08:30 sáng',
      isRental: false,
      notes: 'Giữ cẩn thận',
      version: 1,
    },
    {
      id: 'item_02',
      title: 'Áo dài cưới lụa thêu rồng phượng (Đồ thuê)',
      quantity: 2,
      status: 'brought',
      keeper: 'Chị Mai',
      location: 'Phòng cô dâu',
      bringTime: '07:00 sáng',
      isRental: true,
      returnDueDate: '2026-11-22T17:00:00Z',
      notes: 'Thuê tại tiệm Cưới Xinh',
      version: 1,
    },
  ];

  const mockTracks: MusicTrack[] = [
    {
      id: 'track_01',
      title: 'Can’t Help Falling in Love',
      artist: 'Kina Grannis',
      moment: 'guest_arrival',
      orderIndex: 1,
      duration: '3:20',
      cueNotes: 'Bật nhẹ nhàng 40% lúc đón khách',
      isBlacklisted: false,
      externalUrl: 'https://open.spotify.com/track/123',
      version: 1,
    },
    {
      id: 'track_02',
      title: 'Em Gái Mưa (Nhạc chia tay)',
      artist: 'Hương Tràm',
      moment: 'ceremony',
      orderIndex: 2,
      duration: '4:20',
      cueNotes: 'Nhạc chia tay buồn bã',
      isBlacklisted: true,
      version: 1,
    },
  ];

  const mockShots: PhotoShot[] = [
    {
      id: 'shot_01',
      sceneTitle: 'Khoảnh khắc First Look của Chú rể',
      subjectGroup: 'Cô dâu & Chú rể',
      session: 'Trước giờ đón khách',
      priority: 'must_have',
      gatheringLead: 'Chị Mai',
      completed: true,
      handedOverAt: '2026-11-20T10:15:00Z',
      notes: 'Góc máy bắt nét phản ứng ánh mắt',
      version: 1,
    },
    {
      id: 'shot_02',
      sceneTitle: 'Đội phù dâu và phù rể vui đùa trước cổng hoa',
      subjectGroup: 'Dàn Phù dâu & Phù rể',
      session: 'Sau nghi lễ',
      priority: 'nice_to_have',
      gatheringLead: 'Tuấn',
      completed: false,
      notes: 'Tự nhiên, không gò bó',
      version: 1,
    },
  ];

  describe('Tab 1: Preparation Items & Rental Tracking', () => {
    it('renders all 4 status groups and rental badges with return warnings', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(PreparationItemsTab, {
            items: mockItems,
            onUpdateItem: () => {},
            onDeleteItem: () => {},
            onAddNew: () => {},
            onEditItem: () => {},
          })
        )
      );

      // 4 status groups
      expect(html).toContain('Chưa chuẩn bị');
      expect(html).toContain('Đã đóng gói');
      expect(html).toContain('Đã mang tới nơi');
      expect(html).toContain('Chờ nhận lại / Đã hoàn trả');

      // Rental badge and return due date warning
      expect(html).toContain('Đồ thuê');
      expect(html).toContain('Hạn trả:');
      expect(html).toContain('Xem trong checklist hậu cưới');

      // Stepper buttons for owner
      expect(html).toContain('title="Giảm số lượng"');
      expect(html).toContain('title="Tăng số lượng"');
    });

    it('hides mutation controls for family_view role in Items tab', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'family_view' },
          h(PreparationItemsTab, {
            items: mockItems,
            onUpdateItem: () => {},
            onDeleteItem: () => {},
            onAddNew: () => {},
            onEditItem: () => {},
          })
        )
      );

      expect(html).not.toContain('Thêm đồ cần chuẩn bị');
      expect(html).not.toContain('title="Giảm số lượng"');
      expect(html).not.toContain('title="Xóa đồ dùng"');
    });
  });

  describe('Tab 2: Music Playlist, Moments & Cues', () => {
    it('renders playlist order, cue notes, streaming links and DO NOT PLAY badge', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(MusicPlaylistTab, {
            tracks: mockTracks,
            onUpdateTracks: () => {},
            onAddNew: () => {},
            onEditTrack: () => {},
            onDeleteTrack: () => {},
          })
        )
      );

      // Track titles
      expect(html).toContain('Can’t Help Falling in Love');
      expect(html).toContain('Em Gái Mưa (Nhạc chia tay)');

      // Cue timing notes
      expect(html).toContain('Bật nhẹ nhàng 40% lúc đón khách');

      // Blacklist / Do not play badge
      expect(html).toContain('CỜ KHÔNG PHÁT / DO NOT PLAY');

      // External streaming link
      expect(html).toContain('href="https://open.spotify.com/track/123"');
      expect(html).toContain('Nghe thử');

      // Notice that audio files are not uploaded
      expect(html).toContain('Quy chuẩn phát nhạc');
      expect(html).toContain('không lưu hoặc tải file audio');
    });
  });

  describe('Tab 3: Photo Shot List, Photographer View & Handover', () => {
    it('renders photo scenes with priority badges, gathering leads and handover recording', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(PhotoShotListTab, {
            shots: mockShots,
            onUpdateShot: () => {},
            onAddNew: () => {},
            onEditShot: () => {},
            onDeleteShot: () => {},
          })
        )
      );

      expect(html).toContain('Khoảnh khắc First Look của Chú rể');
      expect(html).toContain('Bắt buộc');
      expect(html).toContain('Nên có');
      expect(html).toContain('Người tập hợp: Chị Mai');
      expect(html).toContain('Đã bàn giao ekip lúc:');
      expect(html).toContain('Chế độ Ekip chụp (Photographer View)');
      expect(html).toContain('In A4 Shot List');
    });
  });

  describe('Tab 4: Linked Ideas Tab', () => {
    it('renders ideas references linking to S22 without data duplication', () => {
      const html = renderToStaticMarkup(
        h(LinkedIdeasTab, {})
      );

      expect(html).toContain('Ý tưởng &amp; Cảm hứng liên kết chuẩn bị (S22 → S23)');
      expect(html).toContain('không nhân bản dữ liệu');
      expect(html).toContain('Mở trang Ý tưởng');
      expect(html).toContain('Phong cách Botanical Minimalist');
    });
  });

  describe('Full PreparationScreen & Modals', () => {
    it('renders active tab buttons and header metrics', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(PreparationScreen, {
            initialState: 'populated',
            initialTab: 'items',
            initialItems: mockItems,
            initialTracks: mockTracks,
            initialShots: mockShots,
          })
        )
      );

      expect(html).toContain('Đồ dùng cần chuẩn bị');
      expect(html).toContain('Nhạc &amp; Khoảnh khắc');
      expect(html).toContain('Cảnh chụp &amp; Quay phim');
      expect(html).toContain('Ý tưởng liên kết');
    });

    it('renders AddEditItemModal when open', () => {
      const html = renderToStaticMarkup(
        h(AddEditItemModal, {
          isOpen: true,
          onClose: () => {},
          onSubmit: () => {},
          initialData: mockItems[0],
        })
      );

      expect(html).toContain('Chỉnh sửa đồ dùng chuẩn bị');
      expect(html).toContain('Hộp nhẫn cưới &amp; Khay nhẫn hoa tươi');
      expect(html).toContain('Đây là đồ đi thuê / mượn');
    });

    it('renders AddEditTrackModal when open', () => {
      const html = renderToStaticMarkup(
        h(AddEditTrackModal, {
          isOpen: true,
          onClose: () => {},
          onSubmit: () => {},
          initialData: mockTracks[0],
        })
      );

      expect(html).toContain('Chỉnh sửa bài hát');
      expect(html).toContain('Can’t Help Falling in Love');
      expect(html).toContain('Ghi chú vào nhạc');
      expect(html).toContain('Đánh dấu CỜ KHÔNG PHÁT');
    });

    it('renders AddEditShotModal when open', () => {
      const html = renderToStaticMarkup(
        h(AddEditShotModal, {
          isOpen: true,
          onClose: () => {},
          onSubmit: () => {},
          initialData: mockShots[0],
        })
      );

      expect(html).toContain('Chỉnh sửa cảnh chụp');
      expect(html).toContain('Khoảnh khắc First Look của Chú rể');
      expect(html).toContain('Người tập hợp nhân sự *');
    });
  });
});
