# Backup và khôi phục dữ liệu

**Restore thực đã được kiểm chứng trong sandbox PostgreSQL 17.4.** Chưa nghiệm thu DR trên hạ tầng production, chưa đo RPO/RTO và chưa thử lấy bản backup từ kho offsite.

## Backup thật

`scripts/backup.ts` tạo `database.dump`, `uploads.tar.gz` và `manifest.json` trong staging riêng, tính SHA-256 rồi đổi tên thư mục để công bố bundle. Không xóa staging của job khác.

Yêu cầu: `DATABASE_URL` của database nguồn với quyền đọc toàn bộ dữ liệu/bypass RLS cho `pg_dump`; `UPLOAD_DIR` tồn tại; `pg_dump` tương thích phiên bản PostgreSQL và `tar` trên PATH. Mật khẩu kết nối được truyền qua môi trường libpq thay vì đối số process.

```sh
pnpm exec tsx scripts/backup.ts
```

Script không tự nạp `.env`; phải nạp biến vào process. Mặc định bundle nằm dưới `backups/` trong working directory. Thiếu cấu hình/storage sẽ báo lỗi, không tự chuyển sang mock. `mockMode: true` chỉ dành cho unit test và được đánh dấu trong manifest.

Database evidence và `pg_dump` dùng chung một snapshot PostgreSQL được export từ transaction repeatable read. Manifest ghi số dòng, fingerprint dữ liệu, tổng cột số nguyên/numeric dưới dạng chuỗi và định nghĩa khóa ngoại cho từng bảng. Uploads ghi hash SHA-256 từng tệp; symbolic links và tệp không thông thường bị từ chối. Nếu uploads thay đổi trong quá trình tạo archive, backup thất bại.

**Giới hạn:** chưa có write fence chung bao trùm DB và filesystem. Phải dừng luồng ghi của ứng dụng trong suốt backup để dump và uploads nhất quán với nhau. Atomic rename không thay thế write fence. Hash manifest không phải chữ ký xác thực nếu cả manifest và bundle đều bị kẻ tấn công sửa.

## Restore vào sandbox

CLI `scripts/restore-drill.ts` chọn bundle mới nhất trong `backups/` và yêu cầu:

| Biến | Nội dung |
|---|---|
| `RESTORE_ADMIN_URL` | URL tới PostgreSQL sandbox tách biệt; tài khoản có quyền tạo database, restore schema/extensions và kiểm/sửa dữ liệu qua RLS |
| `RESTORE_SANDBOX_ROOT` | Thư mục sandbox cho uploads; script luôn tạo thư mục con mới |
| `OWNER_EMAIL_1`, `OWNER_EMAIL_2` | Hai email owner được kỳ vọng, phải khác nhau |

```sh
pnpm exec tsx scripts/restore-drill.ts
```

Không trỏ `RESTORE_ADMIN_URL` vào môi trường production. API lập trình có thể truyền bundle cụ thể và các options này trực tiếp vào `executeRestoreDrill`.

Restore thực thực hiện:

1. Kiểm filename trong manifest và checksum dump/archive; từ chối bundle mock hoặc bundle cũ không có evidence.
2. Kiểm archive không có đường dẫn tuyệt đối, `..`, symlink hoặc hardlink trước khi giải nén.
3. Tạo database mới có tên `wedding_drill_<random>`; không nhận tên database đích có sẵn từ người gọi.
4. Chạy `pg_restore --no-owner --no-privileges --exit-on-error --single-transaction`.
5. Đối chiếu mọi bảng: số dòng, fingerprint, tổng numeric và định nghĩa FK; từ chối FK chưa được validate hoặc danh sách owner sai.
6. Xóa sessions, member invites, verification tokens và `member_event_access`; xóa OAuth access/refresh/id tokens và password trên accounts. Quyền family phải được cấp lại sau restore.
7. Giải nén uploads vào thư mục mới rồi so sánh hash từng tệp với manifest.
8. Chỉ trả `restored-and-verified` khi tất cả bước hoàn tất. Khi lỗi, sandbox được giữ để điều tra; không tự mở app hay kết nối internet cho dữ liệu đã restore.

`mockMode: true` chỉ kiểm checksum và trả `checksum-only` với mọi cờ restore/integrity false.

## Lặp lại drill đã kiểm chứng

```sh
pnpm test:restore
# Restore, RLS và browser tương tác với production build:
pnpm build
pnpm test:live
```

Cần binary PostgreSQL và extensions `unaccent`, `pg_trgm`, `tar`; lệnh live cần browser Playwright. Harness tạo cluster tạm trên loopback, sáu migrations và dữ liệu fixture riêng; không đọc URL database có sẵn trên máy. App dùng tài khoản `NOSUPERUSER NOBYPASSRLS`.

Drill đã kiểm tra 54 bảng, đối chiếu FK, giữ nguyên `9007199254740993` VND, byte uploads, xóa credentials/quyền family ở bản restore và từ chối dump bị can thiệp. Database nguồn giữ nguyên trong bước restore; các ca browser sau đó ghi fixture vào database nguồn sandbox. Xem [bằng chứng ngày 2026-11-18](G11_VERIFICATION_2026-11-18.json).

## Trước triển khai production

Cần thử trên đúng phiên bản PostgreSQL mục tiêu (Compose hiện chọn 16), chạy restore từ kho offsite, cấu hình lịch/retention và giữ khóa khôi phục ngoài host. Chưa có hạ tầng offsite, RPO/RTO đo được hoặc chữ ký owner được xác minh trong lượt này. Không dùng kết quả sandbox như chứng nhận DR production.
