import { ReadinessDomainItem, R2Snapshot, DeltaChange } from './types';

export const INITIAL_READINESS_DOMAINS: ReadinessDomainItem[] = [
  {
    id: 'guests',
    title: '1. Khách mời & Điểm danh',
    status: 'ready',
    score: 95,
    summary: '180 khách đã xác nhận tham dự (trên tổng 200 thiệp mời)',
    details: [
      { label: 'Xác nhận tham dự', value: '180 khách', isOk: true },
      { label: 'Chờ phản hồi', value: '15 khách', isOk: true },
      { label: 'Báo vắng', value: '5 khách', isOk: true },
    ],
    route: '/guests',
  },
  {
    id: 'budget',
    title: '2. Ngân sách & Hợp đồng',
    status: 'ready',
    score: 92,
    summary: 'Đã hoàn tất hợp đồng và đặt cọc 6/6 nhà cung cấp chính',
    details: [
      { label: 'Dự toán ngân sách', value: '350.000.000 đ', isOk: true },
      { label: 'Đã thanh toán / cọc', value: '280.000.000 đ', isOk: true },
      { label: 'Nghĩa vụ còn lại', value: '70.000.000 đ', isOk: true },
    ],
    route: '/budget',
  },
  {
    id: 'seating',
    title: '3. Sơ đồ bàn & Chỗ ngồi',
    status: 'ready',
    score: 100,
    summary: '18 bàn tiệc (180 chỗ) đã xếp kín và khớp chính xác 180 khách',
    details: [
      { label: 'Tổng số bàn đã đặt', value: '18 bàn tròn', isOk: true },
      { label: 'Ghế đã xếp khách', value: '180 / 180 chỗ', isOk: true },
      { label: 'Cân đối sức chứa', value: 'Khớp 100% (Không ghế thừa/thiếu)', isOk: true },
    ],
    route: '/seating',
  },
  {
    id: 'menus',
    title: '4. Thực đơn & Suất ăn',
    status: 'ready',
    score: 100,
    summary: '180 suất tiệc mặn tiêu chuẩn + 5 suất ăn chay riêng',
    details: [
      { label: 'Thực đơn chính', value: 'Menu Hoàng Gia 8 món', isOk: true },
      { label: 'Suất mặn chính', value: '180 suất', isOk: true },
      { label: 'Dị ứng & Suất chay', value: '5 suất chay thanh đạm', isOk: true },
    ],
    route: '/menus',
  },
  {
    id: 'logistics',
    title: '5. Lưu trú & Xe đón tiễn',
    status: 'ready',
    score: 95,
    summary: '10 phòng khách sạn Grand Plaza và 2 chuyến xe đưa đón sân bay',
    details: [
      { label: 'Phòng khách sạn', value: '10 phòng (22 khách)', isOk: true },
      { label: 'Chuyến xe đưa đón', value: '2 xe 29 chỗ', isOk: true },
      { label: 'Sức chứa xe', value: '45/58 khách (Đủ ghế)', isOk: true },
    ],
    route: '/logistics',
  },
  {
    id: 'preparation',
    title: '6. Đồ dùng chuẩn bị & Đồ thuê',
    status: 'ready',
    score: 100,
    summary: '5/5 nhóm đồ đã phân công người giữ; 2 đồ thuê có cảnh báo hạn trả',
    details: [
      { label: 'Đồ dùng cần thiết', value: '5 hạng mục', isOk: true },
      { label: 'Đồ thuê cần hoàn trả', value: '2 món (Áo dài, Khung ảnh)', isOk: true },
      { label: 'Đã đóng gói / mang tới', value: '100% sẵn sàng', isOk: true },
    ],
    route: '/preparation',
  },
  {
    id: 'program',
    title: '7. Nhạc nghi lễ & Cảnh quay chụp',
    status: 'ready',
    score: 96,
    summary: 'Playlist 7 khoảnh khắc có cue notes; 4 cảnh chụp bắt buộc đã bàn giao ekip',
    details: [
      { label: 'Bài hát nghi lễ', value: '6 bài (Có cờ cấm phát)', isOk: true },
      { label: 'Cảnh chụp bắt buộc', value: '3/4 cảnh đã bàn giao', isOk: true },
      { label: 'Photographer view', value: 'Đã kích hoạt', isOk: true },
    ],
    route: '/preparation?tab=music',
  },
  {
    id: 'support',
    title: '8. Đội ngũ hỗ trợ ngày cưới',
    status: 'ready',
    score: 100,
    summary: 'Đã đủ 9 vai trò then chốt (Cô dâu, Chú rể, Phù dâu, Phù rể, MC, Điều phối...)',
    details: [
      { label: 'Tổng số nhân sự', value: '7 người đảm nhiệm 9 vai trò', isOk: true },
      { label: 'Liên hệ 1-chạm & Dự phòng', value: 'Đầy đủ SĐT + Người dự phòng', isOk: true },
      { label: 'Quy tắc an toàn', value: 'Không cấp tài khoản đăng nhập', isOk: true },
    ],
    route: '/support',
  },
];

export const INITIAL_R2_SNAPSHOTS: R2Snapshot[] = [
  {
    id: 'snap_01',
    version: 'R2-v1.0',
    createdAt: '2026-11-15T16:30:00Z',
    createdBy: 'Nguyễn Thu Trang (Cô dâu)',
    overallReadiness: 97,
    notes: 'Bản chốt chính thức chuẩn bị đầy đủ cột mốc R2 gửi nhà hàng và điều phối viên.',
    guestCount: 178,
    seatingCount: 178,
    mealCount: 178,
    handedOverAt: '2026-11-15T17:00:00Z',
    handedOverTo: 'Anh Hùng (Quản lý sảnh tiệc)',
    handoverChannel: 'Biên bản giấy ký tay tại sảnh',
  },
];

export const INITIAL_DELTA_CHANGES: DeltaChange[] = [
  {
    domain: 'Khách mời & Chỗ ngồi',
    description: '+2 khách mời người lớn xác nhận tham dự bổ sung (Bác Thành +1 người đi kèm).',
    type: 'added',
  },
  {
    domain: 'Đồ dùng chuẩn bị',
    description: 'Thêm thời hạn hoàn trả cho Khung ảnh cổng cưới (Hạn trả: 12:00 ngày 21/11).',
    type: 'modified',
  },
  {
    domain: 'Âm nhạc & Cảnh chụp',
    description: 'Cập nhật cue note đoạn điệp khúc bài hát trao nhẫn cưới Ánh Nắng Của Anh.',
    type: 'modified',
  },
];
