# Vận hành Wedding Management Platform

Trạng thái 2026-11-19: Docker production với PostgreSQL 16 đã qua 60 live browser tests, kiểm non-root và giữ DB/uploads sau restart. Người dùng chọn chạy trên máy này; xem [hướng dẫn local](LOCAL_USAGE.md). Đăng nhập Google tương tác và HTTPS/offsite nếu triển khai Internet vẫn cần nghiệm thu riêng. Xem [biên bản hoàn thiện](COMPLETION_REPORT_2026-11-19.md).

## Cấu hình

Dùng `.env.example` làm mẫu. Điền `DB_PASSWORD` cho bootstrap và `APP_DB_PASSWORD` riêng cho app, `APP_URL`, `BETTER_AUTH_SECRET`, Google OAuth và hai email owner. Với Docker Compose, `.env` dùng để nội suy; với Next.js local dùng `.env.local`. Lệnh migrate tự nạp `.env.local` rồi `.env` và giữ giá trị đã có trong process. Các script backup/seed khác cần được cấp biến môi trường rõ ràng. Nếu mật khẩu có ký tự dành riêng cho URL, phải percent-encode trong connection URL; với Compose nên dùng mật khẩu ngẫu nhiên dạng hex.

`docker-compose.yml` định nghĩa `db`, tác vụ `migrate` và `app`. App chỉ khởi động khi DB healthy và migration thành công. Bind mounts hiện được cấu hình cố định:

| Dữ liệu | Đường dẫn host | Trong container |
|---|---|---|
| PostgreSQL | `/srv/wedding/data/postgres` | `/var/lib/postgresql/data` |
| Uploads | `/srv/wedding/data/uploads` | `/data/uploads` |

App chạy UID/GID 1001; thư mục uploads phải cho UID này ghi. Port app chỉ bind `127.0.0.1:3000` mặc định. Máy chủ cần reverse proxy HTTPS riêng; repository chưa cung cấp cấu hình proxy đã được kiểm định.

## Database và migrations

Schema nằm trong `src/db/schema/`, SQL migrations trong `src/db/migrations/`. Dùng `MIGRATION_DATABASE_URL` với tài khoản bootstrap/migration, khác `DATABASE_URL` của app. Chạy `pnpm db:migrate` trước khi app phục vụ. Script áp dụng toàn bộ SQL theo thứ tự, bao gồm `0001_rls_policies.sql`, lưu SHA-256 vào `app_schema_migrations`, khóa chạy đồng thời và từ chối migration đã bị sửa. Mỗi tệp chạy trong transaction. Không thay bằng `drizzle-kit push`.

Các migration sau 0000 trong repository được duy trì bằng SQL; snapshot metadata của Drizzle hiện chỉ có 0000. Khi thay schema, thêm tệp SQL số tiếp theo và kiểm thử DB mới/nâng cấp bằng harness. Không chạy `drizzle-kit generate` rồi áp dụng trực tiếp dựa trên snapshot cũ; phải đồng bộ metadata trước hoặc kiểm tra/chỉnh SQL sinh ra. Journal đã liệt kê đủ 0000–0006, nhưng sổ áp dụng production là `app_schema_migrations` của runner.

Đặt cả `APP_DB_USER` và `APP_DB_PASSWORD` khi migrate để tạo/cập nhật app role `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`. App được quyền bảng/sequence cần thiết và không đọc được sổ migration. Sau khi thêm migration mới, chạy lại lệnh để cập nhật grants. Thay đổi mật khẩu app cần đồng bộ `DATABASE_URL` và restart app.

Database cũ chưa có sổ migration bị từ chối mặc định. Trước nâng cấp, backup DB/uploads và diễn tập restore; đối chiếu rằng SQL 0000–0005, đặc biệt extensions/RLS, đã được áp dụng đầy đủ. Chỉ sau khi kiểm chứng mới chạy `pnpm db:migrate --baseline`: lệnh ghi nhận 0000–0005 và thực thi 0006 trở đi. Không dùng baseline để bỏ qua schema không rõ nguồn gốc. 0006 bổ sung ngày nhận quà, media, nội dung menu đã chốt, sửa kiểu người chốt và guard lưu trữ/chu trình công việc.

`drizzle.config.ts` lấy `DATABASE_URL` từ process và có URL dự phòng trong mã. Đặt biến này rõ ràng để tránh chạy vào database ngoài ý muốn. Không chạy migration thay đổi dữ liệu trước khi có backup có thể khôi phục.

Seed hai owner từ source checkout đã cài dependencies, với `DATABASE_URL` được nạp:

```sh
pnpm exec tsx scripts/seed-owners.ts groom@example.com bride@example.com
```

Script hỗ trợ `SEED_OWNER_EMAIL_1` và `SEED_OWNER_EMAIL_2`; đừng nhầm với `OWNER_EMAIL_1` / `OWNER_EMAIL_2` trong cấu hình ứng dụng.

## Build và khởi động

```sh
pnpm exec tsc --noEmit
pnpm build
docker compose build app migrate
docker compose up -d
docker compose ps
docker compose logs --tail=100 app migrate db
```

Docker build/run đã được thực thi trên máy local bằng named volumes; base Compose dùng bind mounts Linux như bảng phía trên. Image runner chỉ chứa standalone bundle và assets. Stage `tools` có source, pnpm/tsx, PostgreSQL client và tar, được service migrate sử dụng. Có thể chạy lại migration bằng `docker compose run --rm migrate`. Không chạy `docker compose exec app pnpm ...`; backup/seed cần source checkout hoặc container tools với URL và bind mounts được cấu hình cho tác vụ đó. Launcher local dùng `pg_dump`/`pg_restore` bên trong DB container để khớp phiên bản server.

`GET /api/health` trả 200 khi kiểm tra database thành công và 503 khi không truy cập được database. Chỉ health check chưa đủ chứng minh phân quyền hoặc các luồng nghiệp vụ.

## Trước phát hành

- Kiểm thử đăng nhập với hai owner và tài khoản family trên ứng dụng thật.
- Lặp lại drill RLS/API khi đổi môi trường hoặc phiên bản PostgreSQL. Sandbox PostgreSQL 17 và Compose PostgreSQL 16 đã kiểm role không bypass RLS. Adapter xác thực dùng context dịch vụ trong transaction riêng cho các bảng auth; không mở quyền ghi anonymous hoặc nâng role database của app.
- Chạy `pnpm test:live` trên bản build mới. Bộ mới bao phủ CRUD các menu chuẩn bị, thực đơn/xe/phòng, thiệp/nhập dữ liệu, chia sẻ, điểm danh/quà/lịch hẹn và các luồng khách/tiền/bàn giao; xem biên bản hoàn thiện để biết giới hạn phạm vi.
- Lặp lại restore thực trên cấu hình đích và từ kho offsite. Script local đã đối soát bảng, FK, tổng tiền, uploads và vô hiệu hóa credentials cũ; xem báo cáo verification của lần chạy mới nhất.
- Chốt host, domain, reverse proxy, secrets, lịch backup, nơi lưu offsite và người chịu trách nhiệm.

Rollback cần phiên bản image/source trước đó và kế hoạch tương thích schema. Không giả định rollback image có thể hoàn tác migrations. Xem [hướng dẫn DR](DISASTER_RECOVERY.md).
