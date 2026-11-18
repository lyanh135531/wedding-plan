# Vận hành Wedding Management Platform

Trạng thái 2026-11-18: hướng dẫn dựa trên mã nguồn và kiểm định sandbox; chưa có bằng chứng triển khai hoặc nghiệm thu trên máy chủ production. Không coi các đường dẫn ví dụ là hạ tầng đã được cấp phát.

## Cấu hình

Dùng `.env.example` làm mẫu. Các giá trị cần điền gồm `DB_PASSWORD`, `APP_URL`, `BETTER_AUTH_SECRET`, Google OAuth và hai email owner. Với Docker Compose, `.env` được dùng để nội suy cấu hình; với Next.js local dùng `.env.local`. Script `tsx` đọc biến môi trường của process, không tự nạp các tệp này.

`docker-compose.yml` định nghĩa service `app` và `db`, tên container tương ứng `wedding_app` và `wedding_db`. Bind mounts hiện được cấu hình cố định:

| Dữ liệu | Đường dẫn host | Trong container |
|---|---|---|
| PostgreSQL | `/srv/wedding/data/postgres` | `/var/lib/postgresql/data` |
| Uploads | `/srv/wedding/data/uploads` | `/data/uploads` |

App chạy UID/GID 1001; thư mục uploads phải cho UID này ghi. Port app chỉ bind `127.0.0.1:3000` mặc định. Máy chủ cần reverse proxy HTTPS riêng; repository chưa cung cấp cấu hình proxy đã được kiểm định.

## Database và migrations

Schema nằm trong `src/db/schema/`, SQL migrations trong `src/db/migrations/`. Kiểm tra thứ tự và SQL trước khi áp dụng vào database mới. Phải kiểm tra policies, extensions và quyền database với tài khoản ứng dụng thật; `drizzle-kit push` không tự chứng minh RLS đã được triển khai đúng.

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
docker compose build app
docker compose up -d
docker compose ps
docker compose logs --tail=100 app db
```

Docker Engine hiện không kết nối được (pipe dockerDesktopLinuxEngine không tồn tại); Docker build/run chưa được thực thi trong lượt kiểm định này. Image runner chỉ chứa standalone bundle và assets, không có pnpm, tsx hay thư mục scripts. Vì vậy không chạy `docker compose exec app pnpm ...` để backup, migrate hoặc seed. Các tác vụ đó cần source checkout/tooling riêng trên host hoặc container công cụ được chuẩn bị riêng.

`GET /api/health` trả 200 khi kiểm tra database thành công và 503 khi không truy cập được database. Chỉ health check chưa đủ chứng minh phân quyền hoặc các luồng nghiệp vụ.

## Trước phát hành

- Kiểm thử đăng nhập với hai owner và tài khoản family trên ứng dụng thật.
- Lặp lại drill RLS/API với cấu hình PostgreSQL triển khai. Sandbox 17.4 đã kiểm quyền family, role không bypass RLS và session bị thu hồi; Compose 16 chưa chạy.
- Hoàn thiện browser journeys cho các phần còn lại: timeline qua UI, công việc/lịch, quà mừng/quỹ và các thao tác nâng cao. Các trang khách/RSVP, xếp bàn, thu chi cơ bản và bàn giao đã nối API; xem biên bản G11 để phân biệt phạm vi đã kiểm chứng với prototype.
- Lặp lại restore thực trên cấu hình đích và từ kho offsite. Script local đã kiểm 54 bảng, FK, tổng tiền, uploads và vô hiệu hóa credentials cũ; xem biên bản G11.
- Chốt host, domain, reverse proxy, secrets, lịch backup, nơi lưu offsite và người chịu trách nhiệm.

Rollback cần phiên bản image/source trước đó và kế hoạch tương thích schema. Không giả định rollback image có thể hoàn tác migrations. Xem [hướng dẫn DR](DISASTER_RECOVERY.md).
