# Giao diện và font chữ — 2026-11-19

## Nguyên nhân lỗi font

CSS khai báo font tự lưu trữ nhưng các tệp tương ứng trong `public/fonts` chưa có.
Trình duyệt phải dùng font dự phòng, khiến tiêu đề, độ đậm và chữ tiếng Việt không đồng nhất.

## Thay đổi

- Bổ sung Be Vietnam Pro ở bốn độ đậm 400/500/600/700 và Playfair Display variable 400–900, định dạng WOFF2, kèm giấy phép OFL. Các tệp giữ đủ ký tự tiếng Việt; không gọi CDN khi chạy ứng dụng.
- Dùng Be Vietnam Pro cho nội dung và điều khiển; Playfair Display cho tiêu đề chính.
- Đồng bộ bảng màu xanh rừng, nền ngà và điểm nhấn champagne; màu trạng thái lỗi/cảnh báo vẫn có ý nghĩa riêng.
- Chỉnh khung ứng dụng, thanh điều hướng, trang đăng nhập, thẻ chỉ số, nút, ô nhập, hộp thoại, bộ lọc và các trạng thái trống.
- Hoàn thiện bố cục các trang tổng quan, khách mời, ngân sách, công việc, lịch và tài liệu; chuẩn hóa màu ở các mô-đun còn lại.
- Sửa breakpoint `sm` từ 390px về 640px để các điều khiển dành cho màn hình lớn không xuất hiện quá sớm trên điện thoại.

## Kiểm chứng

- 1.315 kiểm thử Vitest đạt; TypeScript không báo lỗi.
- Bản production build với `NEXT_DIST_DIR=.next-audit pnpm build` hoàn tất thành công.
- `pnpm exec tsx scripts/check-ui.ts`: 24 trang × 4 kích thước màn hình (1440, 768, 390, 360px), không tràn ngang; cả năm khai báo font đều tải thành công.
- Kiểm tra Chromium và WebKit; kiểm tra trực quan ảnh trang đăng nhập, tổng quan, khách mời, ngân sách và nhà cung cấp.
- Báo cáo đo đạc: `test-results/ui-refresh/checks.json`; ảnh kiểm tra nằm cùng thư mục. Đây là kiểm tra bố cục/font với dữ liệu hiện có, không phải chứng minh mọi luồng nghiệp vụ không có lỗi.

Nguồn font và giấy phép: `public/fonts/README.md`.
