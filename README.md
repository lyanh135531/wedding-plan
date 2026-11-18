# Wedding Management Platform

Ứng dụng quản lý đám cưới tự host, dùng Next.js 14.2.15, React 18, TypeScript, Drizzle và PostgreSQL. Phạm vi gồm khách mời, thiệp/RSVP, ngân sách, nhà cung cấp, công việc, xếp bàn, chuẩn bị và vận hành ngày cưới.

**Trạng thái: đang kiểm định Gate G11 / Milestone R3; chưa được nghiệm thu production.** Xem [biên bản kiểm định](docs/MILESTONE_R3_SIGNOFF.md) để biết bằng chứng và các phần còn thiếu.

## Chạy cục bộ

1. Cài Node.js và pnpm theo `packageManager` trong `package.json` (`pnpm@12.18.0`).
2. Chạy `pnpm install --frozen-lockfile`.
3. Sao chép `.env.example` thành `.env.local`, điền cấu hình thật và dùng `NODE_ENV=development`. URL PostgreSQL trong mẫu dùng hostname Docker `db`; khi chạy ứng dụng trên host phải đổi sang địa chỉ database truy cập được từ host.
4. Cấu hình URL ứng dụng/Better Auth, Google OAuth, hai email chủ sở hữu và thư mục uploads. Không commit tệp chứa secrets.
5. Chuẩn bị PostgreSQL và áp dụng schema/migrations theo [hướng dẫn vận hành](docs/OPERATIONS.md). Cấu hình schema bằng Drizzle không thay thế việc áp dụng SQL RLS.
6. Chạy `pnpm dev` và mở `http://localhost:3000`.

Next.js đọc `.env.local`; các script `tsx` riêng cần biến môi trường được nạp vào process trước khi chạy. Owner seeding nhận email qua đối số hoặc `SEED_OWNER_EMAIL_1` / `SEED_OWNER_EMAIL_2`:

```sh
pnpm exec tsx scripts/seed-owners.ts groom@example.com bride@example.com
```

## Kiểm tra

```sh
pnpm exec tsc --noEmit
pnpm exec vitest run --maxWorkers=4
pnpm exec playwright test --workers=4
pnpm build
```

`pnpm build` kiểm tra TypeScript. Lệnh Playwright mặc định kiểm tra HTML component được render sẵn qua `page.setContent`; kết quả không chứng minh luồng đăng nhập, ghi API hoặc lưu PostgreSQL trên ứng dụng đang chạy. Các integration test có dùng database mock. Không suy diễn test pass thành mọi tiêu chí AT01–AT62 đã được nghiệm thu thực tế.

## Mã nguồn

- `src/db/schema/`, `src/db/migrations/`: schema và SQL migrations/RLS.
- `src/lib/`: repositories và nghiệp vụ theo module.
- `src/app/api/v1/`: API handlers.
- `src/components/`, `src/context/`: giao diện và trạng thái phía trình duyệt.
- `tests/`: unit, integration, adversarial và browser component tests.
- `scripts/`: seed owner, backup, restore và kiểm định sandbox.

Dashboard yêu cầu session phía server và lấy role/phạm vi sự kiện từ database. Layout ứng dụng không gắn thanh prototype; nút đổi role thử nghiệm không được xuất trong production. Danh sách/hồ sơ nhà cung cấp không tự thay dữ liệu API lỗi bằng fixtures.

Các trang khách mời/RSVP, ngân sách, thanh toán và xếp bàn đã nối API thật. Bàn giao hiển thị đúng nội dung bản chốt được chọn, kiểm tra thay đổi nội dung và từ chối ghi nhận bàn giao bản đã lỗi thời. Luồng tài chính giữ số tiền nguyên chính xác, dùng cùng transaction cho idempotency và khoản ghi; các yêu cầu hoàn tiền đồng thời khóa khoản gốc. Phạm vi này chưa bao gồm mọi tính năng của các màn hình prototype cũ.

`NetworkWriteGuard` chặn các API fetch ghi cùng origin và submit form khi `navigator.onLine=false`; không tạo hàng đợi ghi offline. Drill live đã kiểm tra một form nhà cung cấp qua mất/kết nối lại trên bốn viewport. Đây chưa phải kiểm định tương tác cho tất cả form nghiệp vụ.

## Vận hành và khôi phục

- [Vận hành](docs/OPERATIONS.md)
- [Backup và khôi phục](docs/DISASTER_RECOVERY.md)

Backup thật yêu cầu `DATABASE_URL`, thư mục `UPLOAD_DIR`, `pg_dump` và `tar`. Mock chỉ dùng khi truyền rõ `mockMode: true`. Restore thật tạo database và thư mục uploads mới, đối chiếu evidence rồi thu hồi credentials/quyền chia sẻ cũ. Xem hướng dẫn DR về tài khoản sandbox và biến môi trường bắt buộc.

Để chạy kiểm định thực, cần các binary PostgreSQL (`initdb`, `pg_ctl`, `pg_dump`, `pg_restore`) cùng extensions `unaccent`/`pg_trgm` trên PATH, `tar`, và browser Playwright đã cài. Chạy bằng tài khoản hệ điều hành có thể dùng `initdb`; Linux không chạy `initdb` bằng root.

```sh
pnpm build
pnpm test:live
# Chỉ kiểm tra backup/restore, không khởi động ứng dụng/browser:
pnpm test:restore
```

Harness tự tạo cluster tạm trên cổng loopback riêng, áp dụng sáu migrations và dùng tài khoản app `NOSUPERUSER NOBYPASSRLS`. Nó không dùng `DATABASE_URL` hiện có của máy. Kết thúc sẽ dừng cluster và app, giữ artifacts tạm để điều tra. Browser dùng session được seed vào database sandbox, không thay thế kiểm thử Google OAuth thật.

Bằng chứng: `test-results/g11/verification.json`, báo cáo `playwright-report/live/index.html` và `playwright-report/components/index.html`. Bản tóm tắt đã loại đường dẫn máy cá nhân: [G11 verification](docs/G11_VERIFICATION_2026-11-18.json).
