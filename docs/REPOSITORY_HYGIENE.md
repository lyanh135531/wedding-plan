# File cần giữ và quy tắc trước khi push

## Commit

| Nhóm | File/thư mục | Lý do |
| --- | --- | --- |
| Ứng dụng | `src/` | Mã nguồn, API, schema và SQL migrations/RLS |
| Tài nguyên | `public/`, gồm font và giấy phép `OFL.txt` | Font phải có trong checkout để giao diện hiển thị đúng |
| Kiểm thử | `tests/`, `scripts/` | Kiểm tra hồi quy, seed, backup/restore và kiểm định |
| Cấu hình package | `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | Cài đặt tái lập được; workspace chứa overrides và quyền build dependencies |
| Cấu hình dự án | Next, TypeScript, Tailwind, PostCSS, Drizzle, Vitest, Playwright | Build, chạy và kiểm thử |
| Triển khai | `Dockerfile`, `docker-compose.yml`, `.dockerignore` | Đóng gói và vận hành |
| Mẫu môi trường | `.env.example`, `.env.test.example` | Chỉ chứa giá trị mẫu, không chứa secrets thật |
| Tài liệu | `README.md`, `PROJECT.md`, `PLAN.md`, `TEST_INFRA.md`, `TEST_READY.md`, `docs/` | Đặc tả, hướng dẫn và các giới hạn đã ghi nhận |
| Quy tắc repo | `.gitignore`, `.gitattributes`, `.editorconfig` | Bỏ qua dữ liệu cục bộ, thống nhất UTF-8 và LF |

`tests/e2e/prototypes/tailwind.generated.css` hiện vẫn cần commit: test helper đọc trực tiếp file này và chưa có bước tự tạo khi chạy test. Không xóa chỉ vì tên có chữ `generated`.

## Không commit

- `.env`, `.env.local`, `.env.test` và các file môi trường thật khác; private keys/chứng chỉ chứa khóa.
- `node_modules/`, `.pnpm-store/`, `.next*/`, `out/`, `dist/`, `next-env.d.ts`, `*.tsbuildinfo`.
- `coverage/`, `test-results/`, `playwright-report/`, `tests/tmp/`, `*.log` và các báo cáo test thô ở thư mục gốc.
- Upload của người dùng, dữ liệu database và backup: `uploads/`, `data/`, `backups/`, `backups_test_temp/`.
- Trạng thái agent/IDE và tài liệu làm việc tạm trong `.agents/`, `.local-artifacts/`.

Các file debug database, báo cáo bàn giao cũ và log ở thư mục gốc đã được chuyển vào `.local-artifacts/pre-push-2026-11-19/`. Đây là bản giữ cục bộ, không phải tài liệu vận hành hiện tại.

`next-env.d.ts` được Next.js tạo lại khi chạy `pnpm dev` hoặc `pnpm build`. Các file `.env.test` và `next-env.d.ts` được bỏ theo dõi trong commit dọn repo, nhưng vẫn giữ trên máy hiện tại.

Drizzle nạp môi trường bằng bộ nạp của Next.js và yêu cầu `DATABASE_URL`; không còn URL chứa mật khẩu dự phòng trong source. Docker cài dependencies cùng `pnpm-workspace.yaml` để áp dụng đúng overrides.

## Kiểm tra trước khi push

```sh
git status --short
git diff --check
pnpm install --frozen-lockfile
pnpm exec vitest run --maxWorkers=4
pnpm build
git add .
git diff --cached --check
git diff --cached --stat
```

Xem nội dung staged trước khi commit. Không dùng `git add -f` để đưa file môi trường, backup hoặc artifact vào Git.

`.gitignore` chỉ tác động tới file chưa được theo dõi; không xóa secrets khỏi lịch sử commit. Nếu một giá trị thật đã từng được commit/push, cần thay giá trị đó ở dịch vụ tương ứng. Bỏ theo dõi ở commit mới không thu hồi credential cũ.

Kiểm tra lần dọn repo này: TypeScript, import cấu hình Drizzle, `git diff --check` và kiểm tra quy tắc ignore đều đạt. Quét các mẫu credential phổ biến trên 684 file dự kiến commit không phát hiện giá trị đáng ngờ; đây không phải cam kết phát hiện mọi loại secret. Chưa chạy build Docker vì Docker Desktop chưa hoạt động trên máy.
